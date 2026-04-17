"use client";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function CourseSummary() {
  const { deliveries, courses, vehicleSpecs, activeCourseIds } = useDeliveryStore();
  return (
    <div className="space-y-2">
      {courses.filter((c) => activeCourseIds.includes(c.id)).map((c) => {
        const spec = vehicleSpecs.find((s) => s.vehicleType === c.vehicleType);
        const assigned = deliveries.filter((d) => d.courseId === c.id);
        const vol = assigned.reduce((s, d) => s + d.volume, 0);
        const w = assigned.reduce((s, d) => s + d.actualWeight, 0);
        const cnt = assigned.length;
        const over = (a: number, b: number) => a > b ? "text-red-600 font-bold" : "";
        return (
          <div key={c.id} className="flex items-center gap-3 border rounded px-3 py-2">
            <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
            <span className="font-medium w-16">{c.name}</span>
            <span className={`text-sm ${over(cnt, spec?.maxOrders ?? Infinity)}`}>件数 {cnt}/{spec?.maxOrders}</span>
            <span className={`text-sm ${over(vol, spec?.maxVolume ?? Infinity)}`}>容積 {vol}/{spec?.maxVolume}L</span>
            <span className={`text-sm ${over(w, spec?.maxWeight ?? Infinity)}`}>重量 {w}/{spec?.maxWeight}kg</span>
          </div>
        );
      })}
    </div>
  );
}
