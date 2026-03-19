"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function DriverSummary() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const drivers = useDeliveryStore((s) => s.drivers);

  // Build per-driver stats
  const driverStats = new Map<string, { count: number; weight: number; volume: number; color: string }>();

  for (const driver of drivers) {
    driverStats.set(driver.name, { count: 0, weight: 0, volume: 0, color: driver.color });
  }

  let unassigned = { count: 0, weight: 0, volume: 0 };
  let total = { count: 0, weight: 0, volume: 0 };

  for (const d of deliveries) {
    total.count++;
    total.weight += d.actualWeight;
    total.volume += d.volume;

    if (d.driverName && driverStats.has(d.driverName)) {
      const stat = driverStats.get(d.driverName)!;
      stat.count++;
      stat.weight += d.actualWeight;
      stat.volume += d.volume;
    } else {
      unassigned.count++;
      unassigned.weight += d.actualWeight;
      unassigned.volume += d.volume;
    }
  }

  // Only show drivers that have at least 1 delivery
  const activeDriverEntries = Array.from(driverStats.entries()).filter(
    ([, stat]) => stat.count > 0
  );

  if (deliveries.length === 0) return null;

  return (
    <div className="border-b">
      <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-600">
        ドライバー集計
      </div>
      <div className="px-3 py-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left font-medium pb-1">ドライバー</th>
              <th className="text-right font-medium pb-1">件数</th>
              <th className="text-right font-medium pb-1">重量(kg)</th>
              <th className="text-right font-medium pb-1">容積(L)</th>
            </tr>
          </thead>
          <tbody>
            {activeDriverEntries.map(([name, stat]) => (
              <tr key={name}>
                <td className="py-0.5">
                  <span className="flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stat.color }}
                    />
                    <span className="truncate">{name}</span>
                  </span>
                </td>
                <td className="text-right py-0.5">{stat.count}</td>
                <td className="text-right py-0.5">{Math.round(stat.weight)}</td>
                <td className="text-right py-0.5">{Math.round(stat.volume)}</td>
              </tr>
            ))}
            <tr className={unassigned.count > 0 ? "bg-amber-50 text-amber-800" : ""}>
              <td className="py-0.5">
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: "#9CA3AF" }}
                  />
                  <span>未割当</span>
                </span>
              </td>
              <td className="text-right py-0.5">{unassigned.count}</td>
              <td className="text-right py-0.5">{Math.round(unassigned.weight)}</td>
              <td className="text-right py-0.5">{Math.round(unassigned.volume)}</td>
            </tr>
            <tr className="border-t font-medium">
              <td className="py-0.5">合計</td>
              <td className="text-right py-0.5">{total.count}</td>
              <td className="text-right py-0.5">{Math.round(total.weight)}</td>
              <td className="text-right py-0.5">{Math.round(total.volume)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
