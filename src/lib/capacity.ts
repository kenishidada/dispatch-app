import type { Delivery, Course, VehicleSpec, CapacityWarning } from "@/shared/types/delivery";

export function getTruckThreshold(vehicleSpecs: VehicleSpec[]): number {
  const lightSpec = vehicleSpecs.find((s) => s.vehicleType === "light");
  return lightSpec ? Math.floor(lightSpec.maxVolume / 3) : 1500;
}

export type AssignmentLite = { deliveryId: string; courseId: string | null };

export function checkCapacity(
  assignments: AssignmentLite[],
  deliveries: Delivery[],
  courses: Course[],
  vehicleSpecs: VehicleSpec[],
  activeCourseIds: string[]
): CapacityWarning[] {
  const warnings: CapacityWarning[] = [];
  const assignMap = new Map(assignments.map((a) => [a.deliveryId, a.courseId]));
  for (const courseId of activeCourseIds) {
    const course = courses.find((c) => c.id === courseId);
    if (!course) continue;
    const spec = vehicleSpecs.find((s) => s.vehicleType === course.vehicleType);
    if (!spec) continue;
    const assigned = deliveries.filter((d) => assignMap.get(d.id) === courseId);
    const totalVolume = assigned.reduce((s, d) => s + d.volume, 0);
    const totalWeight = assigned.reduce((s, d) => s + d.actualWeight, 0);
    const totalOrders = assigned.length;
    if (totalVolume > spec.maxVolume) {
      warnings.push({
        courseId, type: "volume", current: totalVolume, limit: spec.maxVolume,
        message: `${course.name}: 容積 ${totalVolume}/${spec.maxVolume}L (${totalVolume - spec.maxVolume}L 超過)`,
      });
    }
    if (totalWeight > spec.maxWeight) {
      warnings.push({
        courseId, type: "weight", current: totalWeight, limit: spec.maxWeight,
        message: `${course.name}: 重量 ${totalWeight}/${spec.maxWeight}kg (${totalWeight - spec.maxWeight}kg 超過)`,
      });
    }
    if (totalOrders > spec.maxOrders) {
      warnings.push({
        courseId, type: "orders", current: totalOrders, limit: spec.maxOrders,
        message: `${course.name}: 件数 ${totalOrders}/${spec.maxOrders}件 (${totalOrders - spec.maxOrders}件 超過)`,
      });
    }
  }
  return warnings;
}
