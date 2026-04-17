import { describe, it, expect } from "vitest";
import { normalizeAddress } from "../address";

describe("normalizeAddress", () => {
  it("converts full-width digits to half-width", () => {
    expect(normalizeAddress("横浜市戸塚区１２３")).toBe("横浜市戸塚区123");
  });

  it("converts full-width latin to half-width", () => {
    expect(normalizeAddress("ＡＢＣ横浜")).toBe("ABC横浜");
  });

  it("normalizes various dashes to hyphen", () => {
    expect(normalizeAddress("戸塚1ー2―3‐4－5")).toBe("戸塚1-2-3-4-5");
  });

  it("collapses whitespace", () => {
    expect(normalizeAddress("横浜市  戸塚区   上矢部")).toBe("横浜市 戸塚区 上矢部");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeAddress("  横浜市戸塚区  ")).toBe("横浜市戸塚区");
  });

  it("returns empty for empty input", () => {
    expect(normalizeAddress("")).toBe("");
  });
});
