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
      </div>
    </div>
  );
}
