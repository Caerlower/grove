import { NextResponse } from "next/server";
import { fetchNoteByNid } from "@grove/core";
import { serializeNote } from "@/lib/note-wire";
import { serverCfg, serverPublicClient } from "@/lib/server-grove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const nid = new URL(req.url).searchParams.get("nid")?.trim();
    if (!nid) {
      return NextResponse.json({ error: "nid required" }, { status: 400 });
    }
    const note = await fetchNoteByNid(
      serverPublicClient(),
      serverCfg(),
      nid,
    );
    if (!note) {
      return NextResponse.json({ found: false }, { status: 404 });
    }
    return NextResponse.json({ found: true, note: serializeNote(note) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
