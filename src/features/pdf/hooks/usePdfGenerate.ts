"use client";

import { useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { DeliveryReport } from "../components/DeliveryReport";

export function usePdfGenerate() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const drivers = useDeliveryStore((s) => s.drivers);

  const generatePdf = useCallback(async () => {
    const today = new Date().toLocaleDateString("ja-JP");
    const doc = DeliveryReport({ deliveries, drivers, date: today });
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `配送リスト_${today.replace(/\//g, "")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [deliveries, drivers]);

  return { generatePdf };
}
