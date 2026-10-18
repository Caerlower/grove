import { describe, expect, it } from "vitest";
import { computeTrustTier } from "./trust.js";
import type { EndorsementView } from "../types.js";

const AGENT = "0x2222222222222222222222222222222222222222";
const OWNER = "0x1111111111111111111111111111111111111111";

function e(
  decision: "approve" | "reject",
  decidedat: number,
): EndorsementView {
  return {
    key: `0x${decidedat.toString(16).padStart(64, "0")}`,
    creator: OWNER,
    nid: "n",
    decision,
    agent: AGENT,
    decidedat,
    payloadSha256: "abc",
  };
}

describe("computeTrustTier", () => {
  it("new with fewer than 5 decisions", () => {
    const stats = computeTrustTier(AGENT, [
      e("approve", 1),
      e("approve", 2),
      e("approve", 3),
    ]);
    expect(stats.tier).toBe("new");
  });

  it("trusted with 5+ approvals and high rate", () => {
    const list = Array.from({ length: 10 }, (_, i) => e("approve", i + 1));
    const stats = computeTrustTier(AGENT, list);
    expect(stats.tier).toBe("trusted");
    expect(stats.approvalRate).toBe(1);
  });

  it("suspended after recent reject", () => {
    const list = [
      ...Array.from({ length: 9 }, (_, i) => e("approve", i + 1)),
      e("reject", 100),
    ];
    const stats = computeTrustTier(AGENT, list);
    expect(stats.tier).toBe("suspended");
  });

  it("suspended on low approval rate", () => {
    const list = [
      e("approve", 1),
      e("reject", 2),
      e("reject", 3),
      e("reject", 4),
      e("reject", 5),
      e("reject", 6),
    ];
    const stats = computeTrustTier(AGENT, list);
    expect(stats.tier).toBe("suspended");
  });
});
