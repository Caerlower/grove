import {
  computeTrustTier,
  createGrovePublicClient,
  evaluateNote,
  fetchAllEndorsements,
  fetchAllowlist,
  fetchEndorsementsForNid,
  fetchNoteByNid,
  fetchNotesByCreator,
  importVaultKey,
  openNoteContent,
  wrapUntrustedNote,
  type GroveConfig,
  type GateResult,
  type NoteView,
} from "@grove/core";
import { getAddress } from "viem";

export async function buildGateContext(opts: {
  cfg: GroveConfig;
  vaultKeyRaw: string;
  strict: boolean;
  note: NoteView;
}) {
  const publicClient = createGrovePublicClient(opts.cfg.rpcUrl);
  const allow = await fetchAllowlist(publicClient, opts.cfg);
  const allowlist = new Set(allow.map((a) => a.addr.toLowerCase()));
  const endorsements = await fetchEndorsementsForNid(
    publicClient,
    opts.cfg,
    opts.note.nid,
  );
  const allEndorsements = await fetchAllEndorsements(publicClient, opts.cfg);
  const stats = computeTrustTier(opts.note.creator, allEndorsements);
  const vaultKey = await importVaultKey(opts.vaultKeyRaw);
  return {
    publicClient,
    ctx: {
      ownerAddress: opts.cfg.ownerAddress,
      allowlist,
      endorsements,
      creatorTier: stats.tier,
      vaultKey,
      strict: opts.strict,
    },
    stats,
  };
}

export async function gatedReadNote(opts: {
  cfg: GroveConfig;
  vaultKeyRaw: string;
  strict: boolean;
  nid: string;
}): Promise<
  | { allow: false; reason: string }
  | {
      allow: true;
      wrapped: string;
      creator: string;
      owner: string;
      label: string;
      expiresAt?: string;
      warnings: string[];
      content: { title: string; body: string; tags: string[]; links: string[] };
      gate: GateResult;
    }
> {
  const publicClient = createGrovePublicClient(opts.cfg.rpcUrl);
  const note = await fetchNoteByNid(publicClient, opts.cfg, opts.nid);
  if (!note) return { allow: false, reason: "not_found" };

  const { ctx } = await buildGateContext({ ...opts, note });
  const gate = await evaluateNote(note, ctx);
  if (!gate.allow) {
    return { allow: false, reason: gate.reason };
  }

  const content = await openNoteContent(ctx.vaultKey, note.payload);
  return {
    allow: true,
    wrapped: wrapUntrustedNote(content),
    creator: note.creator,
    owner: note.owner,
    label: gate.label,
    expiresAt: note.expiresAtBlock?.toString(),
    warnings: gate.warnings,
    content,
    gate,
  };
}

export async function searchNotes(opts: {
  cfg: GroveConfig;
  vaultKeyRaw: string;
  strict: boolean;
  tag?: string;
  text?: string;
}) {
  const publicClient = createGrovePublicClient(opts.cfg.rpcUrl);
  const allow = await fetchAllowlist(publicClient, opts.cfg);
  const vaultKey = await importVaultKey(opts.vaultKeyRaw);
  const allEndorsements = await fetchAllEndorsements(publicClient, opts.cfg);

  const results: Array<{
    nid: string;
    key: string;
    label: string;
    title: string;
    creator: string;
  }> = [];

  for (const agent of allow) {
    const notes = await fetchNotesByCreator(
      publicClient,
      opts.cfg,
      getAddress(agent.addr),
    );
    for (const note of notes) {
      const endorsements = allEndorsements.filter((e) => e.nid === note.nid);
      const stats = computeTrustTier(note.creator, allEndorsements);
      const gate = await evaluateNote(note, {
        ownerAddress: opts.cfg.ownerAddress,
        allowlist: new Set(allow.map((a) => a.addr.toLowerCase())),
        endorsements,
        creatorTier: stats.tier,
        vaultKey,
        strict: opts.strict,
      });
      if (!gate.allow) continue;

      let content;
      try {
        content = await openNoteContent(vaultKey, note.payload);
      } catch {
        continue;
      }

      if (opts.tag) {
        const needle = opts.tag.trim().toLowerCase();
        if (!content.tags.map((t) => t.toLowerCase()).includes(needle)) {
          // Also accept blind-index match if th attrs present — content tags is enough for demo
          continue;
        }
      }
      if (opts.text) {
        const hay = `${content.title}\n${content.body}`.toLowerCase();
        if (!hay.includes(opts.text.toLowerCase())) continue;
      }

      results.push({
        nid: note.nid,
        key: note.key,
        label: gate.label,
        title: content.title,
        creator: note.creator,
      });
    }
  }

  return results;
}
