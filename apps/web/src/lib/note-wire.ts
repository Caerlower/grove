import type { NoteView } from "@grove/core";
import { hexToBytes, toHex, type Hex } from "viem";

/** JSON-safe note shape for /api/vault/* responses. */
export type NoteWire = {
  key: string;
  creator: string;
  owner: string;
  contentType: string;
  payloadHex: Hex;
  nid: string;
  vault: string;
  project: string;
  createdat: number;
  th1?: string;
  th2?: string;
  th3?: string;
  expiresAtBlock?: string;
};

export function serializeNote(n: NoteView): NoteWire {
  return {
    key: n.key,
    creator: n.creator,
    owner: n.owner,
    contentType: n.contentType,
    payloadHex: toHex(n.payload),
    nid: n.nid,
    vault: n.vault,
    project: n.project,
    createdat: n.createdat,
    th1: n.th1,
    th2: n.th2,
    th3: n.th3,
    expiresAtBlock:
      n.expiresAtBlock != null ? n.expiresAtBlock.toString() : undefined,
  };
}

export function reviveNote(n: NoteWire): NoteView {
  return {
    key: n.key,
    creator: n.creator,
    owner: n.owner,
    contentType: n.contentType,
    payload: hexToBytes(n.payloadHex),
    nid: n.nid,
    vault: n.vault,
    project: n.project,
    createdat: n.createdat,
    th1: n.th1,
    th2: n.th2,
    th3: n.th3,
    expiresAtBlock:
      n.expiresAtBlock != null ? BigInt(n.expiresAtBlock) : undefined,
  };
}
