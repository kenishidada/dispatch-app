"use client";

import { useState } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Button } from "@/components/ui/button";

type CourseLink = {
  courseId: string;
  courseName: string;
  count: number;
  url: string;
  copied: boolean;
};

export function CourseLinkExporter() {
  const [links, setLinks] = useState<CourseLink[] | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const { deliveries, courses } = useDeliveryStore.getState();

    const grouped = new Map<string, typeof deliveries>();
    for (const d of deliveries) {
      if (!d.courseId) continue;
      if (!grouped.has(d.courseId)) grouped.set(d.courseId, []);
      grouped.get(d.courseId)!.push(d);
    }

    const results: CourseLink[] = [];
    for (const [courseId, items] of grouped) {
      const course = courses.find((c) => c.id === courseId);
      if (!course) continue;
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveries: items, courses }),
      });
      const data = await res.json();
      results.push({
        courseId,
        courseName: course.name,
        count: items.length,
        url: `${window.location.origin}/view/${data.sessionId}`,
        copied: false,
      });
    }

    // 軽→2t→名前昇順
    results.sort((a, b) => {
      const ca = courses.find((c) => c.id === a.courseId);
      const cb = courses.find((c) => c.id === b.courseId);
      const ga = ca?.vehicleType === "2t" ? 1 : 0;
      const gb = cb?.vehicleType === "2t" ? 1 : 0;
      if (ga !== gb) return ga - gb;
      return a.courseName.localeCompare(b.courseName, "ja");
    });

    setLinks(results);
    setLoading(false);
  };

  const copyOne = async (idx: number) => {
    if (!links) return;
    await navigator.clipboard.writeText(links[idx].url);
    setLinks(links.map((l, i) => ({ ...l, copied: i === idx ? true : l.copied })));
    setTimeout(() => {
      setLinks((prev) => prev && prev.map((l, i) => ({ ...l, copied: i === idx ? false : l.copied })));
    }, 2000);
  };

  const copyAll = async () => {
    if (!links) return;
    const text = links.map((l) => `${l.courseName}: ${l.url}`).join("\n");
    await navigator.clipboard.writeText(text);
  };

  if (!links) {
    return (
      <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
        {loading ? "生成中..." : "コース別URL出力"}
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setLinks(null)}>
        閉じる
      </Button>
      <div className="absolute right-0 top-8 z-50 bg-white border rounded-lg shadow-lg p-4 w-96 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm">コース別共有URL</span>
          <button className="text-xs text-blue-600 hover:underline" onClick={copyAll}>
            全件コピー
          </button>
        </div>
        {links.map((l, idx) => (
          <div key={l.courseId} className="flex items-center gap-2 text-sm">
            <span className="w-16 font-medium shrink-0">{l.courseName}</span>
            <span className="text-gray-400 text-xs shrink-0">{l.count}件</span>
            <span className="flex-1 truncate text-xs text-gray-600">{l.url}</span>
            <button
              className="shrink-0 text-xs text-blue-600 hover:underline"
              onClick={() => copyOne(idx)}
            >
              {l.copied ? "済" : "コピー"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
