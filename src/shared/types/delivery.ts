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
  assignReason: string;
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
  { name: "コース1（軽）", color: "#34A853", vehicleType: "light" },  // 緑（Google緑）
  { name: "コース2（軽）", color: "#4285F4", vehicleType: "light" },  // 青（Google青）
  { name: "コース3（軽）", color: "#F9AB00", vehicleType: "light" },  // 黄（Google黄）
  { name: "コース4（軽）", color: "#FF6D01", vehicleType: "light" },  // オレンジ
  { name: "2t-右", color: "#EA4335", vehicleType: "2t" },             // 赤（Google赤）
  { name: "2t-左", color: "#A142F4", vehicleType: "2t" },             // 紫
];
