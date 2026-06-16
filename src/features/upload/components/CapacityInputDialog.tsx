"use client";

import { useMemo, useState } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { getTruckThreshold } from "@/lib/capacity";
import type { Course } from "@/shared/types/delivery";

type Props = {
  onConfirm: () => void;
};

const COLOR_PALETTE = [
  "#34A853", "#4285F4", "#F9AB00", "#FF6D01", "#EA4335", "#A142F4",
  "#00ACC1", "#7CB342", "#D81B60", "#5E35B1", "#F4511E", "#6D4C41",
];

// 指定台数を満たすようコースマスタを拡張（既存はそのまま、不足分のみ末尾に生成）
function ensureMaster(existing: Course[], lightN: number, truckM: number): Course[] {
  const result = [...existing];
  const ensure = (vehicleType: "light" | "2t", count: number, prefix: string, label: string) => {
    for (let i = 1; i <= count; i++) {
      const id = `${prefix}-${i}`;
      if (!result.some((c) => c.id === id)) {
        result.push({
          id,
          name: `${label}${i}`,
          vehicleType,
          color: COLOR_PALETTE[result.length % COLOR_PALETTE.length],
          defaultRegion: "",
        });
      }
    }
  };
  ensure("light", lightN, "light", "軽");
  ensure("2t", truckM, "truck", "2t");
  return result;
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 font-medium">{label}</span>
      <button
        type="button"
        className="w-8 h-8 border rounded text-lg leading-none disabled:opacity-40"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
      >
        −
      </button>
      <span className="w-10 text-center font-mono text-lg">{value}</span>
      <button
        type="button"
        className="w-8 h-8 border rounded text-lg leading-none"
        onClick={() => onChange(value + 1)}
      >
        ＋
      </button>
      <span className="text-sm text-gray-500">台</span>
    </div>
  );
}

export function CapacityInputDialog({ onConfirm }: Props) {
  const { deliveries, courses, vehicleSpecs, activeCourseIds, setActiveCourseIds, setCourses } =
    useDeliveryStore();

  const summary = useMemo(() => {
    const threshold = getTruckThreshold(vehicleSpecs);
    const totalVolume = deliveries.reduce((s, d) => s + d.volume, 0);
    const totalWeight = deliveries.reduce((s, d) => s + d.actualWeight, 0);
    const truckCount = deliveries.filter((d) => d.volume >= threshold).length;
    const lightCount = deliveries.length - truckCount;
    return { totalVolume, totalWeight, truckCount, lightCount, threshold };
  }, [deliveries, vehicleSpecs]);

  // 初期台数: 現在の稼働コース数（無ければマスタの台数）
  const initCounts = useMemo(() => {
    const countActive = (vt: "light" | "2t") =>
      activeCourseIds.length > 0
        ? courses.filter((c) => c.vehicleType === vt && activeCourseIds.includes(c.id)).length
        : courses.filter((c) => c.vehicleType === vt).length;
    return { light: countActive("light"), truck: countActive("2t") };
  }, [activeCourseIds, courses]);

  const [lightN, setLightN] = useState(initCounts.light);
  const [truckM, setTruckM] = useState(initCounts.truck);

  const lightSpec = vehicleSpecs.find((s) => s.vehicleType === "light");
  const truckSpec = vehicleSpecs.find((s) => s.vehicleType === "2t");
  const capacityTotal = lightN * (lightSpec?.maxOrders ?? 0) + truckM * (truckSpec?.maxOrders ?? 0);
  const capacityOk = capacityTotal >= deliveries.length;

  const confirm = () => {
    const ensured = ensureMaster(courses, lightN, truckM);
    if (ensured.length !== courses.length) setCourses(ensured);
    const active = [
      ...ensured.filter((c) => c.vehicleType === "light").slice(0, lightN).map((c) => c.id),
      ...ensured.filter((c) => c.vehicleType === "2t").slice(0, truckM).map((c) => c.id),
    ];
    setActiveCourseIds(active);
    onConfirm();
  };

  return (
    <div className="space-y-4 p-4 border rounded">
      <h2 className="font-bold text-lg">本日の稼働台数を入力</h2>
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>件数 <span className="font-mono">{deliveries.length}</span></div>
        <div>容積合計 <span className="font-mono">{summary.totalVolume}L</span></div>
        <div>重量合計 <span className="font-mono">{summary.totalWeight}kg</span></div>
        <div>大口(≥{summary.threshold}L)/軽 <span className="font-mono">{summary.truckCount}/{summary.lightCount}</span></div>
      </div>
      <div className="space-y-2">
        <Stepper label="軽自動車" value={lightN} onChange={setLightN} />
        <Stepper label="2tトラック" value={truckM} onChange={setTruckM} />
      </div>
      <div className="text-sm">
        容量目安: 軽{lightN}台 × {lightSpec?.maxOrders ?? 0}件 + 2t{truckM}台 × {truckSpec?.maxOrders ?? 0}件 = {capacityTotal}件
        {!capacityOk && <span className="text-red-600 ml-2">⚠ 件数上限合計が配送件数を下回っています</span>}
      </div>
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        onClick={confirm}
        disabled={lightN + truckM === 0}
        type="button"
      >
        この構成で振り分け実行
      </button>
    </div>
  );
}
