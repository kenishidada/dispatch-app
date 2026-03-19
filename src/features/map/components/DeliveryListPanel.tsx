"use client";

import { useState } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DeliveryListPanel() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const driverFilter = useDeliveryStore((s) => s.driverFilter);
  const selectDelivery = useDeliveryStore((s) => s.selectDelivery);
  const selectedId = useDeliveryStore((s) => s.selectedDeliveryId);
  const drivers = useDeliveryStore((s) => s.drivers);
  const selectedDeliveryIds = useDeliveryStore((s) => s.selectedDeliveryIds);
  const toggleSelectDelivery = useDeliveryStore((s) => s.toggleSelectDelivery);
  const selectAllVisible = useDeliveryStore((s) => s.selectAllVisible);
  const clearSelection = useDeliveryStore((s) => s.clearSelection);
  const bulkAssignDriver = useDeliveryStore((s) => s.bulkAssignDriver);

  const [bulkDriver, setBulkDriver] = useState<string>("");

  const filtered = deliveries.filter((d) => {
    if (driverFilter === null) return true;
    if (driverFilter === "__unassigned__") return !d.driverName;
    return d.driverName === driverFilter;
  });

  const allSelected = filtered.length > 0 && filtered.every((d) => selectedDeliveryIds.has(d.id));

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAllVisible(filtered.map((d) => d.id));
    }
  };

  const handleBulkAssign = () => {
    if (!bulkDriver || selectedDeliveryIds.size === 0) return;
    bulkAssignDriver(Array.from(selectedDeliveryIds), bulkDriver);
    setBulkDriver("");
  };

  return (
    <div className="border-t">
      <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-600 flex items-center gap-2">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={handleSelectAll}
          className="accent-blue-600"
        />
        <span>配送先一覧（{filtered.length}件）</span>
      </div>

      {selectedDeliveryIds.size > 0 && (
        <div className="px-3 py-2 bg-blue-50 border-b flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-blue-700">
            {selectedDeliveryIds.size}件選択中
          </span>
          <Select value={bulkDriver} onValueChange={(v) => setBulkDriver(v ?? "")}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="ドライバー" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver) => (
                <SelectItem key={driver.name} value={driver.name}>
                  <span className="flex items-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: driver.color }}
                    />
                    {driver.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs" onClick={handleBulkAssign} disabled={!bulkDriver}>
            割当
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>
            選択解除
          </Button>
        </div>
      )}

      <ScrollArea className="h-64">
        {filtered.map((d) => (
          <div
            key={d.id}
            className={`px-4 py-2 border-b cursor-pointer hover:bg-blue-50 text-sm ${
              selectedId === d.id ? "bg-blue-100" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedDeliveryIds.has(d.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelectDelivery(d.id);
                }}
                className="accent-blue-600 flex-shrink-0"
              />
              {d.colorCode ? (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: d.colorCode }}
                />
              ) : (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#9CA3AF" }}
                />
              )}
              <span
                className="font-medium truncate flex-1"
                onClick={() => selectDelivery(d.id)}
              >
                {d.destinationName}
              </span>
              {d.isUndelivered && <Badge variant="destructive" className="text-xs">未配</Badge>}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5 ml-7" onClick={() => selectDelivery(d.id)}>{d.address}</p>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
