"use client";

import { useMemo, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Delivery } from "@/shared/types/delivery";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

function createPinIcon(color: string, isLarge: boolean, isUnassigned: boolean, badge?: string): L.DivIcon {
  const w = isLarge ? 24 : 18;
  const h = isLarge ? 32 : 24;
  const pathAttrs = isUnassigned
    ? `fill="${color}" fill-opacity="0.6" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="3,2"`
    : `fill="${color}" stroke="white" stroke-width="1.5"`;
  const badgeSvg = badge
    ? `<circle cx="19" cy="5" r="5" fill="${badge}" stroke="white" stroke-width="1"/>`
    : "";
  return L.divIcon({
    className: "custom-pin",
    html: `<svg width="${w + 4}" height="${h}" viewBox="-2 0 28 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" ${pathAttrs}/>
      <circle cx="12" cy="11" r="4.5" fill="white" opacity="0.9"/>
      ${badgeSvg}
    </svg>`,
    iconSize: [w + 4, h],
    iconAnchor: [(w + 4) / 2, h],
    popupAnchor: [0, -h],
  });
}

const LARGE_STORE_NAMES = ["島忠", "DCM", "ホームズ", "ケーヨー", "コーナン", "カインズ", "ビバホーム", "ジョイフル本田"];

export function getBadgeColor(delivery: Delivery, allDeliveries: Delivery[]): string | undefined {
  if (delivery.isUndelivered) return "#22c55e";
  const isLargeStore = LARGE_STORE_NAMES.some((name) => delivery.destinationName.includes(name));
  if (isLargeStore) return "#3b82f6";
  const sameAddr = allDeliveries.filter((d) => d.address === delivery.address);
  if (sameAddr.length > 1) return "#eab308";
  return undefined;
}

type Props = {
  delivery: Delivery;
};

export function DeliveryPin({ delivery }: Props) {
  const selectDelivery = useDeliveryStore((s) => s.selectDelivery);
  const updateCourseAssignment = useDeliveryStore((s) => s.updateCourseAssignment);
  const updateDelivery = useDeliveryStore((s) => s.updateDelivery);
  const courses = useDeliveryStore((s) => s.courses);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const markerRef = useRef<L.Marker>(null);

  const color = delivery.colorCode || "#9CA3AF";
  const isLarge = delivery.volume >= 1000;
  const isUnassigned = delivery.courseId == null;
  const badge = useMemo(() => getBadgeColor(delivery, deliveries), [delivery, deliveries]);
  const icon = useMemo(
    () => createPinIcon(color, isLarge, isUnassigned, badge),
    [color, isLarge, isUnassigned, badge]
  );

  if (delivery.lat == null || delivery.lng == null) return null;

  const handleDragEnd = () => {
    const marker = markerRef.current;
    if (!marker) return;
    const pos = marker.getLatLng();
    updateDelivery(delivery.id, { lat: pos.lat, lng: pos.lng });
  };

  return (
    <Marker
      ref={markerRef}
      position={[delivery.lat, delivery.lng]}
      icon={icon}
      draggable
      eventHandlers={{
        click: () => selectDelivery(delivery.id),
        dragend: handleDragEnd,
      }}
    >
      <Popup>
        <div className="text-sm min-w-[200px]">
          <p className="font-bold">{delivery.destinationName}</p>
          <p className="text-gray-600">{delivery.address}</p>
          <p className="text-gray-600">容積: {delivery.volume}L / 重量: {delivery.actualWeight}kg</p>
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-gray-500 mb-1">担当コース</p>
            <select
              value={delivery.courseId ?? ""}
              onChange={(e) => {
                updateCourseAssignment(delivery.id, e.target.value || null);
              }}
              className="w-full text-sm border rounded px-2 py-1 bg-white"
            >
              <option value="">未割当</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
