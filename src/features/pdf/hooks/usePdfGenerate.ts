"use client";

import { useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { DeliveryReport } from "../components/DeliveryReport";

export function usePdfGenerate() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const courses = useDeliveryStore((s) => s.courses);

  const generatePdf = useCallback(async () => {
    const courseFilter = useDeliveryStore.getState().courseFilter;
    let filteredDeliveries = deliveries;

    if (courseFilter !== null) {
      filteredDeliveries = deliveries.filter((d) => {
        if (courseFilter.has("__unassigned__") && d.courseId == null) return true;
        return d.courseId != null && courseFilter.has(d.courseId);
      });
    }

    // 日付は配送データの納品日（最頻値）を採用。無ければ実行日。
    const dateCounts = new Map<string, number>();
    for (const d of filteredDeliveries) {
      if (d.deliveryDate) dateCounts.set(d.deliveryDate, (dateCounts.get(d.deliveryDate) ?? 0) + 1);
    }
    let dataDate = "";
    let maxCount = 0;
    for (const [dt, n] of dateCounts) {
      if (n > maxCount) {
        maxCount = n;
        dataDate = dt;
      }
    }
    const fallback = new Date().toLocaleDateString("ja-JP");
    const displayDate = dataDate || fallback;
    const fileDate = (dataDate || fallback).replace(/\D/g, "");

    const doc = DeliveryReport({ deliveries: filteredDeliveries, courses, date: displayDate });
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `配送リスト_${fileDate}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [deliveries, courses]);

  return { generatePdf };
}
