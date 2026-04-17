"use client";

import { v4 as uuidv4 } from "uuid";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import type { Course } from "@/shared/types/delivery";

export function CourseEditor() {
  const { courses, setCourses } = useDeliveryStore();

  const update = (id: string, field: keyof Course, value: string) => {
    setCourses(courses.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const add = (vehicleType: "light" | "2t") => {
    const prefix = vehicleType === "2t" ? "truck" : "light";
    const existingNumbers = courses
      .filter((c) => c.vehicleType === vehicleType)
      .map((c) => {
        // 初期 ID (truck-1) と追加後 ID (truck-3-abcd) の両方に対応
        const m = c.id.match(new RegExp(`^${prefix}-(\\d+)(?:-[a-z0-9]+)?$`));
        return m ? Number(m[1]) : 0;
      });
    const nextNumber = Math.max(0, ...existingNumbers) + 1;
    const newCourse: Course = {
      id: `${prefix}-${nextNumber}-${uuidv4().slice(0, 4)}`,
      name: `${vehicleType === "2t" ? "2t" : "軽"}${nextNumber}`,
      vehicleType,
      color: "#888888",
      defaultRegion: "",
    };
    setCourses([...courses, newCourse]);
  };

  const remove = (id: string) => setCourses(courses.filter((c) => c.id !== id));

  return (
    <section className="rounded-lg border p-4 space-y-4">
      <h2 className="font-bold text-lg">コース管理</h2>
      <div className="space-y-2">
        {courses.map((c) => (
          <div key={c.id} className="grid grid-cols-[100px_120px_1fr_60px_auto] gap-2 items-center">
            <select
              className="border rounded px-2 py-1"
              value={c.vehicleType}
              onChange={(e) => update(c.id, "vehicleType", e.target.value)}
            >
              <option value="light">軽</option>
              <option value="2t">2t</option>
            </select>
            <input
              className="border rounded px-2 py-1"
              value={c.name}
              onChange={(e) => update(c.id, "name", e.target.value)}
              placeholder="コース名"
            />
            <input
              className="border rounded px-2 py-1"
              value={c.defaultRegion}
              onChange={(e) => update(c.id, "defaultRegion", e.target.value)}
              placeholder="担当エリア（例: 横浜北部・川崎）"
            />
            <input
              type="color"
              className="w-full h-8"
              value={c.color}
              onChange={(e) => update(c.id, "color", e.target.value)}
            />
            <button className="text-red-600 text-sm" onClick={() => remove(c.id)} type="button">削除</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="border rounded px-3 py-1 text-sm" onClick={() => add("light")} type="button">+ 軽を追加</button>
        <button className="border rounded px-3 py-1 text-sm" onClick={() => add("2t")} type="button">+ 2tを追加</button>
      </div>
    </section>
  );
}
