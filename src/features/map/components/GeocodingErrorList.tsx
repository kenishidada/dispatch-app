"use client";

import { useState } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function GeocodingErrorList() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const [isOpen, setIsOpen] = useState(false);

  const failed = deliveries.filter((d) => d.geocodeStatus === "failed");
  if (failed.length === 0) return null;

  return (
    <div className="px-4 py-1 text-sm">
      <button
        className="text-orange-600 hover:underline"
        onClick={() => setIsOpen(!isOpen)}
      >
        プロット失敗: {failed.length}件 {isOpen ? "▲" : "▼"}
      </button>
      {isOpen && (
        <ul className="mt-1 space-y-1 text-xs text-gray-600 max-h-32 overflow-y-auto">
          {failed.map((d) => (
            <li key={d.id}>
              {d.destinationName} - {d.address}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
