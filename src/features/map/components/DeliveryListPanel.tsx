"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function DeliveryListPanel() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const driverFilter = useDeliveryStore((s) => s.driverFilter);
  const selectDelivery = useDeliveryStore((s) => s.selectDelivery);
  const selectedId = useDeliveryStore((s) => s.selectedDeliveryId);

  const filtered = deliveries.filter((d) => {
    if (driverFilter && d.driverName !== driverFilter) return false;
    return true;
  });

  return (
    <div className="border-t">
      <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-600">
        配送先一覧（{filtered.length}件）
      </div>
      <ScrollArea className="h-64">
        {filtered.map((d) => (
          <div
            key={d.id}
            className={`px-4 py-2 border-b cursor-pointer hover:bg-blue-50 text-sm ${
              selectedId === d.id ? "bg-blue-100" : ""
            }`}
            onClick={() => selectDelivery(d.id)}
          >
            <div className="flex items-center gap-2">
              {d.colorCode && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: d.colorCode }}
                />
              )}
              <span className="font-medium truncate">{d.destinationName}</span>
              {d.isUndelivered && <Badge variant="destructive" className="text-xs">未配</Badge>}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{d.address}</p>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
