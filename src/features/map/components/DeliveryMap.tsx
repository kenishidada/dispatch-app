"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { DeliveryPin } from "./DeliveryPin";
import { MapInteractionHandler } from "../hooks/useMapInteraction";
import "leaflet/dist/leaflet.css";

export function DeliveryMap() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const driverFilter = useDeliveryStore((s) => s.driverFilter);

  const filteredDeliveries = deliveries.filter((d) => {
    if (d.geocodeStatus !== "success") return false;
    if (driverFilter && d.driverName !== driverFilter) return false;
    return true;
  });

  const center: [number, number] =
    filteredDeliveries.length > 0 && filteredDeliveries[0].lat && filteredDeliveries[0].lng
      ? [filteredDeliveries[0].lat, filteredDeliveries[0].lng]
      : [35.4, 139.5];

  return (
    <MapContainer
      center={center}
      zoom={11}
      className="h-full w-full"
      style={{ minHeight: "500px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {filteredDeliveries.map((delivery) => (
        <DeliveryPin key={delivery.id} delivery={delivery} />
      ))}
      <MapInteractionHandler />
    </MapContainer>
  );
}
