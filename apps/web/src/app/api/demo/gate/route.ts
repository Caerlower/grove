import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import {
  computeTrustTier,
  evaluateNote,
  fetchAllEndorsements,
  fetchAllowlist,
  fetchEndorsementsForNid,
  fetchNoteByNid,
  importVaultKey,
  openNoteContent,
  wrapUntrustedNote,
} from "@grove/core";
import {
  requireDemoVaultKey,
  serverCfg,
  serverPublicClient,
} from "@/lib/server-grove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live gate check — pass owner= your connected wallet. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const nid = url.searchParams.get("nid");
    const ownerParam = url.searchParams.get("owner");
    if (!nid) {
      return NextResponse.json({ error: "nid required" }, { status: 400 });
    }
    const cfgBase = serverCfg();
    const ownerAddress =
      ownerParam && isAddress(ownerParam)
        ? getAddress(ownerParam)
        : cfgBase.ownerAddress;
    const cfg = { ...cfgBase, ownerAddress };
    const strict = url.searchParams.get("strict") === "1";
    const publicClient = serverPublicClient();
    const note = await fetchNoteByNid(publicClient, cfg, nid);
    if (!note) {
      return NextResponse.json({ allow: false, reason: "not_found" });
    }

    const allow = await fetchAllowlist(publicClient, cfg);
    const allowlist = new Set(allow.map((a) => a.addr.toLowerCase()));
    const endorsements = await fetchEndorsementsForNid(publicClient, cfg, nid);
    const all = await fetchAllEndorsements(publicClient, cfg);
    const stats = computeTrustTier(note.creator, all);
    const vaultKey = await importVaultKey(requireDemoVaultKey());
    const gate = await evaluateNote(note, {
      ownerAddress: cfg.ownerAddress,
      allowlist,
      endorsements,
      creatorTier: stats.tier,
      vaultKey,
      strict,
    });

    if (!gate.allow) {
      return NextResponse.json({
        allow: false,
        reason: gate.reason,
        label: gate.label,
        creator: note.creator,
        owner: note.owner,
        entityKey: note.key,
        mcp: { allow: false, reason: gate.reason },
        explorer: `https://tiramisu.explorer.arkiv.network/entity/${note.key}`,
      });
    }

    const content = await openNoteContent(vaultKey, note.payload);
    return NextResponse.json({
      allow: true,
      reason: gate.reason,
      label: gate.label,
      warnings: gate.warnings,
      creator: note.creator,
      owner: note.owner,
      entityKey: note.key,
      title: content.title,
      mcp: {
        allow: true,
        wrapped: wrapUntrustedNote(content),
        label: gate.label,
        warnings: gate.warnings,
      },
      explorer: `https://tiramisu.explorer.arkiv.network/entity/${note.key}`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
