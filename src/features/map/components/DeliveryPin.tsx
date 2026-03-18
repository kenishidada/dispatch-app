"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Delivery } from "@/shared/types/delivery";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

function createPinIcon(color: string, isLarge: boolean): L.DivIcon {
  const size = isLarge ? 20 : 14;
  return L.divIcon({
    className: "custom-pin",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type Props = {
  delivery: Delivery;
};

export function DeliveryPin({ delivery }: Props) {
  const selectDelivery = useDeliveryStore((s) => s.selectDelivery);

  if (delivery.lat == null || delivery.lng == null) return null;

  const color = delivery.colorCode || "#9CA3AF";
  const isLarge = delivery.volume >= 1000;
  const icon = createPinIcon(color, isLarge);

  return (
    <Marker
      position={[delivery.lat, delivery.lng]}
      icon={icon}
      eventHandlers={{
        click: () => selectDelivery(delivery.id),
      }}
    >
      <Popup>
        <div className="text-sm">
          <p className="font-bold">{delivery.destinationName}</p>
          <p>{delivery.address}</p>
          <p>容積: {delivery.volume}L / 重量: {delivery.actualWeight}kg</p>
        </div>
      </Popup>
    </Marker>
  );
}
