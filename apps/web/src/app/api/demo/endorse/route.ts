import { NextResponse } from "next/server";
import { endorseNote, fetchNoteByNid } from "@grove/core";
import {
  requireOwnerKey,
  serverCfg,
  serverPublicClient,
} from "@/lib/server-grove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** You (vault owner) approve or reject a pending note. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      nid?: string;
      decision?: "approve" | "reject";
    };
    if (!body.nid || (body.decision !== "approve" && body.decision !== "reject")) {
      return NextResponse.json(
        { error: "nid and decision (approve|reject) required" },
        { status: 400 },
      );
    }

    const cfg = serverCfg();
    const publicClient = serverPublicClient();
    const note = await fetchNoteByNid(publicClient, cfg, body.nid);
    if (!note) {
      return NextResponse.json({ error: "note not found" }, { status: 404 });
    }

    const result = await endorseNote({
      rpcUrl: cfg.rpcUrl,
      ownerPrivateKey: requireOwnerKey(),
      cfg,
      note,
      decision: body.decision,
    });

    return NextResponse.json({
      ...result,
      nid: body.nid,
      decision: body.decision,
      noteKey: note.key,
      explorerNote: `https://tiramisu.explorer.arkiv.network/entity/${note.key}`,
      explorerEndorsement: `https://tiramisu.explorer.arkiv.network/entity/${result.endorsementKey}`,
      message:
        body.decision === "approve"
          ? "Endorsement on chain + Lifetime Extension. Gate label should become endorsed."
          : "Reject endorsement on chain. Note will fade via Entity Expiration.",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
