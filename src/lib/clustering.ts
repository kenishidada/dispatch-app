export type ClusterPoint = { id: string; lat: number; lng: number };
export type DbscanOptions = { epsKm: number; minPts: number };

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function dbscan(points: ClusterPoint[], opts: DbscanOptions): Map<string, number> {
  const { epsKm, minPts } = opts;
  const labels = new Map<string, number>();
  const visited = new Set<string>();
  let clusterId = 0;

  const neighbors = (p: ClusterPoint) =>
    points.filter((q) => q.id !== p.id && haversineKm(p.lat, p.lng, q.lat, q.lng) <= epsKm);

  for (const p of points) {
    if (visited.has(p.id)) continue;
    visited.add(p.id);
    const ns = neighbors(p);
    if (ns.length + 1 < minPts) {
      labels.set(p.id, -1);
      continue;
    }
    labels.set(p.id, clusterId);
    const queue = [...ns];
    while (queue.length > 0) {
      const q = queue.shift()!;
      if (!visited.has(q.id)) {
        visited.add(q.id);
        const qns = neighbors(q);
        if (qns.length + 1 >= minPts) queue.push(...qns.filter((x) => !visited.has(x.id)));
      }
      if (!labels.has(q.id) || labels.get(q.id) === -1) labels.set(q.id, clusterId);
    }
    clusterId++;
  }
  return labels;
}
