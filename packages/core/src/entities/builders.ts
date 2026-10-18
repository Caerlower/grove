import { str, u64 } from "@arkiv-network/sdk/attr";
import { ExpirationTime } from "@arkiv-network/sdk";
import {
  AGENT_LIFE_SECONDS,
  AGENT_STATUS,
  DECISION,
  DRAFT_LIFE_SECONDS_DEFAULT,
  ENDORSEMENT_LIFE_SECONDS,
  ENTITY_TYPE,
  JSON_CONTENT_TYPE,
  NOTE_ENDORSED_LIFE_SECONDS,
  SEALED_CONTENT_TYPE,
} from "../constants.js";
import type { NoteContent } from "../types.js";

export type NoteCreateInput = {
  project: string;
  vault: string;
  nid: string;
  sealedPayload: Uint8Array;
  tagHashes: string[];
  createdat: number;
  draftLifeSeconds?: number;
};

export function noteCreateParams(input: NoteCreateInput) {
  const attrs: Record<string, ReturnType<typeof str> | ReturnType<typeof u64>> =
    {
      project: str(input.project),
      type: str(ENTITY_TYPE.note),
      vault: str(input.vault),
      nid: str(input.nid),
      createdat: u64(BigInt(input.createdat)),
    };
  if (input.tagHashes[0]) attrs.th1 = str(input.tagHashes[0]);
  if (input.tagHashes[1]) attrs.th2 = str(input.tagHashes[1]);
  if (input.tagHashes[2]) attrs.th3 = str(input.tagHashes[2]);

  return {
    payload: input.sealedPayload,
    contentType: SEALED_CONTENT_TYPE,
    attributes: attrs,
    expires: ExpirationTime.fromSeconds(
      input.draftLifeSeconds ?? DRAFT_LIFE_SECONDS_DEFAULT,
    ),
  };
}

export type EndorsementCreateInput = {
  project: string;
  vault: string;
  nid: string;
  decision: "approve" | "reject";
  agent: string;
  decidedat: number;
  noteKey: string;
  payloadSha256: string;
};

export function endorsementCreateParams(input: EndorsementCreateInput) {
  const body = {
    noteKey: input.noteKey,
    nid: input.nid,
    payloadSha256: input.payloadSha256,
    decision: input.decision,
    agent: input.agent.toLowerCase(),
    decidedAt: input.decidedat,
  };
  return {
    payload: new TextEncoder().encode(JSON.stringify(body)),
    contentType: JSON_CONTENT_TYPE,
    attributes: {
      project: str(input.project),
      type: str(ENTITY_TYPE.endorsement),
      vault: str(input.vault),
      nid: str(input.nid),
      decision: str(
        input.decision === "approve" ? DECISION.approve : DECISION.reject,
      ),
      agent: str(input.agent.toLowerCase()),
      decidedat: u64(BigInt(input.decidedat)),
    },
    expires: ExpirationTime.fromSeconds(ENDORSEMENT_LIFE_SECONDS),
  };
}

export type AgentCreateInput = {
  project: string;
  vault: string;
  addr: string;
  status: "allowed" | "revoked";
  since: number;
  label: string;
};

export function agentCreateParams(input: AgentCreateInput) {
  return {
    payload: new TextEncoder().encode(JSON.stringify({ label: input.label })),
    contentType: JSON_CONTENT_TYPE,
    attributes: {
      project: str(input.project),
      type: str(ENTITY_TYPE.agent),
      vault: str(input.vault),
      // "addr" is reserved by the Arkiv query language — use agentaddr.
      agentaddr: str(input.addr.toLowerCase()),
      status: str(
        input.status === "allowed" ? AGENT_STATUS.allowed : AGENT_STATUS.revoked,
      ),
      since: u64(BigInt(input.since)),
    },
    expires: ExpirationTime.fromSeconds(AGENT_LIFE_SECONDS),
  };
}

export function endorsedNoteExtendExpires() {
  return ExpirationTime.fromSeconds(NOTE_ENDORSED_LIFE_SECONDS);
}

/** Synthetic demo note content helpers. */
export function syntheticNote(
  title: string,
  body: string,
  tags: string[] = [],
  links: string[] = [],
): NoteContent {
  return { title, body, tags, links };
}
