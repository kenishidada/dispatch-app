"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { PinDetailPanel } from "@/features/map/components/PinDetailPanel";
import { DeliveryListPanel } from "@/features/map/components/DeliveryListPanel";
import { GeocodingErrorList } from "@/features/map/components/GeocodingErrorList";
import { DriverFilterBar } from "@/features/assignment/components/DriverFilterBar";
import { DriverSummary } from "@/features/assignment/components/DriverSummary";
import { usePdfGenerate } from "@/features/pdf/hooks/usePdfGenerate";
import { MapDropzone, type MapDropzoneHandle } from "@/features/upload/components/MapDropzone";

const DeliveryMap = dynamic(
  () => import("@/features/map/components/DeliveryMap").then((m) => ({ default: m.DeliveryMap })),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center">地図を読み込み中...</div> }
);

export default function MapPage() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const isProcessing = useDeliveryStore((s) => s.isProcessing);
  const uploadedFileName = useDeliveryStore((s) => s.uploadedFileName);
  const driverFilter = useDeliveryStore((s) => s.driverFilter);
  const { generatePdf } = usePdfGenerate();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const dropzoneRef = useRef<MapDropzoneHandle>(null);

  const handleShare = async () => {
    const currentFilter = useDeliveryStore.getState().driverFilter;
    let shareDeliveries = deliveries;

    if (currentFilter !== null) {
      shareDeliveries = deliveries.filter((d) => {
        if (currentFilter.has("__unassigned__") && !d.driverName) return true;
        return d.driverName !== null && currentFilter.has(d.driverName);
      });
    }

    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveries: shareDeliveries, drivers: useDeliveryStore.getState().drivers }),
    });
    const data = await res.json();
    const url = `${window.location.origin}/view/${data.sessionId}`;
    await navigator.clipboard.writeText(url);
    setShareUrl(url);
    setTimeout(() => setShareUrl(null), 3000);
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
        <h1 className="text-lg font-bold">
          配送先マッピングシステム
          {uploadedFileName && (
            <span className="text-sm font-normal text-gray-500 ml-2">{uploadedFileName}</span>
          )}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => dropzoneRef.current?.openFileDialog()}>
            データ追加
          </Button>
          <Link href="/settings">
            <Button variant="outline" size="sm">設定</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleShare}>
            {shareUrl ? "コピーしました!" : (driverFilter ? "共有リンク生成（選択中）" : "共有リンク生成（全件）")}
          </Button>
          <Button size="sm" onClick={generatePdf}>
            {driverFilter ? "PDF出力（選択中）" : "PDF出力（全件）"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <MapDropzone ref={dropzoneRef}>
            <DeliveryMap />
            {deliveries.length === 0 && !isProcessing && (
              <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 rounded-xl px-8 py-6 shadow-lg text-center">
                  <p className="text-lg font-medium text-gray-700">Excelファイルをここにドラッグ&ドロップ</p>
                  <p className="text-sm text-gray-500 mt-1">配送先データを読み込んでプロットします</p>
                </div>
              </div>
            )}
          </MapDropzone>
        </div>
        <div className="w-80 border-l bg-white overflow-y-auto flex flex-col">
          <DriverFilterBar />
          <DriverSummary />
          <PinDetailPanel />
          <DeliveryListPanel />
        </div>
      </div>

      <footer className="px-4 py-2 bg-white border-t text-sm text-gray-600">
        <div>全{deliveries.length}件 / 未割当{deliveries.filter((d) => !d.driverName).length}件 / 未配{deliveries.filter((d) => d.isUndelivered).length}件</div>
        <GeocodingErrorList />
      </footer>
    </div>
  );
}
