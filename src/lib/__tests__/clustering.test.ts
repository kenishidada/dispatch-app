import { describe, it, expect } from "vitest";
import { dbscan, haversineKm } from "../clustering";

describe("haversineKm", () => {
  it("returns 0 for same point", () => {
    expect(haversineKm(35.4, 139.5, 35.4, 139.5)).toBeCloseTo(0, 3);
  });

  it("returns ~111km for 1 degree latitude", () => {
    const d = haversineKm(35, 139, 36, 139);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

describe("dbscan", () => {
  it("groups close points into one cluster", () => {
    const points = [
      { id: "a", lat: 35.4000, lng: 139.5000 },
      { id: "b", lat: 35.4001, lng: 139.5001 },
      { id: "c", lat: 35.4002, lng: 139.5002 },
    ];
    const result = dbscan(points, { epsKm: 5, minPts: 2 });
    expect(result.get("a")).toBe(0);
    expect(result.get("b")).toBe(0);
    expect(result.get("c")).toBe(0);
  });

  it("separates distant points into different clusters", () => {
    const points = [
      { id: "a", lat: 35.4, lng: 139.5 },
      { id: "b", lat: 35.4001, lng: 139.5001 },
      { id: "c", lat: 35.6, lng: 139.7 },
      { id: "d", lat: 35.6001, lng: 139.7001 },
    ];
    const result = dbscan(points, { epsKm: 5, minPts: 2 });
    expect(result.get("a")).toBe(result.get("b"));
    expect(result.get("c")).toBe(result.get("d"));
    expect(result.get("a")).not.toBe(result.get("c"));
  });

  it("marks isolated points as noise (-1)", () => {
    const points = [
      { id: "a", lat: 35.4, lng: 139.5 },
      { id: "b", lat: 35.4001, lng: 139.5001 },
      { id: "noise", lat: 36.5, lng: 140.5 },
    ];
    const result = dbscan(points, { epsKm: 5, minPts: 2 });
    expect(result.get("noise")).toBe(-1);
  });
});
