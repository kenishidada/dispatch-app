"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { parseExcelFile } from "../hooks/useExcelParser";

export function UploadDropzone() {
  const router = useRouter();
  const { mergeDeliveries, setProcessing, clearProcessing, isProcessing, processingStep } =
    useDeliveryStore();
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.name.match(/\.xlsx?$/i)) {
        setError("Excelファイル（.xlsx/.xls）を選択してください");
        return;
      }

      setProcessing("Excel解析中...");
      const result = await parseExcelFile(file);

      if (!result.success) {
        setError(result.error);
        clearProcessing();
        return;
      }

      mergeDeliveries(result.deliveries);
      setProcessing("完了！地図画面に移動します...");

      setTimeout(() => {
        clearProcessing();
        router.push("/map");
      }, 1000);
    },
    [mergeDeliveries, setProcessing, clearProcessing, router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          配送先データのアップロード
        </h1>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
            ${isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"}
            ${isProcessing ? "pointer-events-none opacity-60" : ""}
          `}
          onClick={() => {
            if (!isProcessing) {
              document.getElementById("file-input")?.click();
            }
          }}
        >
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />

          {isProcessing ? (
            <div className="space-y-3">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-blue-600 font-medium">{processingStep}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-4xl">📁</div>
              <p className="text-lg font-medium text-gray-700">
                Excelファイルをここにドラッグ
              </p>
              <p className="text-sm text-gray-500">
                またはクリックしてファイルを選択
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => document.getElementById("file-input")?.click()}
            disabled={isProcessing}
          >
            ファイルを選択
          </Button>
        </div>
      </Card>
    </div>
  );
}
