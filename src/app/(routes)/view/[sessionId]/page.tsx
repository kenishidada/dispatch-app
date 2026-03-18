"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

const DeliveryMap = dynamic(
  () => import("@/features/map/components/DeliveryMap").then((m) => ({ default: m.DeliveryMap })),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center">地図を読み込み中...</div> }
);

export default function SharedViewPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setDeliveries = useDeliveryStore((s) => s.setDeliveries);
  const setDrivers = useDeliveryStore((s) => s.setDrivers);

  useEffect(() => {
    fetch(`/api/share?id=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("データが見つかりません。リンクの有効期限が切れている可能性があります。");
        return res.json();
      })
      .then((data) => {
        setDeliveries(data.deliveries || []);
        if (data.drivers) setDrivers(data.drivers);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [sessionId, setDeliveries, setDrivers]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="px-4 py-2 bg-white border-b shadow-sm">
        <h1 className="text-lg font-bold">配送先マップ（参照用）</h1>
      </header>
      <div className="flex-1">
        <DeliveryMap />
      </div>
    </div>
  );
}
