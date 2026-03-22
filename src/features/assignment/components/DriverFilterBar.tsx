"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Button } from "@/components/ui/button";

export function DriverFilterBar() {
  const drivers = useDeliveryStore((s) => s.drivers);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const driverFilter = useDeliveryStore((s) => s.driverFilter);
  const setDriverFilter = useDeliveryStore((s) => s.setDriverFilter);
  const toggleDriverFilter = useDeliveryStore((s) => s.toggleDriverFilter);

  const assignedDrivers = [...new Set(deliveries.map((d) => d.driverName).filter(Boolean))];
  const activeDrivers = drivers.filter((d) => assignedDrivers.includes(d.name));
  const unassignedCount = deliveries.filter((d) => !d.driverName).length;

  const isAll = driverFilter === null;
  const isSelected = (name: string) => driverFilter !== null && driverFilter.has(name);

  return (
    <div className="p-3 space-y-2 border-b">
      <p className="text-xs font-medium text-gray-500">ドライバー（複数選択可）</p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={isAll ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => setDriverFilter(null)}
        >
          全員
        </Button>
        {activeDrivers.map((driver) => (
          <Button
            key={driver.name}
            size="sm"
            variant={isSelected(driver.name) ? "default" : "outline"}
            className="text-xs h-7"
            onClick={() => toggleDriverFilter(driver.name)}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full mr-1"
              style={{ backgroundColor: driver.color }}
            />
            {driver.name}
          </Button>
        ))}
        <Button
          size="sm"
          variant={isSelected("__unassigned__") ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => toggleDriverFilter("__unassigned__")}
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-full mr-1"
            style={{ backgroundColor: "#9CA3AF" }}
          />
          未割当（{unassignedCount}）
        </Button>
      </div>
    </div>
  );
}
