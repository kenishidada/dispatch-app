import type { Delivery, SlipDetail, GeoCodeStatus } from "@/shared/types/delivery";

// ---- DB row types ----

export type DbDeliveryRow = {
  id: string;
  session_id: string;
  factory_name: string;
  carrier_code: number;
  carrier_name: string;
  destination_code: number;
  destination_name: string;
  package_count: number;
  quantity: number;
  case_count: number;
  assort_quantity: number;
  actual_weight: number;
  volume: number;
  address_code: number;
  address: string;
  raw_address: string;
  delivery_date: string;
  slip_number: number;
  shipping_number: number;
  shipping_category: string;
  lat: number | null;
  lng: number | null;
  course_id: string | null;
  color_code: string | null;
  is_undelivered: boolean;
  memo: string;
  assign_reason: string;
  unassigned_reason: string;
  geocode_status: string;
};

export type DbSlipRow = {
  id: string;
  delivery_id: string;
  slip_number: number;
  shipping_number: number;
  package_count: number;
  quantity: number;
  case_count: number;
  assort_quantity: number;
  actual_weight: number;
  volume: number;
  factory_name: string;
};

// ---- DB → Client ----

export function dbSlipToClient(row: DbSlipRow): SlipDetail {
  return {
    slipNumber: row.slip_number,
    shippingNumber: row.shipping_number,
    packageCount: row.package_count,
    quantity: row.quantity,
    caseCount: row.case_count,
    assortQuantity: row.assort_quantity,
    actualWeight: Number(row.actual_weight),
    volume: Number(row.volume),
    factoryName: row.factory_name,
  };
}

export function dbDeliveryToClient(row: DbDeliveryRow, slips: SlipDetail[]): Delivery {
  return {
    id: row.id,
    factoryName: row.factory_name,
    carrierCode: row.carrier_code,
    carrierName: row.carrier_name,
    destinationCode: row.destination_code,
    destinationName: row.destination_name,
    packageCount: row.package_count,
    quantity: row.quantity,
    caseCount: row.case_count,
    assortQuantity: row.assort_quantity,
    actualWeight: Number(row.actual_weight),
    volume: Number(row.volume),
    addressCode: row.address_code,
    address: row.address,
    rawAddress: row.raw_address,
    deliveryDate: row.delivery_date,
    slipNumber: row.slip_number,
    shippingNumber: row.shipping_number,
    shippingCategory: row.shipping_category,
    slips,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    courseId: row.course_id,
    colorCode: row.color_code,
    isUndelivered: row.is_undelivered,
    memo: row.memo,
    assignReason: row.assign_reason,
    unassignedReason: row.unassigned_reason,
    geocodeStatus: row.geocode_status as GeoCodeStatus,
  };
}

// ---- Client → DB insert ----

export function clientDeliveryToDbInsert(
  d: Delivery,
  sessionId: string,
) {
  return {
    session_id: sessionId,
    factory_name: d.factoryName,
    carrier_code: d.carrierCode,
    carrier_name: d.carrierName,
    destination_code: d.destinationCode,
    destination_name: d.destinationName,
    package_count: d.packageCount,
    quantity: d.quantity,
    case_count: d.caseCount,
    assort_quantity: d.assortQuantity,
    actual_weight: d.actualWeight,
    volume: d.volume,
    address_code: d.addressCode,
    address: d.address,
    raw_address: d.rawAddress,
    delivery_date: d.deliveryDate,
    slip_number: d.slipNumber,
    shipping_number: d.shippingNumber,
    shipping_category: d.shippingCategory,
    lat: d.lat,
    lng: d.lng,
    course_id: d.courseId,
    color_code: d.colorCode,
    is_undelivered: d.isUndelivered,
    memo: d.memo,
    assign_reason: d.assignReason,
    unassigned_reason: d.unassignedReason,
    geocode_status: d.geocodeStatus,
  };
}

export function clientSlipToDbInsert(
  s: SlipDetail,
  deliveryId: string,
) {
  return {
    delivery_id: deliveryId,
    slip_number: s.slipNumber,
    shipping_number: s.shippingNumber,
    package_count: s.packageCount,
    quantity: s.quantity,
    case_count: s.caseCount,
    assort_quantity: s.assortQuantity,
    actual_weight: s.actualWeight,
    volume: s.volume,
    factory_name: s.factoryName,
  };
}

// ---- Client partial → DB partial (for PATCH) ----

const FIELD_MAP: Record<string, string> = {
  factoryName: "factory_name",
  carrierCode: "carrier_code",
  carrierName: "carrier_name",
  destinationCode: "destination_code",
  destinationName: "destination_name",
  packageCount: "package_count",
  quantity: "quantity",
  caseCount: "case_count",
  assortQuantity: "assort_quantity",
  actualWeight: "actual_weight",
  volume: "volume",
  addressCode: "address_code",
  address: "address",
  rawAddress: "raw_address",
  deliveryDate: "delivery_date",
  slipNumber: "slip_number",
  shippingNumber: "shipping_number",
  shippingCategory: "shipping_category",
  lat: "lat",
  lng: "lng",
  courseId: "course_id",
  colorCode: "color_code",
  isUndelivered: "is_undelivered",
  memo: "memo",
  assignReason: "assign_reason",
  unassignedReason: "unassigned_reason",
  geocodeStatus: "geocode_status",
};

export function clientPartialToDb(partial: Partial<Delivery>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [clientKey, value] of Object.entries(partial)) {
    const dbKey = FIELD_MAP[clientKey];
    if (dbKey) result[dbKey] = value;
  }
  return result;
}
