import { describe, it, expect } from "vitest";
import { getTruckThreshold, checkCapacity } from "../capacity";
import type { Delivery, Course, VehicleSpec } from "@/shared/types/delivery";

describe("getTruckThreshold", () => {
  it("derives threshold as light maxVolume / 3", () => {
    const specs: VehicleSpec[] = [
      { vehicleType: "light", maxVolume: 4500, maxWeight: 1050, maxOrders: 25 },
      { vehicleType: "2t", maxVolume: 10000, maxWeight: 2000, maxOrders: 10 },
    ];
    expect(getTruckThreshold(specs)).toBe(1500);
  });

  it("falls back to 1500 when light spec missing", () => {
    expect(getTruckThreshold([])).toBe(1500);
  });
});

describe("checkCapacity", () => {
  const courses: Course[] = [
    { id: "light-1", name: "軽1", vehicleType: "light", color: "#000", defaultRegion: "" },
    { id: "truck-1", name: "2t1", vehicleType: "2t", color: "#000", defaultRegion: "" },
  ];
  const specs: VehicleSpec[] = [
    { vehicleType: "light", maxVolume: 4500, maxWeight: 1050, maxOrders: 25 },
    { vehicleType: "2t", maxVolume: 10000, maxWeight: 2000, maxOrders: 10 },
  ];
  function makeDelivery(id: string, volume: number, weight: number): Delivery {
    return {
      id, factoryName: "", carrierCode: 0, carrierName: "",
      destinationCode: 0, destinationName: "", packageCount: 0, quantity: 0,
      caseCount: 0, assortQuantity: 0, actualWeight: weight, volume, addressCode: 0,
      address: "", deliveryDate: "", slipNumber: 0, shippingNumber: 0,
      shippingCategory: "", lat: 0, lng: 0, driverName: null, colorCode: null,
      isUndelivered: false, memo: "", assignReason: "", geocodeStatus: "success",
    };
  }

  it("returns no warnings when within limits", () => {
    const deliveries = [makeDelivery("d1", 1000, 100)];
    const assignments = [{ deliveryId: "d1", courseId: "light-1" }];
    const w = checkCapacity(assignments, deliveries, courses, specs, ["light-1"]);
    expect(w).toHaveLength(0);
  });

  it("reports volume overage", () => {
    const deliveries = [makeDelivery("d1", 5000, 100)];
    const assignments = [{ deliveryId: "d1", courseId: "light-1" }];
    const w = checkCapacity(assignments, deliveries, courses, specs, ["light-1"]);
    expect(w).toHaveLength(1);
    expect(w[0].type).toBe("volume");
    expect(w[0].current).toBe(5000);
    expect(w[0].limit).toBe(4500);
  });

  it("reports order count overage", () => {
    const deliveries = Array.from({ length: 26 }, (_, i) => makeDelivery(`d${i}`, 100, 10));
    const assignments = deliveries.map((d) => ({ deliveryId: d.id, courseId: "light-1" }));
    const w = checkCapacity(assignments, deliveries, courses, specs, ["light-1"]);
    const orders = w.find((x) => x.type === "orders");
    expect(orders).toBeDefined();
    expect(orders!.current).toBe(26);
  });
});
