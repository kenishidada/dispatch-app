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
  rawAddress: string;
  deliveryDate: string;
  slipNumber: number;
  shippingNumber: number;
  shippingCategory: string;
  slips: SlipDetail[];
  lat: number | null;
  lng: number | null;
  courseId: string | null;
  colorCode: string | null;
  isUndelivered: boolean;
  memo: string;
  assignReason: string;
  unassignedReason: string;
  geocodeStatus: GeoCodeStatus;
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

export type AreaRule = {
  id: string;
  region: string;
  courseId: string;
};

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
