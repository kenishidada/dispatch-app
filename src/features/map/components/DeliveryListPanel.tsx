"use client";

import { useState } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DeliveryListPanel() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const courseFilter = useDeliveryStore((s) => s.courseFilter);
  const selectDelivery = useDeliveryStore((s) => s.selectDelivery);
  const selectedId = useDeliveryStore((s) => s.selectedDeliveryId);
  const courses = useDeliveryStore((s) => s.courses);
  const selectedDeliveryIds = useDeliveryStore((s) => s.selectedDeliveryIds);
  const toggleSelectDelivery = useDeliveryStore((s) => s.toggleSelectDelivery);
  const selectAllVisible = useDeliveryStore((s) => s.selectAllVisible);
  const clearSelection = useDeliveryStore((s) => s.clearSelection);
  const bulkAssignCourse = useDeliveryStore((s) => s.bulkAssignCourse);

  const [bulkCourse, setBulkCourse] = useState<string>("");

  const filtered = deliveries.filter((d) => {
    if (courseFilter === null) return true;
    if (courseFilter.has("__unassigned__") && d.courseId == null) return true;
    return d.courseId != null && courseFilter.has(d.courseId);
  });

  const unassignedItems = filtered.filter((d) => d.courseId == null && !d.isUndelivered);
  const assignedItems = filtered.filter((d) => d.courseId != null || d.isUndelivered);

  const allItems = [...unassignedItems, ...assignedItems];
  const allSelected = allItems.length > 0 && allItems.every((d) => selectedDeliveryIds.has(d.id));

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAllVisible(allItems.map((d) => d.id));
    }
  };

  const handleBulkAssign = () => {
    if (!bulkCourse || selectedDeliveryIds.size === 0) return;
    bulkAssignCourse(Array.from(selectedDeliveryIds), bulkCourse);
    setBulkCourse("");
  };

  return (
    <div className="border-t">
      <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-600 flex items-center gap-2">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={handleSelectAll}
          className="accent-blue-600"
        />
        <span>配送先一覧（{allItems.length}件）</span>
      </div>

      {selectedDeliveryIds.size > 0 && (
        <div className="px-3 py-2 bg-blue-50 border-b flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-blue-700">
            {selectedDeliveryIds.size}件選択中
          </span>
          <Select value={bulkCourse} onValueChange={(v) => setBulkCourse(v ?? "")}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="コース" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  <span className="flex items-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: course.color }}
                    />
                    {course.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs" onClick={handleBulkAssign} disabled={!bulkCourse}>
            割当
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>
            選択解除
          </Button>
        </div>
      )}

      <ScrollArea className="h-64">
        {unassignedItems.length > 0 && (
          <>
            <div className="px-4 py-1 bg-gray-100 text-xs font-medium text-gray-500 sticky top-0">
              未割当（{unassignedItems.length}件）
            </div>
            {unassignedItems.map((d) => (
              <div
                key={d.id}
                className={`px-4 py-2 border-b cursor-pointer hover:bg-blue-50 text-sm ${
                  selectedId === d.id ? "bg-blue-100" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedDeliveryIds.has(d.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelectDelivery(d.id); }}
                    className="accent-blue-600 flex-shrink-0"
                  />
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: "#9CA3AF" }}
                  />
                  <span className="font-medium truncate flex-1" onClick={() => selectDelivery(d.id)}>
                    {d.destinationName}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5 ml-7" onClick={() => selectDelivery(d.id)}>{d.address}</p>
                {d.unassignedReason && (
                  <p className="text-xs text-amber-600 truncate mt-0.5 ml-7">{d.unassignedReason}</p>
                )}
              </div>
            ))}
          </>
        )}
        {assignedItems.map((d) => (
          <div
            key={d.id}
            className={`px-4 py-2 border-b cursor-pointer hover:bg-blue-50 text-sm ${
              selectedId === d.id ? "bg-blue-100" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedDeliveryIds.has(d.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelectDelivery(d.id);
                }}
                className="accent-blue-600 flex-shrink-0"
              />
              {d.colorCode ? (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: d.colorCode }}
                />
              ) : (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#9CA3AF" }}
                />
              )}
              <span
                className="font-medium truncate flex-1"
                onClick={() => selectDelivery(d.id)}
              >
                {d.destinationName}
              </span>
              {d.isUndelivered && <Badge variant="destructive" className="text-xs">未配</Badge>}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5 ml-7" onClick={() => selectDelivery(d.id)}>{d.address}</p>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
