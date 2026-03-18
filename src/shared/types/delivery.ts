export type GeoCodeStatus = "success" | "failed" | "pending";

export type Delivery = {
  id: string;
  factoryName: string;
  carrierCode: number;
  carrierName: string;
  destinationCode: number;
  destinationName: string;
  packageCount: number;
  quantity: number;
  caseCount: number;
  assortQuantity: number;
  actualWeight: number;
  volume: number;
  addressCode: number;
  address: string;
  deliveryDate: string;
  slipNumber: number;
  shippingNumber: number;
  shippingCategory: string;
  lat: number | null;
  lng: number | null;
  driverName: string | null;
  colorCode: string | null;
  isUndelivered: boolean;
  memo: string;
  geocodeStatus: GeoCodeStatus;
};

export type Driver = {
  name: string;
  color: string;
  vehicleType: "2t" | "light";
};

export type AreaRule = {
  id: string;
  region: string;
  driverName: string;
  vehicleType: "2t" | "light";
};

export const DEFAULT_DRIVERS: Driver[] = [
  { name: "ドライバー1", color: "#FF6B6B", vehicleType: "light" },
  { name: "ドライバー2", color: "#4ECDC4", vehicleType: "light" },
  { name: "ドライバー3", color: "#45B7D1", vehicleType: "light" },
  { name: "ドライバー4", color: "#96CEB4", vehicleType: "light" },
  { name: "2tドライバーA", color: "#FF8C42", vehicleType: "2t" },
  { name: "2tドライバーB", color: "#6C5CE7", vehicleType: "2t" },
];
