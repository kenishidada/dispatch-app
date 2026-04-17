"use client";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function CapacityWarningPanel() {
  const { capacityWarnings, setCourseFilter } = useDeliveryStore();
  if (capacityWarnings.length === 0) return null;
  return (
    <section className="rounded border border-amber-400 bg-amber-50 p-3 space-y-2">
      <h3 className="font-bold text-sm text-amber-800">⚠ 上限超過 ({capacityWarnings.length}件)</h3>
      <ul className="text-xs space-y-1">
        {capacityWarnings.map((w, i) => (
          <li key={i}>
            <button
              onClick={() => setCourseFilter(new Set([w.courseId]))}
              className="underline text-amber-900 text-left"
              type="button"
            >
              {w.message}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">超過分は手動で調整してください（振り分けは変更されません）</p>
    </section>
  );
}
