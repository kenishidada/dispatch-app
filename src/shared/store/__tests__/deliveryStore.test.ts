import { describe, it, expect, beforeEach } from "vitest";
import { useDeliveryStore } from "../deliveryStore";
import { createMockDelivery } from "@/test/mocks/delivery";

describe("deliveryStore", () => {
  beforeEach(() => {
    useDeliveryStore.setState({
      deliveries: [],
      areaRules: [],
      selectedDeliveryId: null,
      selectedDeliveryIds: new Set(),
      isProcessing: false,
      processingStep: "",
    });
  });

  describe("setDeliveries", () => {
    it("stores deliveries", () => {
      const d = createMockDelivery();
      useDeliveryStore.getState().setDeliveries([d]);
      expect(useDeliveryStore.getState().deliveries).toHaveLength(1);
    });
  });

  describe("mergeDeliveries", () => {
    it("keeps undelivered items and merges new data", () => {
      const existing = createMockDelivery({ id: "old", slipNumber: 111, isUndelivered: true });
      const newItem = createMockDelivery({ id: "new", slipNumber: 222 });
      useDeliveryStore.getState().setDeliveries([existing]);
      useDeliveryStore.getState().mergeDeliveries([newItem]);
      const result = useDeliveryStore.getState().deliveries;
      expect(result).toHaveLength(2);
      expect(result.find((d) => d.id === "old")).toBeTruthy();
    });

    it("replaces undelivered items if same slip number in new data", () => {
      const existing = createMockDelivery({ id: "old", slipNumber: 111, isUndelivered: true });
      const newItem = createMockDelivery({ id: "new", slipNumber: 111 });
      useDeliveryStore.getState().setDeliveries([existing]);
      useDeliveryStore.getState().mergeDeliveries([newItem]);
      const result = useDeliveryStore.getState().deliveries;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("new");
    });

    it("discards non-undelivered existing items", () => {
      const existing = createMockDelivery({ id: "old", slipNumber: 111, isUndelivered: false });
      const newItem = createMockDelivery({ id: "new", slipNumber: 222 });
      useDeliveryStore.getState().setDeliveries([existing]);
      useDeliveryStore.getState().mergeDeliveries([newItem]);
      expect(useDeliveryStore.getState().deliveries).toHaveLength(1);
      expect(useDeliveryStore.getState().deliveries[0].id).toBe("new");
    });
  });

  describe("toggleUndelivered", () => {
    it("toggles isUndelivered flag", () => {
      const d = createMockDelivery({ id: "d1", isUndelivered: false });
      useDeliveryStore.getState().setDeliveries([d]);
      useDeliveryStore.getState().toggleUndelivered("d1");
      expect(useDeliveryStore.getState().deliveries[0].isUndelivered).toBe(true);
      useDeliveryStore.getState().toggleUndelivered("d1");
      expect(useDeliveryStore.getState().deliveries[0].isUndelivered).toBe(false);
    });
  });

  describe("setProcessing / clearProcessing", () => {
    it("sets and clears processing state", () => {
      useDeliveryStore.getState().setProcessing("テスト中...");
      expect(useDeliveryStore.getState().isProcessing).toBe(true);
      expect(useDeliveryStore.getState().processingStep).toBe("テスト中...");
      useDeliveryStore.getState().clearProcessing();
      expect(useDeliveryStore.getState().isProcessing).toBe(false);
    });
  });

  describe("selection", () => {
    it("selectDelivery sets selectedDeliveryId", () => {
      useDeliveryStore.getState().selectDelivery("d1");
      expect(useDeliveryStore.getState().selectedDeliveryId).toBe("d1");
    });

    it("toggleSelectDelivery adds and removes from set", () => {
      useDeliveryStore.getState().toggleSelectDelivery("d1");
      expect(useDeliveryStore.getState().selectedDeliveryIds.has("d1")).toBe(true);
      useDeliveryStore.getState().toggleSelectDelivery("d1");
      expect(useDeliveryStore.getState().selectedDeliveryIds.has("d1")).toBe(false);
    });

    it("clearSelection empties the set", () => {
      useDeliveryStore.getState().toggleSelectDelivery("d1");
      useDeliveryStore.getState().toggleSelectDelivery("d2");
      useDeliveryStore.getState().clearSelection();
      expect(useDeliveryStore.getState().selectedDeliveryIds.size).toBe(0);
    });
  });

  describe("setMemo", () => {
    it("sets memo for a delivery", () => {
      const d = createMockDelivery({ id: "d1" });
      useDeliveryStore.getState().setDeliveries([d]);
      useDeliveryStore.getState().setMemo("d1", "テストメモ");
      expect(useDeliveryStore.getState().deliveries[0].memo).toBe("テストメモ");
    });
  });

  describe("bulkAssignCourse", () => {
    it("assigns course to multiple deliveries", () => {
      const d1 = createMockDelivery({ id: "d1" });
      const d2 = createMockDelivery({ id: "d2" });
      const d3 = createMockDelivery({ id: "d3" });
      useDeliveryStore.getState().setDeliveries([d1, d2, d3]);
      useDeliveryStore.getState().bulkAssignCourse(["d1", "d3"], "light-1");
      const deliveries = useDeliveryStore.getState().deliveries;
      expect(deliveries[0].courseId).toBe("light-1");
      expect(deliveries[1].courseId).toBeNull();
      expect(deliveries[2].courseId).toBe("light-1");
    });
  });
});
