import type { Delivery, Course, VehicleSpec, CapacityWarning } from "@/shared/types/delivery";

export function getTruckThreshold(vehicleSpecs: VehicleSpec[]): number {
  const lightSpec = vehicleSpecs.find((s) => s.vehicleType === "light");
  return lightSpec ? Math.floor(lightSpec.maxVolume / 3) : 1500;
}

export type AssignmentLite = { deliveryId: string; courseId: string | null };

export type CourseLoad = {
  count: number;
  volume: number;
  weight: number;
};

export function computeLoads(
  assignments: AssignmentLite[],
  deliveries: Delivery[],
  activeCourseIds: string[],
): Map<string, CourseLoad> {
  const deliveryMap = new Map(deliveries.map((d) => [d.id, d]));
  const loads = new Map<string, CourseLoad>();
  for (const cid of activeCourseIds) {
    loads.set(cid, { count: 0, volume: 0, weight: 0 });
  }
  for (const a of assignments) {
    if (!a.courseId) continue;
    const d = deliveryMap.get(a.deliveryId);
    if (!d) continue;
    const l = loads.get(a.courseId);
    if (l) {
      l.count++;
      l.volume += d.volume;
      l.weight += d.actualWeight;
    }
  }
  return loads;
}

export function checkCapacity(
  assignments: AssignmentLite[],
  deliveries: Delivery[],
  courses: Course[],
  vehicleSpecs: VehicleSpec[],
  activeCourseIds: string[]
): CapacityWarning[] {
  const warnings: CapacityWarning[] = [];
  const loads = computeLoads(assignments, deliveries, activeCourseIds);
  for (const courseId of activeCourseIds) {
    const course = courses.find((c) => c.id === courseId);
    if (!course) continue;
    const spec = vehicleSpecs.find((s) => s.vehicleType === course.vehicleType);
    if (!spec) continue;
    const l = loads.get(courseId);
    if (!l) continue;
    if (l.volume > spec.maxVolume) {
      warnings.push({
        courseId, type: "volume", current: l.volume, limit: spec.maxVolume,
        message: `${course.name}: 容積 ${l.volume}/${spec.maxVolume}L (${l.volume - spec.maxVolume}L 超過)`,
      });
    }
    if (l.weight > spec.maxWeight) {
      warnings.push({
        courseId, type: "weight", current: l.weight, limit: spec.maxWeight,
        message: `${course.name}: 重量 ${l.weight}/${spec.maxWeight}kg (${l.weight - spec.maxWeight}kg 超過)`,
      });
    }
    if (l.count > spec.maxOrders) {
      warnings.push({
        courseId, type: "orders", current: l.count, limit: spec.maxOrders,
        message: `${course.name}: 件数 ${l.count}/${spec.maxOrders}件 (${l.count - spec.maxOrders}件 超過)`,
      });
    }
  }
  return warnings;
}

function specFor(courseId: string, courses: Course[], vehicleSpecs: VehicleSpec[]): VehicleSpec | null {
  const course = courses.find((c) => c.id === courseId);
  if (!course) return null;
  return vehicleSpecs.find((s) => s.vehicleType === course.vehicleType) ?? null;
}

function fitsIn(load: CourseLoad, delivery: Delivery, spec: VehicleSpec): boolean {
  return (
    load.count + 1 <= spec.maxOrders &&
    load.volume + delivery.volume <= spec.maxVolume &&
    load.weight + delivery.actualWeight <= spec.maxWeight
  );
}

function overflowScore(load: CourseLoad, spec: VehicleSpec): number {
  return Math.max(
    (load.count - spec.maxOrders) / spec.maxOrders,
    (load.volume - spec.maxVolume) / spec.maxVolume,
    (load.weight - spec.maxWeight) / spec.maxWeight,
    0,
  );
}

export function redistributeOverflow(
  assignments: AssignmentLite[],
  deliveries: Delivery[],
  courses: Course[],
  vehicleSpecs: VehicleSpec[],
  activeCourseIds: string[],
): AssignmentLite[] {
  const result = assignments.map((a) => ({ ...a }));
  const deliveryMap = new Map(deliveries.map((d) => [d.id, d]));
  const loads = computeLoads(result, deliveries, activeCourseIds);

  const MAX_ITERATIONS = 500;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let worstCourse: string | null = null;
    let worstScore = 0;
    for (const cid of activeCourseIds) {
      const spec = specFor(cid, courses, vehicleSpecs);
      if (!spec) continue;
      const load = loads.get(cid)!;
      const score = overflowScore(load, spec);
      if (score > worstScore) {
        worstScore = score;
        worstCourse = cid;
      }
    }
    if (worstScore <= 0 || !worstCourse) break;

    const sourceItems = result
      .filter((a) => a.courseId === worstCourse)
      .map((a) => ({ assignment: a, delivery: deliveryMap.get(a.deliveryId)! }))
      .filter((x) => x.delivery)
      .sort((a, b) => b.delivery.volume - a.delivery.volume);

    let moved = false;
    for (const { assignment, delivery } of sourceItems) {
      let bestTarget: string | null = null;
      let bestRemaining = -Infinity;

      for (const cid of activeCourseIds) {
        if (cid === worstCourse) continue;
        const spec = specFor(cid, courses, vehicleSpecs);
        if (!spec) continue;
        const load = loads.get(cid)!;
        if (!fitsIn(load, delivery, spec)) continue;
        const remaining = spec.maxOrders - load.count - 1;
        if (remaining > bestRemaining) {
          bestRemaining = remaining;
          bestTarget = cid;
        }
      }

      if (bestTarget) {
        const srcLoad = loads.get(worstCourse)!;
        srcLoad.count--;
        srcLoad.volume -= delivery.volume;
        srcLoad.weight -= delivery.actualWeight;
        const dstLoad = loads.get(bestTarget)!;
        dstLoad.count++;
        dstLoad.volume += delivery.volume;
        dstLoad.weight += delivery.actualWeight;
        assignment.courseId = bestTarget;
        moved = true;
        break;
      }
    }

    if (!moved) break;
  }

  return result;
}
