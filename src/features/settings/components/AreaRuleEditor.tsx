"use client";

import { useState, useRef, useCallback, ChangeEvent } from "react";
import { v4 as uuidv4 } from "uuid";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { AreaRule } from "@/shared/types/delivery";

export function AreaRuleEditor() {
  const { courses, areaRules, setAreaRules, areaImages, addAreaImage, removeAreaImage, areaDescription, setAreaDescription } = useDeliveryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);

  const loadImageFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => addAreaImage(reader.result as string);
      reader.readAsDataURL(file);
    });
  }, [addAreaImage]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) loadImageFiles(e.target.files);
    e.target.value = "";
  };

  const [newRegion, setNewRegion] = useState("");
  const [newRuleCourse, setNewRuleCourse] = useState("");

  const updateRule = (id: string, partial: Partial<AreaRule>) => {
    setAreaRules(areaRules.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const addAreaRule = () => {
    if (!newRegion.trim() || !newRuleCourse) return;
    const rule: AreaRule = {
      id: uuidv4(),
      region: newRegion.trim(),
      courseId: newRuleCourse,
    };
    setAreaRules([...areaRules, rule]);
    setNewRegion("");
    setNewRuleCourse("");
  };

  const removeAreaRule = (id: string) => {
    setAreaRules(areaRules.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">エリア設定</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">区割り図をアップロード（複数可・任意）</label>
            <p className="text-xs text-muted-foreground mb-2">アップロードした画像をAIが読み取り、エリアに基づいて配送先を振り分けます。エリアが複数県にまたがる場合は分けて登録できます</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />
            {areaImages.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                {areaImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img} alt={`区割り図 ${i + 1}`} className="w-full max-h-48 object-contain rounded border" />
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white text-red-500 h-6 px-2 text-xs"
                        onClick={() => removeAreaImage(i)}
                      >
                        削除
                      </Button>
                    </div>
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">画像{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
            <div
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files.length > 0) loadImageFiles(e.dataTransfer.files);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <p className="text-sm font-medium text-gray-600">
                {areaImages.length > 0 ? "画像を追加（ドラッグ or クリック）" : "区割り図をドラッグ&ドロップ"}
              </p>
              <p className="text-xs text-gray-400 mt-1">複数選択可（JPG / PNG）</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">エリアルールの説明（任意）</label>
            <Textarea
              rows={7}
              placeholder={"例：\n・コース1: 横浜市東部（鶴見区、神奈川区、中区）\n・コース2: 横浜市南部（港南区、栄区）\n・2tトラックは戸塚を起点に東西で分割"}
              value={areaDescription}
              onChange={(e) => setAreaDescription(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">エリアルール</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>地域</TableHead>
              <TableHead>コース</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areaRules.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.region}</TableCell>
                <TableCell>
                  <Select
                    value={r.courseId ?? ""}
                    onValueChange={(v) => updateRule(r.id, { courseId: v ?? "" })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="コースを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}（{c.vehicleType === "2t" ? "2t" : "軽"}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeAreaRule(r.id)}>
                    削除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex gap-2 mt-4">
          <Input placeholder="地域名（例: 横浜市戸塚区）" value={newRegion} onChange={(e) => setNewRegion(e.target.value)} className="flex-1" />
          <Select value={newRuleCourse} onValueChange={(v) => setNewRuleCourse(v ?? "")}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="コースを選択" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}（{c.vehicleType === "2t" ? "2t" : "軽"}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addAreaRule}>追加</Button>
        </div>
      </Card>
    </div>
  );
}
