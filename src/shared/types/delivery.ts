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
  // Phase 1 transitional: optional so v1 persisted deliveries still type-check.
  // Phase 4 will make these required. `courseId: string | null` pattern mirrors `driverName`.
  rawAddress?: string;
  slips?: SlipDetail[];
  courseId?: string | null;
  unassignedReason?: string;
};

export type SlipDetail = {
  slipNumber: number;
  shippingNumber: number;
  packageCount: number;
  quantity: number;
  caseCount: number;
  assortQuantity: number;
  actualWeight: number;
  volume: number;
  factoryName: string;
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
  courseId?: string;
};

export const DEFAULT_DRIVERS: Driver[] = [
  { name: "コース1（軽）", color: "#34A853", vehicleType: "light" },  // 緑（Google緑）
  { name: "コース2（軽）", color: "#4285F4", vehicleType: "light" },  // 青（Google青）
  { name: "コース3（軽）", color: "#F9AB00", vehicleType: "light" },  // 黄（Google黄）
  { name: "コース4（軽）", color: "#FF6D01", vehicleType: "light" },  // オレンジ
  { name: "2t-右", color: "#EA4335", vehicleType: "2t" },             // 赤（Google赤）
  { name: "2t-左", color: "#A142F4", vehicleType: "2t" },             // 紫
];

export type Course = {
  id: string;
  name: string;
  vehicleType: "light" | "2t";
  color: string;
  defaultRegion: string;
};

export type VehicleSpec = {
  vehicleType: "light" | "2t";
  maxVolume: number;
  maxWeight: number;
  maxOrders: number;
};

export type AssignmentLogEntry = {
  step: number;
  title: string;
  message: string;
  timestamp: number;
};

export type CapacityWarning = {
  courseId: string;
  type: "volume" | "weight" | "orders";
  current: number;
  limit: number;
  message: string;
};

export const DEFAULT_COURSES: Course[] = [
  { id: "light-1", name: "軽1", vehicleType: "light", color: "#34A853", defaultRegion: "" },
  { id: "light-2", name: "軽2", vehicleType: "light", color: "#4285F4", defaultRegion: "" },
  { id: "light-3", name: "軽3", vehicleType: "light", color: "#F9AB00", defaultRegion: "" },
  { id: "light-4", name: "軽4", vehicleType: "light", color: "#FF6D01", defaultRegion: "" },
  { id: "truck-1", name: "2t1", vehicleType: "2t", color: "#EA4335", defaultRegion: "" },
  { id: "truck-2", name: "2t2", vehicleType: "2t", color: "#A142F4", defaultRegion: "" },
];

export const DEFAULT_VEHICLE_SPECS: VehicleSpec[] = [
  { vehicleType: "light", maxVolume: 4500, maxWeight: 1050, maxOrders: 25 },
  { vehicleType: "2t", maxVolume: 10000, maxWeight: 2000, maxOrders: 10 },
];
