"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { PinDetailPanel } from "@/features/map/components/PinDetailPanel";
import { DeliveryListPanel } from "@/features/map/components/DeliveryListPanel";
import { GeocodingErrorList } from "@/features/map/components/GeocodingErrorList";
import { DriverFilterBar } from "@/features/assignment/components/DriverFilterBar";
import { usePdfGenerate } from "@/features/pdf/hooks/usePdfGenerate";

const DeliveryMap = dynamic(
  () => import("@/features/map/components/DeliveryMap").then((m) => ({ default: m.DeliveryMap })),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center">地図を読み込み中...</div> }
);

export default function MapPage() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const { generatePdf } = usePdfGenerate();
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleShare = async () => {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveries, drivers: useDeliveryStore.getState().drivers }),
    });
    const data = await res.json();
    const url = `${window.location.origin}/view/${data.sessionId}`;
    await navigator.clipboard.writeText(url);
    setShareUrl(url);
    setTimeout(() => setShareUrl(null), 3000);
  };

  if (deliveries.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-600">配送データがありません</p>
          <Link href="/upload">
            <Button>データをアップロード</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
        <h1 className="text-lg font-bold">配送先マッピングシステム</h1>
        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline" size="sm">データ追加</Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" size="sm">設定</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleShare}>{shareUrl ? "コピーしました!" : "共有リンク生成"}</Button>
          <Button size="sm" onClick={generatePdf}>PDF出力</Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <DeliveryMap />
        </div>
        <div className="w-80 border-l bg-white overflow-y-auto flex flex-col">
          <DriverFilterBar />
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
