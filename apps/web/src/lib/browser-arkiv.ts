"use client";

import { ExpirationTime } from "@arkiv-network/sdk";
import { getAddress, type Hex } from "viem";
import {
  NOTE_ENDORSED_LIFE_SECONDS,
  agentCreateParams,
  endorsementCreateParams,
  extendToAtLeast,
  sha256Hex,
  shouldExtend,
  type NoteView,
} from "@grove/core";
import { publicConfig } from "./config";
import { loadChainHead } from "./grove-client";

type ArkivWallet = {
  createEntity: (p: unknown) => Promise<{ entityKey: Hex; txHash: Hex }>;
  extendEntity: (p: {
    entityKey: Hex;
    expires: ReturnType<typeof ExpirationTime.fromSeconds>;
  }) => Promise<{ txHash: Hex }>;
};

export async function allowAgentWithWallet(
  wallet: ArkivWallet,
  agentAddr: string,
  label: string,
) {
  const created = await wallet.createEntity(
    agentCreateParams({
      project: publicConfig.project,
      vault: publicConfig.vaultId,
      addr: agentAddr,
      status: "allowed",
      since: Math.floor(Date.now() / 1000),
      label,
    }),
  );
  return created;
}

export async function endorseWithWallet(
  wallet: ArkivWallet,
  note: NoteView,
  decision: "approve" | "reject",
  ownerAddress: string,
) {
  const decidedat = Math.floor(Date.now() / 1000);
  const payloadSha256 = await sha256Hex(note.payload);
  const created = await wallet.createEntity(
    endorsementCreateParams({
      project: publicConfig.project,
      vault: publicConfig.vaultId,
      nid: note.nid,
      decision,
      agent: note.creator,
      decidedat,
      noteKey: note.key,
      payloadSha256,
    }),
  );
  const txHashes: string[] = [created.txHash];

  if (decision === "approve") {
    const head = await loadChainHead();
    if (
      note.expiresAtBlock === undefined ||
      shouldExtend(note.expiresAtBlock, head, NOTE_ENDORSED_LIFE_SECONDS)
    ) {
      const ext = await wallet.extendEntity({
        entityKey: note.key as Hex,
        expires: extendToAtLeast(NOTE_ENDORSED_LIFE_SECONDS),
      });
      txHashes.push(ext.txHash);
    }
  }

  // silence unused — owner must match note.owner
  if (getAddress(note.owner) !== getAddress(ownerAddress)) {
    throw new Error(
      `Connected wallet ${ownerAddress} is not note owner ${note.owner}. Notes must be handed off to your address.`,
    );
  }

  return { endorsementKey: created.entityKey, txHashes };
}
