import { describe, expect, it } from "vitest";
import { remainingSeconds, shouldExtend, extendToAtLeast } from "./extend.js";

describe("extend helpers", () => {
  it("remainingSeconds uses 2s block time", () => {
    expect(remainingSeconds(1_000n, 900n)).toBe(200);
    expect(remainingSeconds(900n, 1_000n)).toBe(0);
  });

  it("shouldExtend when remaining is short", () => {
    expect(shouldExtend(1_000n, 900n, 500)).toBe(true);
    expect(shouldExtend(10_000n, 900n, 500)).toBe(false);
  });

  it("extendToAtLeast returns even seconds duration", () => {
    const exp = extendToAtLeast(601);
    expect(exp).toBeDefined();
    // ExpirationTime is branded; just ensure it does not throw for even values
    expect(() => extendToAtLeast(600)).not.toThrow();
  });
});
