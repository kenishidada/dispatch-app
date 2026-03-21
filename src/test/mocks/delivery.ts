import { Delivery, Driver } from "@/shared/types/delivery";

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
    deliveryDate: "320",
    slipNumber: 12345678,
    shippingNumber: 87654321,
    shippingCategory: "★県別（関東）",
    lat: 35.4,
    lng: 139.5,
    driverName: null,
    colorCode: null,
    isUndelivered: false,
    memo: "",
    assignReason: "",
    geocodeStatus: "pending",
    ...overrides,
  };
}

export function createMockDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    name: "コース1（軽）",
    color: "#34A853",
    vehicleType: "light",
    ...overrides,
  };
}
