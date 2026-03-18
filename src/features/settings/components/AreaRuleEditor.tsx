"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Driver, AreaRule } from "@/shared/types/delivery";

export function AreaRuleEditor() {
  const { drivers, setDrivers, areaRules, setAreaRules } = useDeliveryStore();

  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverColor, setNewDriverColor] = useState("#FF6B6B");
  const [newDriverVehicle, setNewDriverVehicle] = useState<"2t" | "light">("light");

  const addDriver = () => {
    if (!newDriverName.trim()) return;
    const newDriver: Driver = {
      name: newDriverName.trim(),
      color: newDriverColor,
      vehicleType: newDriverVehicle,
    };
    setDrivers([...drivers, newDriver]);
    setNewDriverName("");
  };

  const removeDriver = (name: string) => {
    setDrivers(drivers.filter((d) => d.name !== name));
  };

  const [newRegion, setNewRegion] = useState("");
  const [newRuleDriver, setNewRuleDriver] = useState("");
  const [newRuleVehicle, setNewRuleVehicle] = useState<"2t" | "light">("light");

  const addAreaRule = () => {
    if (!newRegion.trim() || !newRuleDriver) return;
    const rule: AreaRule = {
      id: uuidv4(),
      region: newRegion.trim(),
      driverName: newRuleDriver,
      vehicleType: newRuleVehicle,
    };
    setAreaRules([...areaRules, rule]);
    setNewRegion("");
  };

  const removeAreaRule = (id: string) => {
    setAreaRules(areaRules.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">ドライバー管理</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead>色</TableHead>
              <TableHead>車両</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.map((d) => (
              <TableRow key={d.name}>
                <TableCell className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                  {d.name}
                </TableCell>
                <TableCell>{d.color}</TableCell>
                <TableCell>{d.vehicleType === "2t" ? "2tトラック" : "軽自動車"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeDriver(d.name)}>
                    削除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex gap-2 mt-4">
          <Input placeholder="ドライバー名" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} className="flex-1" />
          <Input type="color" value={newDriverColor} onChange={(e) => setNewDriverColor(e.target.value)} className="w-16" />
          <Select value={newDriverVehicle} onValueChange={(v) => setNewDriverVehicle(v as "2t" | "light")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">軽自動車</SelectItem>
              <SelectItem value="2t">2tトラック</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addDriver}>追加</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">エリアルール</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>地域</TableHead>
              <TableHead>ドライバー</TableHead>
              <TableHead>車両</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areaRules.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.region}</TableCell>
                <TableCell>{r.driverName}</TableCell>
                <TableCell>{r.vehicleType === "2t" ? "2tトラック" : "軽自動車"}</TableCell>
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
          <Select value={newRuleDriver} onValueChange={(v) => setNewRuleDriver(v ?? "")}>
            <SelectTrigger className="w-40"><SelectValue placeholder="ドライバー" /></SelectTrigger>
            <SelectContent>
              {drivers.map((d) => (
                <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newRuleVehicle} onValueChange={(v) => setNewRuleVehicle(v as "2t" | "light")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">軽自動車</SelectItem>
              <SelectItem value="2t">2tトラック</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addAreaRule}>追加</Button>
        </div>
      </Card>
    </div>
  );
}
