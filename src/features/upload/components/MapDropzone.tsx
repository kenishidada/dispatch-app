"use client";

import { useCallback, useState, useImperativeHandle, forwardRef, type ReactNode } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { parseExcelFile } from "../hooks/useExcelParser";
import { useAutoAssign } from "@/features/assignment/hooks/useAutoAssign";

export type MapDropzoneHandle = {
  openFileDialog: () => void;
};

type Props = {
  children: ReactNode;
};

export const MapDropzone = forwardRef<MapDropzoneHandle, Props>(function MapDropzone({ children }, ref) {
  const mergeDeliveries = useDeliveryStore((s) => s.mergeDeliveries);
  const isProcessing = useDeliveryStore((s) => s.isProcessing);
  const processingStep = useDeliveryStore((s) => s.processingStep);
  const { processAll } = useAutoAssign();
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.name.match(/\.xlsx?$/i)) {
        setError("Excelファイル（.xlsx/.xls）を選択してください");
        return;
      }

      useDeliveryStore.getState().setProcessing("Excel解析中...");
      const result = await parseExcelFile(file);

      if (!result.success) {
        setError(result.error);
        useDeliveryStore.getState().clearProcessing();
        return;
      }

      mergeDeliveries(result.deliveries);
      useDeliveryStore.getState().setUploadedFileName(file.name);
      const allDeliveries = useDeliveryStore.getState().deliveries;

      // Background processing - don't await so UI stays interactive
      processAll(allDeliveries).catch(() => {
        useDeliveryStore.getState().clearProcessing();
      });
    },
    [mergeDeliveries, processAll]
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

  useImperativeHandle(ref, () => ({
    openFileDialog: () => document.getElementById("map-file-input")?.click(),
  }));

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div
      data-testid="map-dropzone"
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) {
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      className="relative h-full w-full"
    >
      <input
        id="map-file-input"
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileInput}
        className="hidden"
      />
      {children}

      {isDragOver && (
        <div className="absolute inset-0 z-[1000] bg-blue-500/20 border-4 border-dashed border-blue-500 flex items-center justify-center">
          <div className="bg-white rounded-xl px-8 py-6 shadow-lg text-center pointer-events-none">
            <p className="text-xl font-bold text-blue-600">Excelファイルをドロップ</p>
            <p className="text-sm text-gray-500 mt-1">配送先データを読み込みます</p>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-lg px-6 py-3 flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-sm font-medium text-blue-600">{processingStep}</span>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 border border-red-200 rounded-lg px-6 py-3 flex items-center gap-2">
          <span className="text-sm text-red-700">{error}</span>
          <button
            className="ml-2 text-red-500 hover:text-red-700 font-bold"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
});
