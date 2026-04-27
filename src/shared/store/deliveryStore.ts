import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Delivery, AreaRule, Course, VehicleSpec,
  AssignmentLogEntry, CapacityWarning,
  DEFAULT_COURSES, DEFAULT_VEHICLE_SPECS,
} from "@/shared/types/delivery";

export function migrateStore(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== "object") return persistedState;
  if (version >= 2) return persistedState;
  const s = persistedState as Record<string, unknown>;
  const oldDrivers =
    (s.drivers as Array<{ name: string; color: string; vehicleType: "light" | "2t" }> | undefined) ?? [];
  let lightIdx = 0;
  let truckIdx = 0;
  const courses: Course[] = oldDrivers.length > 0
    ? oldDrivers.map((d) => {
        const isTruck = d.vehicleType === "2t";
        const idx = isTruck ? ++truckIdx : ++lightIdx;
        return {
          id: `${isTruck ? "truck" : "light"}-${idx}`,
          name: d.name,
          vehicleType: d.vehicleType,
          color: d.color,
          defaultRegion: "",
        };
      })
    : DEFAULT_COURSES;
  const oldRules =
    (s.areaRules as Array<{ id: string; region: string; driverName?: string; courseId?: string }> | undefined) ?? [];
  const areaRules: AreaRule[] = oldRules.map((r) => {
    const matched = r.driverName ? courses.find((c) => c.name === r.driverName) : null;
    return {
      id: r.id,
      region: r.region,
      courseId: r.courseId ?? matched?.id ?? courses[0]?.id ?? "",
    };
  });
  return {
    courses,
    vehicleSpecs: DEFAULT_VEHICLE_SPECS,
    areaRules,
    areaImage: s.areaImage ?? null,
    areaDescription: s.areaDescription ?? "",
  };
}

type DeliveryStore = {
  deliveries: Delivery[];
  courses: Course[];
  vehicleSpecs: VehicleSpec[];
  areaRules: AreaRule[];
  areaImage: string | null;
  areaDescription: string;
  selectedDeliveryId: string | null;
  selectedDeliveryIds: Set<string>;
  courseFilter: Set<string> | null;
  activeCourseIds: string[];
  assignmentLog: AssignmentLogEntry[];
  capacityWarnings: CapacityWarning[];
  uploadedFileName: string;
  isProcessing: boolean;
  processingStep: string;

  setDeliveries: (deliveries: Delivery[]) => void;
  mergeDeliveries: (newData: Delivery[]) => void;
  updateDelivery: (id: string, updates: Partial<Delivery>) => void;
  toggleUndelivered: (id: string) => void;
  setMemo: (id: string, memo: string) => void;
  setAreaRules: (rules: AreaRule[]) => void;
  setAreaImage: (image: string | null) => void;
  setAreaDescription: (desc: string) => void;
  selectDelivery: (id: string | null) => void;
  setUploadedFileName: (name: string) => void;
  setProcessing: (step: string) => void;
  clearProcessing: () => void;
  toggleSelectDelivery: (id: string) => void;
  selectAllVisible: (ids: string[]) => void;
  clearSelection: () => void;
  setCourses: (courses: Course[]) => void;
  setVehicleSpecs: (specs: VehicleSpec[]) => void;
  updateCourseAssignment: (id: string, courseId: string | null) => void;
  bulkAssignCourse: (ids: string[], courseId: string | null) => void;
  setActiveCourseIds: (ids: string[]) => void;
  setAssignmentLog: (log: AssignmentLogEntry[]) => void;
  setCapacityWarnings: (w: CapacityWarning[]) => void;
  setCourseFilter: (filter: Set<string> | null) => void;
  toggleCourseFilter: (courseId: string) => void;
  clearAssignmentResults: () => void;
};

