"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VehicleSpecEditor } from "@/features/settings/components/VehicleSpecEditor";
import { CourseEditor } from "@/features/settings/components/CourseEditor";
import { AreaRuleEditor } from "@/features/settings/components/AreaRuleEditor";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b">
        <h1 className="text-lg font-bold">設定</h1>
        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline" size="sm">アップロード</Button>
          </Link>
          <Link href="/map">
            <Button variant="outline" size="sm">地図に戻る</Button>
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <VehicleSpecEditor />
        <CourseEditor />
        <AreaRuleEditor />
      </main>
    </div>
  );
}
