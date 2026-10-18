import { getAddress, isAddress } from "viem";
import { assertSealedContentType, openNoteContent, sha256Hex } from "../crypto/vault.js";
import type {
  EndorsementView,
  EvaluateCtx,
  GateResult,
  NoteView,
} from "../types.js";

function normAddr(addr: string): string {
  if (!isAddress(addr)) return addr.toLowerCase();
  return getAddress(addr).toLowerCase();
}

function ownerEndorsements(
  endorsements: EndorsementView[],
  owner: string,
): EndorsementView[] {
  const o = normAddr(owner);
  return endorsements.filter((e) => normAddr(e.creator) === o);
}

/**
 * Single trust gate used by MCP, web, and attack demo.
 * Order is fixed — do not reorder without updating tests and arkiv/schema.md.
 */
export async function evaluateNote(
  note: NoteView,
  ctx: EvaluateCtx,
): Promise<GateResult> {
  const warnings: string[] = [];
  const creator = normAddr(note.creator);
  const owner = normAddr(note.owner);
  const vaultOwner = normAddr(ctx.ownerAddress);

  // 1. $creator must be on the live allowlist
  if (!ctx.allowlist.has(creator)) {
    return {
      allow: false,
      reason: "creator_not_allowlisted",
      label: "none",
      warnings,
    };
  }

  // 2. Ownership must have been handed to the vault owner
  if (owner !== vaultOwner) {
    return {
      allow: false,
      reason: "handoff_incomplete",
      label: "none",
      warnings,
    };
  }

  // 3. Payload must be sealed
  if (!assertSealedContentType(note.contentType)) {
    return {
      allow: false,
      reason: "not_sealed",
      label: "none",
      warnings,
    };
  }

  // 4. Must decrypt with vault key
  try {
    await openNoteContent(ctx.vaultKey, note.payload);
  } catch {
    return {
      allow: false,
      reason: "bad_ciphertext",
      label: "none",
      warnings,
    };
  }

  const liveHash = await sha256Hex(note.payload);
  const related = ownerEndorsements(ctx.endorsements, vaultOwner).filter(
    (e) => e.nid === note.nid,
  );

  // 5. Owner reject for this nid
  if (related.some((e) => e.decision === "reject")) {
    return {
      allow: false,
      reason: "owner_rejected",
      label: "none",
      warnings,
    };
  }

  // 6. Owner approve for this nid — bind to payload hash
  const approvals = related.filter((e) => e.decision === "approve");
  if (approvals.length > 0) {
    const matching = approvals.find(
      (e) => e.payloadSha256.toLowerCase() === liveHash.toLowerCase(),
    );
    if (matching) {
      return {
        allow: true,
        reason: "ok",
        label: "endorsed",
        warnings,
      };
    }
    return {
      allow: false,
      reason: "content_differs_from_endorsed_hash",
      label: "none",
      warnings,
    };
  }

  // 7. No endorsement — apply trust tier
  if (ctx.creatorTier === "new" || ctx.creatorTier === "suspended") {
    return {
      allow: false,
      reason: "pending_review",
      label: "none",
      warnings,
    };
  }

  // trusted
  if (ctx.strict) {
    return {
      allow: false,
      reason: "pending_review",
      label: "none",
      warnings: [...warnings, "strict_mode_blocks_unreviewed"],
    };
  }

  return {
    allow: true,
    reason: "ok",
    label: "agent_trusted_unreviewed",
    warnings: [
      ...warnings,
      "Unreviewed note from a trusted agent — treat as provisional.",
    ],
  };
}

/** Wrap agent-facing note text so it is clearly untrusted data, not instructions. */
export function wrapUntrustedNote(content: {
  title: string;
  body: string;
  tags: string[];
  links: string[];
}): string {
  return [
    "<untrusted_note>",
    `title: ${content.title}`,
    `tags: ${content.tags.join(", ") || "(none)"}`,
    `links: ${content.links.join(", ") || "(none)"}`,
    "body:",
    content.body,
    "</untrusted_note>",
  ].join("\n");
}
