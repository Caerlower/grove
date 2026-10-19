import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import {
  fetchAllEndorsements,
  fetchAllowlist,
  fetchNotesByCreator,
} from "@grove/core";
import { serverCfg, serverPublicClient } from "@/lib/server-grove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unendorsed notes owned by ?owner= — used by Live to jump to Endorse after MCP write. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ownerParam = url.searchParams.get("owner");
    if (!ownerParam || !isAddress(ownerParam)) {
      return NextResponse.json(
        { error: "owner query required" },
        { status: 400 },
      );
    }
    const ownerAddress = getAddress(ownerParam);
    const cfg = { ...serverCfg(), ownerAddress };
    const publicClient = serverPublicClient();
    const [allow, endorsements] = await Promise.all([
      fetchAllowlist(publicClient, cfg),
      fetchAllEndorsements(publicClient, cfg),
    ]);
    const endorsed = new Set(endorsements.map((e) => e.nid));
    const drafts: Array<{
      nid: string;
      entityKey: string;
      createdat: number;
    }> = [];

    for (const agent of allow) {
      try {
        const notes = await fetchNotesByCreator(
          publicClient,
          cfg,
          getAddress(agent.addr),
        );
        for (const note of notes) {
          if (getAddress(note.owner) !== ownerAddress) continue;
          if (endorsed.has(note.nid)) continue;
          drafts.push({
            nid: note.nid,
            entityKey: note.key,
            createdat: note.createdat,
          });
        }
      } catch {
        /* skip agent */
      }
    }

    drafts.sort((a, b) => b.createdat - a.createdat);
    return NextResponse.json({ ownerAddress, drafts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
