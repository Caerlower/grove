import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import {
  fetchAllEndorsements,
  fetchAllowlist,
  fetchNotesByCreator,
  type NoteView,
} from "@grove/core";
import { serializeNote } from "@/lib/note-wire";
import { arkivApiKey, serverCfg, serverPublicClient } from "@/lib/server-grove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pass ?owner=0x… (connected wallet) so vault/pending match Live handoff. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ownerParam = url.searchParams.get("owner");
    const cfgBase = serverCfg();
    const ownerAddress =
      ownerParam && isAddress(ownerParam)
        ? getAddress(ownerParam)
        : getAddress(cfgBase.ownerAddress);
    const cfg = { ...cfgBase, ownerAddress };
    const publicClient = serverPublicClient();
    const allow = await fetchAllowlist(publicClient, cfg);
    const endorsements = await fetchAllEndorsements(publicClient, cfg);

    const notes: NoteView[] = [];
    for (const agent of allow) {
      try {
        notes.push(
          ...(await fetchNotesByCreator(
            publicClient,
            cfg,
            getAddress(agent.addr),
          )),
        );
      } catch (e) {
        console.warn("vault snapshot: skip agent", agent.addr, e);
      }
    }

    return NextResponse.json({
      allow,
      endorsements,
      notes: notes.map(serializeNote),
      keyed: Boolean(arkivApiKey()),
      project: cfg.project,
      vaultId: cfg.vaultId,
      ownerAddress: cfg.ownerAddress,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const budget = message.includes("budget exhausted");
    return NextResponse.json(
      {
        error: message,
        hint: budget
          ? "Create a free key at https://hub.arkiv.network and set ARKIV_API_KEY in .env.local, then restart."
          : undefined,
      },
      { status: budget ? 503 : 500 },
    );
  }
}
