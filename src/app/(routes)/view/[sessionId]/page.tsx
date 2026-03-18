"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Delivery, Driver } from "@/shared/types/delivery";

// We need a separate map component that takes deliveries as props
// instead of reading from the store
const SharedMap = dynamic(
  () => import("@/features/map/components/SharedMap").then((m) => ({ default: m.SharedMap })),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center">地図を読み込み中...</div> }
);

export default function SharedViewPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [data, setData] = useState<{ deliveries: Delivery[]; drivers: Driver[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share?id=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("データが見つかりません。リンクの有効期限が切れている可能性があります。");
        return res.json();
      })
      .then((d) => setData({ deliveries: d.deliveries || [], drivers: d.drivers || [] }))
      .catch((e) => setError(e.message));
  }, [sessionId]);

  if (error) return <div className="flex min-h-screen items-center justify-center"><p className="text-red-500">{error}</p></div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center"><p>読み込み中...</p></div>;

  return (
    <div className="flex flex-col h-screen">
      <header className="px-4 py-2 bg-white border-b shadow-sm">
        <h1 className="text-lg font-bold">配送先マップ（参照用）</h1>
      </header>
      <div className="flex-1">
        <SharedMap deliveries={data.deliveries} drivers={data.drivers} />
      </div>
    </div>
  );
}
