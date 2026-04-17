import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Delivery, Driver, AreaRule, Course, VehicleSpec,
  AssignmentLogEntry, CapacityWarning,
  DEFAULT_DRIVERS, DEFAULT_COURSES, DEFAULT_VEHICLE_SPECS,
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
    (s.areaRules as Array<{ id: string; region: string; driverName: string }> | undefined) ?? [];
  const areaRules: AreaRule[] = oldRules.map((r) => {
    const matched = courses.find((c) => c.name === r.driverName);
    return {
      id: r.id,
      region: r.region,
      driverName: r.driverName,
      vehicleType: matched?.vehicleType ?? "light",
      courseId: matched?.id ?? courses[0]?.id ?? "",
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
  drivers: Driver[];                    // Phase 4 で削除
  courses: Course[];
  vehicleSpecs: VehicleSpec[];
  areaRules: AreaRule[];
  areaImage: string | null;
  areaDescription: string;
  selectedDeliveryId: string | null;
  selectedDeliveryIds: Set<string>;
  driverFilter: Set<string> | null;     // Phase 4 で削除
  courseFilter: Set<string> | null;
  activeCourseIds: string[];
  assignmentLog: AssignmentLogEntry[];
  capacityWarnings: CapacityWarning[];
  uploadedFileName: string;
  isProcessing: boolean;
  processingStep: string;

  // 既存メソッド
  setDeliveries: (deliveries: Delivery[]) => void;
  mergeDeliveries: (newData: Delivery[]) => void;
  updateDelivery: (id: string, updates: Partial<Delivery>) => void;
  updateDriverAssignment: (id: string, driverName: string) => void;
  toggleUndelivered: (id: string) => void;
  setMemo: (id: string, memo: string) => void;
  setDrivers: (drivers: Driver[]) => void;
  setAreaRules: (rules: AreaRule[]) => void;
  setAreaImage: (image: string | null) => void;
  setAreaDescription: (desc: string) => void;
  selectDelivery: (id: string | null) => void;
  setUploadedFileName: (name: string) => void;
  setDriverFilter: (filter: Set<string> | null) => void;
  toggleDriverFilter: (driverName: string) => void;
  setProcessing: (step: string) => void;
  clearProcessing: () => void;
  toggleSelectDelivery: (id: string) => void;
  selectAllVisible: (ids: string[]) => void;
  clearSelection: () => void;
  bulkAssignDriver: (ids: string[], driverName: string) => void;
  // 新規メソッド
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
      drivers: DEFAULT_DRIVERS,
      courses: DEFAULT_COURSES,
      vehicleSpecs: DEFAULT_VEHICLE_SPECS,
      areaRules: [],
      areaImage: null,
      areaDescription: "",
      selectedDeliveryId: null,
      selectedDeliveryIds: new Set<string>(),
      driverFilter: null,
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
      updateDriverAssignment: (id, driverName) => {
        const driver = get().drivers.find((d) => d.name === driverName);
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id ? { ...d, driverName, colorCode: driver?.color ?? null } : d
          ),
        });
      },
      toggleUndelivered: (id) =>
        set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, isUndelivered: !d.isUndelivered } : d)) }),
      setMemo: (id, memo) =>
        set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, memo } : d)) }),
      setDrivers: (drivers) => set({ drivers }),
      setAreaRules: (rules) => set({ areaRules: rules }),
      setAreaImage: (image) => set({ areaImage: image }),
      setAreaDescription: (desc) => set({ areaDescription: desc }),
      selectDelivery: (id) => set({ selectedDeliveryId: id }),
      setUploadedFileName: (name) => set({ uploadedFileName: name }),
      setDriverFilter: (filter) => set({ driverFilter: filter }),
      toggleDriverFilter: (driverName) => {
        const current = get().driverFilter;
        if (current === null) set({ driverFilter: new Set([driverName]) });
        else {
          const next = new Set(current);
          if (next.has(driverName)) {
            next.delete(driverName);
            set({ driverFilter: next.size === 0 ? null : next });
          } else { next.add(driverName); set({ driverFilter: next }); }
        }
      },
      setProcessing: (step) => set({ isProcessing: true, processingStep: step }),
      clearProcessing: () => set({ isProcessing: false, processingStep: "" }),
      toggleSelectDelivery: (id) => {
        const current = new Set(get().selectedDeliveryIds);
        if (current.has(id)) current.delete(id); else current.add(id);
        set({ selectedDeliveryIds: current });
      },
      selectAllVisible: (ids) => set({ selectedDeliveryIds: new Set(ids) }),
      clearSelection: () => set({ selectedDeliveryIds: new Set<string>() }),
      bulkAssignDriver: (ids, driverName) => {
        const driver = get().drivers.find((d) => d.name === driverName);
        const idSet = new Set(ids);
        set({
          deliveries: get().deliveries.map((d) =>
            idSet.has(d.id) ? { ...d, driverName, colorCode: driver?.color ?? null } : d
          ),
          selectedDeliveryIds: new Set<string>(),
        });
      },

      setCourses: (courses) => set({ courses }),
      setVehicleSpecs: (specs) => set({ vehicleSpecs: specs }),
      updateCourseAssignment: (id, courseId) => {
        const course = get().courses.find((c) => c.id === courseId);
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id
              ? { ...d, courseId, colorCode: course?.color ?? null, driverName: course?.name ?? null }
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
              ? { ...d, courseId, colorCode: course?.color ?? null, driverName: course?.name ?? null }
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
            ...d, courseId: null, driverName: null, colorCode: null, assignReason: "", unassignedReason: "",
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
      }),
      migrate: migrateStore as (s: unknown, v: number) => DeliveryStore | Promise<DeliveryStore>,
    }
  )
);
