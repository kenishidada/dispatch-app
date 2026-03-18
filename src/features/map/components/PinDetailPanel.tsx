"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function PinDetailPanel() {
  const selectedId = useDeliveryStore((s) => s.selectedDeliveryId);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const drivers = useDeliveryStore((s) => s.drivers);
  const updateDriverAssignment = useDeliveryStore((s) => s.updateDriverAssignment);
  const toggleUndelivered = useDeliveryStore((s) => s.toggleUndelivered);
  const setMemo = useDeliveryStore((s) => s.setMemo);

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
    { label: "実重量", value: `${delivery.actualWeight} kg` },
    { label: "容積", value: `${delivery.volume} L` },
    { label: "届先住所", value: delivery.address },
    { label: "納品日", value: delivery.deliveryDate },
    { label: "伝票番号", value: `${delivery.slipNumber}` },
    { label: "出荷番号", value: `${delivery.shippingNumber}` },
  ];

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

      <Separator />

      <div>
        <Label className="text-xs text-gray-500">担当ドライバー</Label>
        <Select
          value={delivery.driverName || ""}
          onValueChange={(value: string | null) => { if (value) updateDriverAssignment(delivery.id, value); }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="未割当" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((driver) => (
              <SelectItem key={driver.name} value={driver.name}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: driver.color }}
                  />
                  {driver.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-500">未配</Label>
        <Switch
          checked={delivery.isUndelivered}
          onCheckedChange={() => toggleUndelivered(delivery.id)}
        />
      </div>

      <div>
        <Label className="text-xs text-gray-500">メモ</Label>
        <Input
          className="mt-1"
          value={delivery.memo}
          onChange={(e) => setMemo(delivery.id, e.target.value)}
          placeholder="メモを入力..."
        />
      </div>
    </div>
  );
}
