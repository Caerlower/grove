import { ExpirationTime } from "@arkiv-network/sdk";

/**
 * Lifetime Extension helper that works whether the chain SETS a new duration
 * from now (documented 0.8 behaviour) or were additive (older rumour).
 *
 * We always ask for `targetSecondsFromNow` as a fresh duration from now via
 * ExpirationTime.fromSeconds. If the current remaining life is already longer,
 * callers should skip the call (probe documents revert-if-not-later).
 *
 * targetSeconds must be a positive even integer (2s block time).
 */
export function extendToAtLeast(targetSecondsFromNow: number) {
  const seconds = Math.max(2, Math.floor(targetSecondsFromNow / 2) * 2);
  return ExpirationTime.fromSeconds(seconds);
}

/**
 * Given current expiresAt block and head block, estimate remaining seconds
 * (Tiramisu block time = 2s). Used to decide whether to extend.
 */
export function remainingSeconds(
  expiresAtBlock: bigint,
  headBlock: bigint,
  blockTimeSeconds = 2,
): number {
  if (expiresAtBlock <= headBlock) return 0;
  return Number(expiresAtBlock - headBlock) * blockTimeSeconds;
}

export function shouldExtend(
  expiresAtBlock: bigint,
  headBlock: bigint,
  targetSecondsFromNow: number,
): boolean {
  return remainingSeconds(expiresAtBlock, headBlock) < targetSecondsFromNow;
}
