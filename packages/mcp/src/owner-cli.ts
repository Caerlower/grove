#!/usr/bin/env node
/**
 * grove-owner CLI — pending | approve | reject | allow | revoke | extend
 */
import {
  TRUST,
  computeTrustTier,
  createGrovePublicClient,
  endorseNote,
  allowAgent,
  extendNoteLife,
  fetchAllEndorsements,
  fetchAllowlist,
  fetchNoteByNid,
  fetchNotesByCreator,
  importVaultKey,
  openNoteContent,
  shouldSampleForReview,
  NOTE_ENDORSED_LIFE_SECONDS,
} from "@grove/core";
import { getAddress, type Hex } from "viem";
import { loadGroveEnv } from "./env.js";

async function main() {
  const [cmd, arg, ...rest] = process.argv.slice(2);
  const env = loadGroveEnv();
  if (!env.ownerPrivateKey) {
    console.error("OWNER_PRIVATE_KEY required");
    process.exit(1);
  }
  const publicClient = createGrovePublicClient(env.cfg.rpcUrl);

  switch (cmd) {
    case "pending": {
      const allow = await fetchAllowlist(publicClient, env.cfg);
      const endorsements = await fetchAllEndorsements(publicClient, env.cfg);
      const vaultKey = await importVaultKey(env.vaultKeyRaw);
      const queue: Array<Record<string, unknown>> = [];

      for (const agent of allow) {
        const stats = computeTrustTier(agent.addr, endorsements);
        const notes = await fetchNotesByCreator(
          publicClient,
          env.cfg,
          getAddress(agent.addr),
        );
        for (const note of notes) {
          if (getAddress(note.owner) !== getAddress(env.cfg.ownerAddress)) {
            continue;
          }
          const related = endorsements.filter((e) => e.nid === note.nid);
          if (related.some((e) => e.decision === "approve" || e.decision === "reject")) {
            continue;
          }

          let content;
          try {
            content = await openNoteContent(vaultKey, note.payload);
          } catch {
            continue;
          }

          const sensitive = content.tags
            .map((t) => t.toLowerCase())
            .includes(TRUST.SENSITIVE_TAG);
          if (stats.tier === "trusted") {
            if (!sensitive && !shouldSampleForReview(note.key, TRUST.SAMPLE_MOD)) {
              continue;
            }
          }

          queue.push({
            nid: note.nid,
            key: note.key,
            creator: note.creator,
            tier: stats.tier,
            title: content.title,
            expiresAt: note.expiresAtBlock?.toString(),
            sampleReason: sensitive
              ? "sensitive_tag"
              : stats.tier === "trusted"
                ? "deterministic_sample"
                : "untrusted_or_new",
          });
        }
      }
      console.log(JSON.stringify({ pending: queue }, null, 2));
      break;
    }
    case "approve":
    case "reject": {
      if (!arg) {
        console.error(`usage: grove-owner ${cmd} <nid>`);
        process.exit(1);
      }
      const note = await fetchNoteByNid(publicClient, env.cfg, arg);
      if (!note) {
        console.error("note not found");
        process.exit(1);
      }
      const result = await endorseNote({
        rpcUrl: env.cfg.rpcUrl,
        ownerPrivateKey: env.ownerPrivateKey,
        cfg: env.cfg,
        note,
        decision: cmd === "approve" ? "approve" : "reject",
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "allow": {
      if (!arg) {
        console.error("usage: grove-owner allow <addr> [label]");
        process.exit(1);
      }
      const label = rest[0] ?? "agent";
      const result = await allowAgent({
        rpcUrl: env.cfg.rpcUrl,
        ownerPrivateKey: env.ownerPrivateKey,
        cfg: env.cfg,
        addr: arg,
        label,
        status: "allowed",
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "revoke": {
      if (!arg) {
        console.error("usage: grove-owner revoke <addr>");
        process.exit(1);
      }
      const result = await allowAgent({
        rpcUrl: env.cfg.rpcUrl,
        ownerPrivateKey: env.ownerPrivateKey,
        cfg: env.cfg,
        addr: arg,
        label: "revoked",
        status: "revoked",
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "extend": {
      if (!arg) {
        console.error("usage: grove-owner extend <nid>");
        process.exit(1);
      }
      const note = await fetchNoteByNid(publicClient, env.cfg, arg);
      if (!note) {
        console.error("note not found");
        process.exit(1);
      }
      const result = await extendNoteLife({
        rpcUrl: env.cfg.rpcUrl,
        ownerPrivateKey: env.ownerPrivateKey,
        entityKey: note.key as Hex,
        targetSeconds: NOTE_ENDORSED_LIFE_SECONDS,
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default:
      console.log(`grove-owner <pending|approve|reject|allow|revoke|extend>`);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
