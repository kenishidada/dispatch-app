"use client";

import { useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { DeliveryReport } from "../components/DeliveryReport";

export function usePdfGenerate() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const courses = useDeliveryStore((s) => s.courses);
  const capacityWarnings = useDeliveryStore((s) => s.capacityWarnings);

  const generatePdf = useCallback(async () => {
    const courseFilter = useDeliveryStore.getState().courseFilter;
    let filteredDeliveries = deliveries;

    if (courseFilter !== null) {
      filteredDeliveries = deliveries.filter((d) => {
        if (courseFilter.has("__unassigned__") && d.courseId == null) return true;
        return d.courseId != null && courseFilter.has(d.courseId);
      });
    }

    const today = new Date().toLocaleDateString("ja-JP");
    const doc = DeliveryReport({ deliveries: filteredDeliveries, courses, date: today, capacityWarnings });
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `配送リスト_${today.replace(/\//g, "")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [deliveries, courses, capacityWarnings]);

  return { generatePdf };
}
