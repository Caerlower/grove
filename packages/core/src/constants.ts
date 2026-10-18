/** Grove schema + trust constants. All attribute names are lowercase. */

export const ENTITY_TYPE = {
  note: "note",
  endorsement: "endorsement",
  agent: "agent",
} as const;

export type EntityType = (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE];

/** Content type for sealed note payloads (arkiv-encryption v1). */
export const SEALED_CONTENT_TYPE = "application/vnd.arkiv.encrypted.v1";

/** Plain JSON for endorsements and agent allowlist entries. */
export const JSON_CONTENT_TYPE = "application/json";

/** Demo draft life: 10 minutes. Production default in docs: 24h. */
export const DRAFT_LIFE_SECONDS_DEFAULT = 10 * 60;
export const NOTE_ENDORSED_LIFE_SECONDS = 30 * 24 * 60 * 60;
export const ENDORSEMENT_LIFE_SECONDS = 90 * 24 * 60 * 60;
export const AGENT_LIFE_SECONDS = 90 * 24 * 60 * 60;

/** Trust tier thresholds (client-side, from owner endorsements). */
export const TRUST = {
  WINDOW_SIZE: 20,
  NEW_MAX_DECISIONS: 4,
  TRUSTED_MIN_DECISIONS: 5,
  TRUSTED_MIN_APPROVAL_RATE: 0.9,
  TRUSTED_NO_REJECT_IN_LAST: 5,
  SUSPENDED_MAX_APPROVAL_RATE: 0.6,
  /** Trusted-agent review sampling: review if sha256(entityKey)[0] % SAMPLE_MOD === 0 */
  SAMPLE_MOD: 3,
  SENSITIVE_TAG: "sensitive",
} as const;

export type TrustTier = "new" | "trusted" | "suspended";

export const DECISION = {
  approve: "approve",
  reject: "reject",
} as const;

export const AGENT_STATUS = {
  allowed: "allowed",
  revoked: "revoked",
} as const;

/** HKDF info label for blind tag index key derivation. */
export const TAG_INDEX_HKDF_INFO = "grove-tag-index";

/** Blind tag hash hex length (characters). */
export const TAG_HASH_HEX_LEN = 16;

/** Opaque note id: 16 hex chars. */
export const NID_HEX_LEN = 16;
