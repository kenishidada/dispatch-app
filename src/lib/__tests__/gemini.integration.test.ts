import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@google/generative-ai", () => {
  class MockModel {
    async generateContent(prompt: unknown) {
      const text = extractPromptText(prompt);
      return {
        response: {
          text: () => {
            if (text.includes("品質レビュアー")) {
              return JSON.stringify({ corrections: [] });
            }
            if (text.includes("配送ルート振り分け")) {
              const idMatch = text.match(/"id":"([^"]+)"/g) ?? [];
              const ids = idMatch.map((m) => m.match(/"id":"([^"]+)"/)![1]);
              const courseIdMatch = text.match(/^- (light-\d+|truck-\d+)/m);
              const courseId = courseIdMatch ? courseIdMatch[1] : "light-1";
              return JSON.stringify({
                assignments: ids.map((id) => ({ deliveryId: id, courseId, reason: "mock", unassignedReason: "" })),
              });
            }
            return "{}";
          },
        },
      };
    }
  }
  class GoogleGenerativeAI {
    constructor(_apiKey: string) {}
    getGenerativeModel() {
      return new MockModel();
    }
  }
  function extractPromptText(prompt: unknown): string {
    if (typeof prompt === "string") return prompt;
    if (Array.isArray(prompt)) {
      return prompt
        .map((p) => (typeof p === "string" ? p : typeof p === "object" && p && "text" in p ? String((p as { text: unknown }).text) : ""))
        .join("\n");
    }
    if (typeof prompt === "object" && prompt !== null && "text" in prompt) {
      return String((prompt as { text: unknown }).text);
    }
    return "";
  }
  return { GoogleGenerativeAI };
});

import { autoAssign } from "../gemini";
import type { Delivery, Course, VehicleSpec, AreaRule } from "@/shared/types/delivery";

describe("autoAssign integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces log entries for each stage", async () => {
    const courses: Course[] = [
      { id: "light-1", name: "軽1", vehicleType: "light", color: "#000", defaultRegion: "" },
      { id: "truck-1", name: "2t1", vehicleType: "2t", color: "#000", defaultRegion: "" },
    ];
    const specs: VehicleSpec[] = [
      { vehicleType: "light", maxVolume: 4500, maxWeight: 1050, maxOrders: 25 },
      { vehicleType: "2t", maxVolume: 10000, maxWeight: 2000, maxOrders: 10 },
    ];
    const deliveries: Delivery[] = [
      makeD("a", 100, 50, 35.4, 139.5),
      makeD("b", 2000, 200, 35.4001, 139.5001),
    ];
    const rules: AreaRule[] = [];
    const result = await autoAssign(deliveries, courses, ["light-1", "truck-1"], specs, rules, null, "");
    expect(result.assignmentLog.length).toBeGreaterThanOrEqual(5);
    expect(result.assignmentLog.some((e) => e.title === "大口抽出")).toBe(true);
    expect(result.assignmentLog.some((e) => e.title === "クラスタリング")).toBe(true);
    expect(result.assignmentLog.some((e) => e.title === "容量チェック")).toBe(true);
    expect(result.assignments).toHaveLength(2);
  });
});

function makeD(id: string, volume: number, weight: number, lat: number, lng: number): Delivery {
  return {
    id, factoryName: "", carrierCode: 0, carrierName: "",
    destinationCode: 0, destinationName: "",
    packageCount: 0, quantity: 0, caseCount: 0, assortQuantity: 0,
    actualWeight: weight, volume, addressCode: 0, address: "",
    rawAddress: "", slips: [], deliveryDate: "", slipNumber: 0, shippingNumber: 0,
    shippingCategory: "", lat, lng, courseId: null, colorCode: null,
    isUndelivered: false, memo: "", assignReason: "", unassignedReason: "",
    geocodeStatus: "success",
  };
}
