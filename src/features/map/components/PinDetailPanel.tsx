"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function patchDelivery(deliveryId: string, changes: Record<string, unknown>) {
  const sessionId = useDeliveryStore.getState().currentSessionId;
  if (!sessionId) return;
  fetch(`/api/sessions/${sessionId}/deliveries/${deliveryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  }).catch(() => {});
}

export function PinDetailPanel() {
  const selectedId = useDeliveryStore((s) => s.selectedDeliveryId);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const courses = useDeliveryStore((s) => s.courses);
  const updateCourseAssignment = useDeliveryStore((s) => s.updateCourseAssignment);
  const toggleUndelivered = useDeliveryStore((s) => s.toggleUndelivered);
  const setMemo = useDeliveryStore((s) => s.setMemo);
  const updateDelivery = useDeliveryStore((s) => s.updateDelivery);

  const delivery = deliveries.find((d) => d.id === selectedId);

  if (!delivery) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        ピンをクリックすると詳細が表示されます
      </div>
    );
  }

  const readOnlyFields = [
    { label: "届先名", value: delivery.destinationName },
    { label: "個口数", value: `${delivery.packageCount}` },
    { label: "届先住所", value: delivery.address },
    { label: "納品日", value: delivery.deliveryDate },
    { label: "伝票番号", value: `${delivery.slipNumber}` },
    { label: "出荷番号", value: `${delivery.shippingNumber}` },
  ];

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.address)}`;

  return (
    <div className="p-4 space-y-3">
      <h3 className="font-bold text-sm">配送先情報</h3>
      <Separator />

      {readOnlyFields.map((field) => (
        <div key={field.label}>
          <Label className="text-xs text-gray-500">{field.label}</Label>
          <p className="text-sm">{field.value}</p>
        </div>
      ))}

      <div>
        <Label className="text-xs text-gray-500">実重量 (kg)</Label>
        <Input
          className="mt-1"
          type="number"
          value={delivery.actualWeight}
          onChange={(e) => {
            const v = Number(e.target.value);
            updateDelivery(delivery.id, { actualWeight: v });
            patchDelivery(delivery.id, { actualWeight: v });
          }}
        />
      </div>

      <div>
        <Label className="text-xs text-gray-500">容積 (L)</Label>
        <Input
          className="mt-1"
          type="number"
          value={delivery.volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            updateDelivery(delivery.id, { volume: v });
            patchDelivery(delivery.id, { volume: v });
          }}
        />
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-sm text-blue-600 border border-blue-300 rounded px-3 py-1.5 hover:bg-blue-50"
      >
        Googleマップで見る
      </a>

      <Separator />

      <div>
        <Label className="text-xs text-gray-500">担当コース</Label>
        <Select
          value={delivery.courseId ?? ""}
          onValueChange={(value: string | null) => {
            updateCourseAssignment(delivery.id, value ?? null);
            const course = courses.find((c) => c.id === value);
            patchDelivery(delivery.id, { courseId: value ?? null, colorCode: course?.color ?? null });
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="未割当" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: course.color }}
                  />
                  {course.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {delivery.assignReason && (
          <p className="text-xs text-gray-400 mt-1">{delivery.assignReason}</p>
        )}
      </div>

      {delivery.slips && delivery.slips.length > 0 && (
        <table className="text-xs w-full mt-2">
          <thead><tr><th>伝票No</th><th>個口</th><th>容積</th><th>重量</th></tr></thead>
          <tbody>
            {delivery.slips.map((s) => (
              <tr key={s.slipNumber}>
                <td>{s.slipNumber}</td>
                <td>{s.packageCount}</td>
                <td>{s.volume}</td>
                <td>{s.actualWeight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-500">未配</Label>
        <Switch
          checked={delivery.isUndelivered}
          onCheckedChange={() => {
            toggleUndelivered(delivery.id);
            patchDelivery(delivery.id, { isUndelivered: !delivery.isUndelivered });
          }}
        />
      </div>

      <div>
        <Label className="text-xs text-gray-500">メモ</Label>
        <Input
          className="mt-1"
          value={delivery.memo}
          onChange={(e) => {
            setMemo(delivery.id, e.target.value);
            patchDelivery(delivery.id, { memo: e.target.value });
          }}
          placeholder="メモを入力..."
        />
      </div>
    </div>
  );
}
