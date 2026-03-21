"use client";

import { useCallback } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Delivery } from "@/shared/types/delivery";

export function useAutoAssign() {
  const { drivers, areaRules, setDeliveries, setProcessing, clearProcessing } =
    useDeliveryStore();

  const runGeocoding = useCallback(async (items: Delivery[]): Promise<Delivery[]> => {
    setProcessing("住所を変換中...");

    const pendingAddresses = items
      .filter((d) => d.geocodeStatus === "pending" && d.address)
      .map((d) => ({ id: d.id, address: d.address }));

    if (pendingAddresses.length === 0) return items;

    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: pendingAddresses }),
      });
      const data = await res.json();
      const results: Record<string, { lat: number; lng: number } | null> = data.results;

      return items.map((d) => {
        if (d.geocodeStatus !== "pending") return d;
        const result = results[d.address];
        if (result) {
          return { ...d, lat: result.lat, lng: result.lng, geocodeStatus: "success" as const };
        }
        return { ...d, geocodeStatus: "failed" as const };
      });
    } catch {
      return items.map((d) =>
        d.geocodeStatus === "pending" ? { ...d, geocodeStatus: "failed" as const } : d
      );
    }
  }, [setProcessing]);

  const runAssignment = useCallback(async (items: Delivery[]): Promise<Delivery[]> => {
    setProcessing("自動振り分け中...");
    const { areaImage, areaDescription } = useDeliveryStore.getState();

    const unassigned = items.filter((d) => !d.driverName && d.geocodeStatus === "success");
    if (unassigned.length === 0) return items;

    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveries: unassigned, drivers, areaRules, areaImage, areaDescription }),
      });
      const data = await res.json();
      const assignMap = new Map<string, { driverName: string; reason: string }>();
      for (const a of data.assignments) {
        if (a.driverName) assignMap.set(a.deliveryId, { driverName: a.driverName, reason: a.reason || "" });
      }

      return items.map((d) => {
        const assignment = assignMap.get(d.id);
        if (assignment) {
          const driver = drivers.find((dr) => dr.name === assignment.driverName);
          return { ...d, driverName: assignment.driverName, colorCode: driver?.color ?? null, assignReason: assignment.reason };
        }
        return d;
      });
    } catch {
      return items;
    }
  }, [drivers, areaRules, setProcessing]);

  const processAll = useCallback(async (newDeliveries: Delivery[]) => {
    let items = newDeliveries;
    items = await runGeocoding(items);
    items = await runAssignment(items);
    setDeliveries(items);
    clearProcessing();
  }, [runGeocoding, runAssignment, setDeliveries, clearProcessing]);

  return { processAll };
}
