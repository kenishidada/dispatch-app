"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Button } from "@/components/ui/button";

export function CourseFilterBar() {
  const courses = useDeliveryStore((s) => s.courses);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const courseFilter = useDeliveryStore((s) => s.courseFilter);
  const setCourseFilter = useDeliveryStore((s) => s.setCourseFilter);
  const toggleCourseFilter = useDeliveryStore((s) => s.toggleCourseFilter);

  const assignedCourseIds = [...new Set(deliveries.map((d) => d.courseId).filter((id): id is string => !!id))];
  const activeCourses = courses.filter((c) => assignedCourseIds.includes(c.id));
  const unassignedCount = deliveries.filter((d) => !d.courseId).length;

  const isAll = courseFilter === null;
  const isSelected = (id: string) => courseFilter !== null && courseFilter.has(id);

  return (
    <div className="p-3 space-y-2 border-b">
      <p className="text-xs font-medium text-gray-500">コース（複数選択可）</p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={isAll ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => setCourseFilter(null)}
        >
          全員
        </Button>
        {activeCourses.map((course) => (
          <Button
            key={course.id}
            size="sm"
            variant={isSelected(course.id) ? "default" : "outline"}
            className="text-xs h-7"
            onClick={() => toggleCourseFilter(course.id)}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full mr-1"
              style={{ backgroundColor: course.color }}
            />
            {course.name}
          </Button>
        ))}
        <Button
          size="sm"
          variant={isSelected("__unassigned__") ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => toggleCourseFilter("__unassigned__")}
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-full mr-1"
            style={{ backgroundColor: "#9CA3AF" }}
          />
          未割当（{unassignedCount}）
        </Button>
      </div>
    </div>
  );
}