export const useDeliveryStore = create<DeliveryStore>()(
  persist(
    (set, get) => ({
      deliveries: [],
      courses: DEFAULT_COURSES,
      vehicleSpecs: DEFAULT_VEHICLE_SPECS,
      areaRules: [],
      areaImage: null,
      areaDescription: "",
      selectedDeliveryId: null,
      selectedDeliveryIds: new Set<string>(),
      courseFilter: null,
      activeCourseIds: [],
      assignmentLog: [],
      capacityWarnings: [],
      uploadedFileName: "",
      isProcessing: false,
      processingStep: "",

      setDeliveries: (deliveries) => set({ deliveries }),
      mergeDeliveries: (newData) => {
        const existing = get().deliveries;
        const newSlipNumbers = new Set(newData.map((d) => d.slipNumber));
        const keptUndelivered = existing.filter(
          (d) => d.isUndelivered && !newSlipNumbers.has(d.slipNumber)
        );
        set({ deliveries: [...keptUndelivered, ...newData] });
      },
      updateDelivery: (id, updates) =>
        set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, ...updates } : d)) }),
      toggleUndelivered: (id) =>
        set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, isUndelivered: !d.isUndelivered } : d)) }),
      setMemo: (id, memo) =>
        set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, memo } : d)) }),
      setAreaRules: (rules) => set({ areaRules: rules }),
      setAreaImage: (image) => set({ areaImage: image }),
      setAreaDescription: (desc) => set({ areaDescription: desc }),
      selectDelivery: (id) => set({ selectedDeliveryId: id }),
      setUploadedFileName: (name) => set({ uploadedFileName: name }),
      setProcessing: (step) => set({ isProcessing: true, processingStep: step }),
      clearProcessing: () => set({ isProcessing: false, processingStep: "" }),
      toggleSelectDelivery: (id) => {
        const current = new Set(get().selectedDeliveryIds);
        if (current.has(id)) current.delete(id); else current.add(id);
        set({ selectedDeliveryIds: current });
      },
      selectAllVisible: (ids) => set({ selectedDeliveryIds: new Set(ids) }),
      clearSelection: () => set({ selectedDeliveryIds: new Set<string>() }),

      setCourses: (courses) => set({ courses }),
      setVehicleSpecs: (specs) => set({ vehicleSpecs: specs }),
      updateCourseAssignment: (id, courseId) => {
        const course = get().courses.find((c) => c.id === courseId);
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id
              ? { ...d, courseId, colorCode: course?.color ?? null }
              : d
          ),
        });
      },
      bulkAssignCourse: (ids, courseId) => {
        const course = get().courses.find((c) => c.id === courseId);
        const idSet = new Set(ids);
        set({
          deliveries: get().deliveries.map((d) =>
            idSet.has(d.id)
              ? { ...d, courseId, colorCode: course?.color ?? null }
              : d
          ),
          selectedDeliveryIds: new Set<string>(),
        });
      },
      setActiveCourseIds: (ids) => set({ activeCourseIds: ids }),
      setAssignmentLog: (log) => set({ assignmentLog: log }),
      setCapacityWarnings: (w) => set({ capacityWarnings: w }),
      setCourseFilter: (filter) => set({ courseFilter: filter }),
      toggleCourseFilter: (courseId) => {
        const current = get().courseFilter;
        if (current === null) set({ courseFilter: new Set([courseId]) });
        else {
          const next = new Set(current);
          if (next.has(courseId)) {
            next.delete(courseId);
            set({ courseFilter: next.size === 0 ? null : next });
          } else { next.add(courseId); set({ courseFilter: next }); }
        }
      },
      clearAssignmentResults: () =>
        set({
          deliveries: get().deliveries.map((d) => ({
            ...d, courseId: null, colorCode: null, assignReason: "", unassignedReason: "",
          })),
          assignmentLog: [],
          capacityWarnings: [],
        }),
    }),
    {
      name: "delivery-store",
      version: 2,
      partialize: (state) => ({
        courses: state.courses,
        vehicleSpecs: state.vehicleSpecs,
        areaRules: state.areaRules,
        areaImage: state.areaImage,
        areaDescription: state.areaDescription,
        activeCourseIds: state.activeCourseIds,
      }),
      migrate: migrateStore as (s: unknown, v: number) => DeliveryStore | Promise<DeliveryStore>,
    }
  )
);
