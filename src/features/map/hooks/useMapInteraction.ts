"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function MapInteractionHandler() {
  const map = useMap();
  const selectedId = useDeliveryStore((s) => s.selectedDeliveryId);
  const deliveries = useDeliveryStore((s) => s.deliveries);

  useEffect(() => {
    if (!selectedId) return;
    const delivery = deliveries.find((d) => d.id === selectedId);
    if (delivery?.lat && delivery?.lng) {
      map.flyTo([delivery.lat, delivery.lng], 14, { duration: 0.5 });
    }
  }, [selectedId, deliveries, map]);

  return null;
}
