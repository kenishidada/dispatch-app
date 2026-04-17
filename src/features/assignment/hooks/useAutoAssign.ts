"use client";

import { useCallback } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import type { AssignmentLogEntry, CapacityWarning, Delivery } from "@/shared/types/delivery";

type ApiResponse = {
  assignments: { deliveryId: string; courseId: string | null; reason: string; unassignedReason: string }[];
  assignmentLog: AssignmentLogEntry[];
  capacityWarnings: CapacityWarning[];
};

export function useAutoAssign() {
  const setProcessing = useDeliveryStore((s) => s.setProcessing);
  const clearProcessing = useDeliveryStore((s) => s.clearProcessing);
  const setDeliveries = useDeliveryStore((s) => s.setDeliveries);
  const setAssignmentLog = useDeliveryStore((s) => s.setAssignmentLog);
  const setCapacityWarnings = useDeliveryStore((s) => s.setCapacityWarnings);

  const runGeocoding = useCallback(async (items: Delivery[]): Promise<void> => {
    setProcessing("住所を変換中...");
    try {
      const pendingAddresses = items
        .filter((d) => d.geocodeStatus === "pending" && d.address)
        .map((d) => ({ id: d.id, address: d.address }));

      if (pendingAddresses.length === 0) return;

      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: pendingAddresses }),
      });
      const data = await res.json();
      const results: Record<string, { lat: number; lng: number } | null> = data.results;

      const updated = items.map((d) => {
        if (d.geocodeStatus !== "pending") return d;
        const result = results[d.address];
        if (result) {
          return { ...d, lat: result.lat, lng: result.lng, geocodeStatus: "success" as const };
        }
        return { ...d, geocodeStatus: "failed" as const };
      });
      setDeliveries(updated);
    } catch {
      const failed = items.map((d) =>
        d.geocodeStatus === "pending" ? { ...d, geocodeStatus: "failed" as const } : d
      );
      setDeliveries(failed);
    } finally {
      clearProcessing();
    }
  }, [setProcessing, clearProcessing, setDeliveries]);

  const runAssign = useCallback(async (): Promise<void> => {
    const state = useDeliveryStore.getState();
    const { deliveries, courses, activeCourseIds, vehicleSpecs, areaRules, areaImage, areaDescription } = state;
    setProcessing("AIで振り分け中...");
    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveries, courses, activeCourseIds, vehicleSpecs, areaRules, areaImage, areaDescription,
        }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      const courseMap = new Map(courses.map((c) => [c.id, c]));
      const assignMap = new Map(data.assignments.map((a) => [a.deliveryId, a]));
      const updated = deliveries.map((d) => {
        const a = assignMap.get(d.id);
        if (!a) return d;
        const course = a.courseId ? courseMap.get(a.courseId) : null;
        return {
          ...d,
          courseId: a.courseId,
          colorCode: course?.color ?? null,
          assignReason: a.reason,
          unassignedReason: a.unassignedReason,
        };
      });
      setDeliveries(updated);
      setAssignmentLog(data.assignmentLog);
      setCapacityWarnings(data.capacityWarnings);
    } finally {
      clearProcessing();
    }
  }, [setProcessing, clearProcessing, setDeliveries, setAssignmentLog, setCapacityWarnings]);

  return { runGeocoding, runAssign };
}
