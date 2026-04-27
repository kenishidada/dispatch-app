"use client";

import { useState, useMemo } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { getTruckThreshold } from "@/lib/capacity";

type Props = {
  onConfirm: () => void;
};

export function CapacityInputDialog({ onConfirm }: Props) {
  const { deliveries, courses, vehicleSpecs, activeCourseIds, setActiveCourseIds } = useDeliveryStore();

  const summary = useMemo(() => {
    const threshold = getTruckThreshold(vehicleSpecs);
    const totalVolume = deliveries.reduce((s, d) => s + d.volume, 0);
    const totalWeight = deliveries.reduce((s, d) => s + d.actualWeight, 0);
    const truckCount = deliveries.filter((d) => d.volume >= threshold).length;
    const lightCount = deliveries.length - truckCount;
    return { totalVolume, totalWeight, truckCount, lightCount, threshold };
  }, [deliveries, vehicleSpecs]);

  const [selected, setSelected] = useState<Set<string>>(() => {
    const validPrior = activeCourseIds.filter((id) => courses.some((c) => c.id === id));
    return new Set(validPrior.length > 0 ? validPrior : courses.map((c) => c.id));
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const confirm = () => {
    setActiveCourseIds(Array.from(selected));
    onConfirm();
  };

  const activeLight = courses.filter((c) => c.vehicleType === "light" && selected.has(c.id)).length;
  const activeTruck = courses.filter((c) => c.vehicleType === "2t" && selected.has(c.id)).length;
  const lightSpec = vehicleSpecs.find((s) => s.vehicleType === "light");
  const truckSpec = vehicleSpecs.find((s) => s.vehicleType === "2t");
  const capacityOk =
    activeLight * (lightSpec?.maxOrders ?? 0) + activeTruck * (truckSpec?.maxOrders ?? 0) >= deliveries.length;

  return (
    <div className="space-y-4 p-4 border rounded">
      <h2 className="font-bold text-lg">本日の稼働台数を入力</h2>
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>件数 <span className="font-mono">{deliveries.length}</span></div>
        <div>容積合計 <span className="font-mono">{summary.totalVolume}L</span></div>
        <div>重量合計 <span className="font-mono">{summary.totalWeight}kg</span></div>
        <div>大口(≥{summary.threshold}L)/軽 <span className="font-mono">{summary.truckCount}/{summary.lightCount}</span></div>
      </div>
      <div>
        <h3 className="font-medium mb-2">稼働するコースを選択</h3>
        <div className="grid grid-cols-3 gap-2">
          {courses.map((c) => (
            <label key={c.id} className="flex items-center gap-2 border rounded px-3 py-2">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
              <span>{c.name}</span>
              <span className="text-xs text-gray-500">({c.vehicleType === "2t" ? "2t" : "軽"})</span>
            </label>
          ))}
        </div>
      </div>
      <div className="text-sm">
        容量目安: 軽{activeLight}台 × {lightSpec?.maxOrders}件 + 2t{activeTruck}台 × {truckSpec?.maxOrders}件 = {activeLight * (lightSpec?.maxOrders ?? 0) + activeTruck * (truckSpec?.maxOrders ?? 0)}件
        {!capacityOk && <span className="text-red-600 ml-2">⚠ 件数上限合計が配送件数を下回っています</span>}
      </div>
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        onClick={confirm}
        disabled={selected.size === 0}
        type="button"
      >
        この構成で振り分け実行
      </button>
    </div>
  );
}
