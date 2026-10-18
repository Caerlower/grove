import { TRUST, type TrustTier } from "../constants.js";
import type { EndorsementView, TrustStats } from "../types.js";
import { getAddress, isAddress } from "viem";

function normAddr(addr: string): string {
  if (!isAddress(addr)) return addr.toLowerCase();
  return getAddress(addr).toLowerCase();
}

/**
 * Compute trust tier from owner endorsements for one agent.
 * Uses the last WINDOW_SIZE decisions, sorted by decidedat desc.
 */
export function computeTrustTier(
  agentAddress: string,
  endorsements: EndorsementView[],
): TrustStats {
  const agent = normAddr(agentAddress);
  const forAgent = endorsements
    .filter((e) => normAddr(e.agent) === agent)
    .slice()
    .sort((a, b) => b.decidedat - a.decidedat)
    .slice(0, TRUST.WINDOW_SIZE);

  const decisions = forAgent.length;
  const approvals = forAgent.filter((e) => e.decision === "approve").length;
  const rejects = forAgent.filter((e) => e.decision === "reject").length;
  const approvalRate = decisions === 0 ? 0 : approvals / decisions;
  const lastReject = forAgent.find((e) => e.decision === "reject");
  const lastFive = forAgent.slice(0, TRUST.TRUSTED_NO_REJECT_IN_LAST);
  const rejectInLastFive = lastFive.some((e) => e.decision === "reject");

  let tier: TrustTier = "new";

  if (decisions === 0 || decisions <= TRUST.NEW_MAX_DECISIONS) {
    tier = "new";
  } else if (
    approvalRate < TRUST.SUSPENDED_MAX_APPROVAL_RATE ||
    rejectInLastFive
  ) {
    tier = "suspended";
  } else if (
    decisions >= TRUST.TRUSTED_MIN_DECISIONS &&
    approvalRate >= TRUST.TRUSTED_MIN_APPROVAL_RATE &&
    !rejectInLastFive
  ) {
    tier = "trusted";
  } else {
    tier = "new";
  }

  return {
    tier,
    decisions,
    approvals,
    rejects,
    approvalRate,
    lastRejectAt: lastReject?.decidedat,
  };
}

export function computeAllTrust(
  allowlistedAddresses: string[],
  endorsements: EndorsementView[],
): Map<string, TrustStats> {
  const map = new Map<string, TrustStats>();
  for (const addr of allowlistedAddresses) {
    map.set(normAddr(addr), computeTrustTier(addr, endorsements));
  }
  return map;
}
