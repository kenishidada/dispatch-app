"use client";

import { useEffect, useState } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import type { VehicleSpec } from "@/shared/types/delivery";

export function VehicleSpecEditor() {
  const { vehicleSpecs, setVehicleSpecs } = useDeliveryStore();
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/vehicle-specs")
      .then((r) => r.json())
      .then((data: VehicleSpec[]) => {
        if (data.length > 0) setVehicleSpecs(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [setVehicleSpecs]);

  const update = (vehicleType: "light" | "2t", field: keyof VehicleSpec, value: number) => {
    setVehicleSpecs(
      vehicleSpecs.map((s) => (s.vehicleType === vehicleType ? { ...s, [field]: value } : s))
    );
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings/vehicle-specs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehicleSpecs),
    });
    setSaving(false);
  };

  if (!loaded) return <section className="rounded-lg border p-4">読み込み中...</section>;

  return (
    <section className="rounded-lg border p-4 space-y-4">
      <h2 className="font-bold text-lg">車両スペック</h2>
      <p className="text-sm text-gray-500">1台あたりの最大運用値を設定します</p>
      {vehicleSpecs.map((s) => (
        <div key={s.vehicleType} className="grid grid-cols-4 gap-2 items-center">
          <div className="font-medium">{s.vehicleType === "2t" ? "2tトラック" : "軽自動車"}</div>
          <label className="text-sm">
            容積(L)
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={s.maxVolume}
              onChange={(e) => update(s.vehicleType, "maxVolume", Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            重量(kg)
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={s.maxWeight}
              onChange={(e) => update(s.vehicleType, "maxWeight", Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            件数
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={s.maxOrders}
              onChange={(e) => update(s.vehicleType, "maxOrders", Number(e.target.value))}
            />
          </label>
        </div>
      ))}
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        onClick={save}
        disabled={saving}
      >
        {saving ? "保存中..." : "保存"}
      </button>
    </section>
  );
}
