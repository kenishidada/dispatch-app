import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Delivery, Driver, AreaRule, DEFAULT_DRIVERS } from "@/shared/types/delivery";

type DeliveryStore = {
  deliveries: Delivery[];
  drivers: Driver[];
  areaRules: AreaRule[];
  areaImage: string | null;
  areaDescription: string;
  selectedDeliveryId: string | null;
  selectedDeliveryIds: Set<string>;
  driverFilter: Set<string> | null;  // null = 全員, Set = 選択中のドライバー名
  isProcessing: boolean;
  processingStep: string;

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
  setDriverFilter: (filter: Set<string> | null) => void;
  toggleDriverFilter: (driverName: string) => void;
  setProcessing: (step: string) => void;
  clearProcessing: () => void;
  toggleSelectDelivery: (id: string) => void;
  selectAllVisible: (ids: string[]) => void;
  clearSelection: () => void;
  bulkAssignDriver: (ids: string[], driverName: string) => void;
};

export const useDeliveryStore = create<DeliveryStore>()(
  persist(
    (set, get) => ({
      deliveries: [],
      drivers: DEFAULT_DRIVERS,
      areaRules: [],
      areaImage: null,
      areaDescription: "",
      selectedDeliveryId: null,
      selectedDeliveryIds: new Set<string>(),
      driverFilter: null,
      isProcessing: false,
      processingStep: "",

      setDeliveries: (deliveries) => set({ deliveries }),

      mergeDeliveries: (newData) => {
        const existing = get().deliveries;
        const undelivered = existing.filter((d) => d.isUndelivered);
        const newSlipNumbers = new Set(newData.map((d) => d.slipNumber));
        const keptUndelivered = undelivered.filter(
          (d) => !newSlipNumbers.has(d.slipNumber)
        );
        set({ deliveries: [...keptUndelivered, ...newData] });
      },

      updateDelivery: (id, updates) =>
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        }),

      updateDriverAssignment: (id, driverName) => {
        const driver = get().drivers.find((d) => d.name === driverName);
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id
              ? { ...d, driverName, colorCode: driver?.color ?? null }
              : d
          ),
        });
      },

      toggleUndelivered: (id) =>
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id ? { ...d, isUndelivered: !d.isUndelivered } : d
          ),
        }),

      setMemo: (id, memo) =>
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id ? { ...d, memo } : d
          ),
        }),

      setDrivers: (drivers) => set({ drivers }),
      setAreaRules: (rules) => set({ areaRules: rules }),
      setAreaImage: (image) => set({ areaImage: image }),
      setAreaDescription: (desc) => set({ areaDescription: desc }),
      selectDelivery: (id) => set({ selectedDeliveryId: id }),
      setDriverFilter: (filter) => set({ driverFilter: filter }),
      toggleDriverFilter: (driverName) => {
        const current = get().driverFilter;
        if (current === null) {
          // 全員表示 → この1つだけ選択
          set({ driverFilter: new Set([driverName]) });
        } else {
          const next = new Set(current);
          if (next.has(driverName)) {
            next.delete(driverName);
            set({ driverFilter: next.size === 0 ? null : next });
          } else {
            next.add(driverName);
            set({ driverFilter: next });
          }
        }
      },
      setProcessing: (step) => set({ isProcessing: true, processingStep: step }),
      clearProcessing: () => set({ isProcessing: false, processingStep: "" }),

      toggleSelectDelivery: (id) => {
        const current = new Set(get().selectedDeliveryIds);
        if (current.has(id)) {
          current.delete(id);
        } else {
          current.add(id);
        }
        set({ selectedDeliveryIds: current });
      },

      selectAllVisible: (ids) => {
        set({ selectedDeliveryIds: new Set(ids) });
      },

      clearSelection: () => {
        set({ selectedDeliveryIds: new Set<string>() });
      },

      bulkAssignDriver: (ids, driverName) => {
        const driver = get().drivers.find((d) => d.name === driverName);
        const idSet = new Set(ids);
        set({
          deliveries: get().deliveries.map((d) =>
            idSet.has(d.id)
              ? { ...d, driverName, colorCode: driver?.color ?? null }
              : d
          ),
          selectedDeliveryIds: new Set<string>(),
        });
      },
    }),
    {
      name: "delivery-store",
      partialize: (state) => ({
        drivers: state.drivers,
        areaRules: state.areaRules,
        areaImage: state.areaImage,
        areaDescription: state.areaDescription,
      }),
    }
  )
);
