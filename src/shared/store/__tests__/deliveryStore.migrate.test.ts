import { describe, it, expect } from "vitest";
import { migrateStore } from "../deliveryStore";

describe("migrateStore v1 -> v2", () => {
  it("converts drivers to courses preserving names and colors", () => {
    const v1 = {
      drivers: [
        { name: "コース1（軽）", color: "#34A853", vehicleType: "light" },
        { name: "2t-右", color: "#EA4335", vehicleType: "2t" },
      ],
      areaRules: [],
      areaImage: null,
      areaDescription: "",
    };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    const courses = result.courses as Array<{ id: string; name: string; vehicleType: string; color: string }>;
    expect(courses).toHaveLength(2);
    expect(courses[0]).toMatchObject({ id: "light-1", name: "コース1（軽）", vehicleType: "light", color: "#34A853" });
    expect(courses[1]).toMatchObject({ id: "truck-1", name: "2t-右", vehicleType: "2t", color: "#EA4335" });
  });

  it("preserves areaImage as areaImages and areaDescription", () => {
    const v1 = {
      drivers: [],
      areaRules: [],
      areaImage: "data:image/png;base64,xxx",
      areaDescription: "横浜は2t",
    };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    expect(result.areaImages).toEqual(["data:image/png;base64,xxx"]);
    expect(result.areaImage).toBeUndefined();
    expect(result.areaDescription).toBe("横浜は2t");
  });

  it("converts areaRules.driverName to courseId", () => {
    const v1 = {
      drivers: [
        { name: "軽1", color: "#000", vehicleType: "light" },
      ],
      areaRules: [
        { id: "r1", region: "横浜", driverName: "軽1" },
      ],
      areaImage: null,
      areaDescription: "",
    };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    const rules = result.areaRules as Array<{ id: string; region: string; courseId: string }>;
    expect(rules[0].courseId).toBe("light-1");
  });

  it("uses DEFAULT_COURSES when drivers empty", () => {
    const v1 = { drivers: [], areaRules: [], areaImage: null, areaDescription: "" };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    const courses = result.courses as unknown[];
    expect(courses.length).toBeGreaterThan(0);
  });

  it("adds default vehicleSpecs", () => {
    const v1 = { drivers: [], areaRules: [], areaImage: null, areaDescription: "" };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    const specs = result.vehicleSpecs as unknown[];
    expect(specs).toHaveLength(2);
  });

  it("returns state unchanged when version >= 3", () => {
    const v3 = { courses: [], vehicleSpecs: [], areaImages: [] };
    expect(migrateStore(v3, 3)).toBe(v3);
  });
});

describe("migrateStore v2 -> v3", () => {
  it("converts single areaImage to areaImages array", () => {
    const v2 = {
      courses: [{ id: "light-1", name: "軽1", vehicleType: "light", color: "#000", defaultRegion: "" }],
      vehicleSpecs: [],
      areaRules: [],
      areaImage: "data:image/png;base64,abc",
      areaDescription: "test",
    };
    const result = migrateStore(v2, 2) as Record<string, unknown>;
    expect(result.areaImages).toEqual(["data:image/png;base64,abc"]);
    expect(result.areaImage).toBeUndefined();
    expect(result.areaDescription).toBe("test");
  });

  it("uses empty array when v2 areaImage is null", () => {
    const v2 = {
      courses: [],
      vehicleSpecs: [],
      areaRules: [],
      areaImage: null,
      areaDescription: "",
    };
    const result = migrateStore(v2, 2) as Record<string, unknown>;
    expect(result.areaImages).toEqual([]);
  });
});
