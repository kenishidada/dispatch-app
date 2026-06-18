"use client";

import { useCallback } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import type { AssignmentLogEntry, CapacityWarning } from "@/shared/types/delivery";

type ApiResponse = {
  assignments: { deliveryId: string; courseId: string | null; reason: string; unassignedReason: string }[];
  assignmentLog: AssignmentLogEntry[];
  capacityWarnings: CapacityWarning[];
  imageRulesText: string | null;
};

export function useAutoAssign() {
  const setProcessing = useDeliveryStore((s) => s.setProcessing);
  const clearProcessing = useDeliveryStore((s) => s.clearProcessing);
  const setDeliveries = useDeliveryStore((s) => s.setDeliveries);
  const setAssignmentLog = useDeliveryStore((s) => s.setAssignmentLog);
  const setCapacityWarnings = useDeliveryStore((s) => s.setCapacityWarnings);

  const runGeocoding = useCallback(async (): Promise<void> => {
    const sessionId = useDeliveryStore.getState().currentSessionId;
    if (!sessionId) return;

    setProcessing("住所を変換中...");
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error(`Geocode API error ${res.status}`);
      const data = await res.json();
      const updates: { id: string; lat: number | null; lng: number | null; geocodeStatus: string }[] = data.updates;

      if (updates.length > 0) {
        const deliveries = useDeliveryStore.getState().deliveries;
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        const updated = deliveries.map((d) => {
          const u = updateMap.get(d.id);
          if (!u) return d;
          return {
            ...d,
            lat: u.geocodeStatus === "success" ? u.lat : d.lat,
            lng: u.geocodeStatus === "success" ? u.lng : d.lng,
            geocodeStatus: u.geocodeStatus as "success" | "failed",
          };
        });
        setDeliveries(updated);
      }
    } catch {
      const deliveries = useDeliveryStore.getState().deliveries;
      const failed = deliveries.map((d) =>
        d.geocodeStatus === "pending" ? { ...d, geocodeStatus: "failed" as const } : d
      );
      setDeliveries(failed);
    } finally {
      clearProcessing();
    }
  }, [setProcessing, clearProcessing, setDeliveries]);

  const runAssign = useCallback(async (): Promise<void> => {
    const state = useDeliveryStore.getState();
    const { currentSessionId, courses, areaDescription } = state;
    if (!currentSessionId) return;

    setProcessing("AIで振り分け中...");
    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          courses,
          areaDescription,
        }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = (await res.json()) as ApiResponse;

      const deliveries = useDeliveryStore.getState().deliveries;
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
