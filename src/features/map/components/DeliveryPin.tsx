"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Delivery } from "@/shared/types/delivery";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

function createPinIcon(color: string, isLarge: boolean): L.DivIcon {
  const w = isLarge ? 24 : 18;
  const h = isLarge ? 32 : 24;
  return L.divIcon({
    className: "custom-pin",
    html: `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="11" r="4.5" fill="white" opacity="0.9"/>
    </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
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
  const icon = useMemo(() => createPinIcon(color, isLarge), [color, isLarge]);

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
