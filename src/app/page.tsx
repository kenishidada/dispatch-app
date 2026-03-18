import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          配送先マッピングシステム
        </h1>
        <p className="text-gray-600 text-lg">
          Excelの配送先リストをアップロードして、地図上で配車管理ができます
        </p>
        <Link href="/upload">
          <Button size="lg" className="text-lg px-8 py-6">
            はじめる
          </Button>
        </Link>
      </div>
    </div>
  );
}
