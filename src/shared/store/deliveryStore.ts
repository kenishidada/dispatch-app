import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Delivery, Driver, AreaRule, DEFAULT_DRIVERS } from "@/shared/types/delivery";

type DeliveryStore = {
  deliveries: Delivery[];
  drivers: Driver[];
  areaRules: AreaRule[];
  selectedDeliveryId: string | null;
  driverFilter: string | null;
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
  selectDelivery: (id: string | null) => void;
  setDriverFilter: (driverName: string | null) => void;
  setProcessing: (step: string) => void;
  clearProcessing: () => void;
};

export const useDeliveryStore = create<DeliveryStore>()(
  persist(
    (set, get) => ({
      deliveries: [],
      drivers: DEFAULT_DRIVERS,
      areaRules: [],
      selectedDeliveryId: null,
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
      selectDelivery: (id) => set({ selectedDeliveryId: id }),
      setDriverFilter: (driverName) => set({ driverFilter: driverName }),
      setProcessing: (step) => set({ isProcessing: true, processingStep: step }),
      clearProcessing: () => set({ isProcessing: false, processingStep: "" }),
    }),
    {
      name: "delivery-store",
      partialize: (state) => ({
        drivers: state.drivers,
        areaRules: state.areaRules,
      }),
    }
  )
);
