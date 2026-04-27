import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCachedImageRules, setCachedImageRules } from "../imageCache";

describe("getCachedImageRules", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    });
  });

  it("returns null when not cached", async () => {
    const { cached } = await getCachedImageRules(["data:image/png;base64,xxx"], [{ id: "light-1", name: "軽1" }]);
    expect(cached).toBeNull();
  });

  it("returns cached value after set", async () => {
    const { key } = await getCachedImageRules(["data:image/png;base64,xxx"], [{ id: "light-1", name: "軽1" }]);
    setCachedImageRules(key, "rules-text");
    const { cached } = await getCachedImageRules(["data:image/png;base64,xxx"], [{ id: "light-1", name: "軽1" }]);
    expect(cached).toBe("rules-text");
  });

  it("changes key when courses change", async () => {
    const a = await getCachedImageRules(["data:image/png;base64,xxx"], [{ id: "a", name: "A" }]);
    const b = await getCachedImageRules(["data:image/png;base64,xxx"], [{ id: "b", name: "B" }]);
    expect(a.key).not.toBe(b.key);
  });

  it("changes key when image changes", async () => {
    const a = await getCachedImageRules(["data:image/png;base64,xxx"], [{ id: "a", name: "A" }]);
    const b = await getCachedImageRules(["data:image/png;base64,yyy"], [{ id: "a", name: "A" }]);
    expect(a.key).not.toBe(b.key);
  });

  it("changes key when image count changes", async () => {
    const a = await getCachedImageRules(["data:image/png;base64,xxx"], [{ id: "a", name: "A" }]);
    const b = await getCachedImageRules(
      ["data:image/png;base64,xxx", "data:image/png;base64,yyy"],
      [{ id: "a", name: "A" }]
    );
    expect(a.key).not.toBe(b.key);
  });

  it("differentiates image order", async () => {
    const a = await getCachedImageRules(
      ["data:image/png;base64,xxx", "data:image/png;base64,yyy"],
      [{ id: "a", name: "A" }]
    );
    const b = await getCachedImageRules(
      ["data:image/png;base64,yyy", "data:image/png;base64,xxx"],
      [{ id: "a", name: "A" }]
    );
    expect(a.key).not.toBe(b.key);
  });
});
