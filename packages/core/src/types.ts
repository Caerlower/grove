import type { TrustTier } from "./constants.js";

export type NoteContent = {
  title: string;
  body: string;
  tags: string[];
  /** Linked note nids (inside sealed payload — graph shape not public). */
  links: string[];
};

export type GateReason =
  | "creator_not_allowlisted"
  | "handoff_incomplete"
  | "not_sealed"
  | "bad_ciphertext"
  | "owner_rejected"
  | "content_differs_from_endorsed_hash"
  | "pending_review"
  | "ok";

export type GateLabel = "endorsed" | "agent_trusted_unreviewed" | "none";

export type GateResult = {
  allow: boolean;
  reason: GateReason;
  label: GateLabel;
  warnings: string[];
};

export type NoteView = {
  key: string;
  creator: string;
  owner: string;
  contentType: string;
  payload: Uint8Array;
  nid: string;
  vault: string;
  project: string;
  createdat: number;
  th1?: string;
  th2?: string;
  th3?: string;
  expiresAtBlock?: bigint;
};

export type EndorsementView = {
  key: string;
  creator: string;
  nid: string;
  decision: "approve" | "reject";
  agent: string;
  decidedat: number;
  payloadSha256: string;
  noteKey?: string;
};

export type AgentAllowEntry = {
  key: string;
  addr: string;
  status: "allowed" | "revoked";
  since: number;
  label: string;
  creator: string;
};

export type TrustStats = {
  tier: TrustTier;
  decisions: number;
  approvals: number;
  rejects: number;
  approvalRate: number;
  lastRejectAt?: number;
};

export type EvaluateCtx = {
  ownerAddress: string;
  /** Lowercase addresses currently allowed (status=allowed, latest-wins). */
  allowlist: Set<string>;
  /** Endorsements for this note's nid, created by the vault owner. */
  endorsements: EndorsementView[];
  /** Per-agent trust tier for the note's $creator. */
  creatorTier: TrustTier;
  vaultKey: CryptoKey;
  strict: boolean;
};

export type WriteNoteResult = {
  nid: string;
  entityKey: string;
  status: "pending_review" | "handoff_incomplete";
  txHashes: string[];
  payloadSha256: string;
};
