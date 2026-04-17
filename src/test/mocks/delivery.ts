import { Delivery, Course, VehicleSpec } from "@/shared/types/delivery";

export function createMockDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: "test-id-1",
    factoryName: "テスト工場",
    carrierCode: 100,
    carrierName: "テスト運送",
    destinationCode: 200,
    destinationName: "テスト届先",
    packageCount: 3,
    quantity: 10,
    caseCount: 2,
    assortQuantity: 0,
    actualWeight: 50,
    volume: 120,
    addressCode: 14100,
    address: "神奈川県横浜市戸塚区上矢部町1-1",
    rawAddress: "神奈川県横浜市戸塚区上矢部町１－１",
    deliveryDate: "320",
    slipNumber: 12345678,
    shippingNumber: 87654321,
    shippingCategory: "★県別（関東）",
    slips: [],
    lat: 35.4,
    lng: 139.5,
    courseId: null,
    colorCode: null,
    isUndelivered: false,
    memo: "",
    assignReason: "",
    unassignedReason: "",
    geocodeStatus: "pending",
    ...overrides,
  };
}

export const mockCourses: Course[] = [
  { id: "light-1", name: "軽1", vehicleType: "light", color: "#34A853", defaultRegion: "横浜北部" },
  { id: "light-2", name: "軽2", vehicleType: "light", color: "#4285F4", defaultRegion: "横浜南部" },
  { id: "truck-1", name: "2t1", vehicleType: "2t", color: "#EA4335", defaultRegion: "戸塚・東" },
  { id: "truck-2", name: "2t2", vehicleType: "2t", color: "#A142F4", defaultRegion: "戸塚・西" },
];

export const mockVehicleSpecs: VehicleSpec[] = [
  { vehicleType: "2t", maxVolume: 10000, maxWeight: 2000, maxOrders: 60 },
  { vehicleType: "light", maxVolume: 1500, maxWeight: 350, maxOrders: 40 },
];
