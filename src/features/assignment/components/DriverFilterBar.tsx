"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Button } from "@/components/ui/button";

export function DriverFilterBar() {
  const drivers = useDeliveryStore((s) => s.drivers);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const driverFilter = useDeliveryStore((s) => s.driverFilter);
  const setDriverFilter = useDeliveryStore((s) => s.setDriverFilter);

  const assignedDrivers = [...new Set(deliveries.map((d) => d.driverName).filter(Boolean))];
  const activeDrivers = drivers.filter((d) => assignedDrivers.includes(d.name));
  const unassignedCount = deliveries.filter((d) => !d.driverName).length;

  return (
    <div className="p-3 space-y-2 border-b">
      <p className="text-xs font-medium text-gray-500">ドライバー</p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={driverFilter === null ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => setDriverFilter(null)}
        >
          全員
        </Button>
        {activeDrivers.map((driver) => (
          <Button
            key={driver.name}
            size="sm"
            variant={driverFilter === driver.name ? "default" : "outline"}
            className="text-xs h-7"
            onClick={() =>
              setDriverFilter(driverFilter === driver.name ? null : driver.name)
            }
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
          variant={driverFilter === "__unassigned__" ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() =>
            setDriverFilter(driverFilter === "__unassigned__" ? null : "__unassigned__")
          }
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
