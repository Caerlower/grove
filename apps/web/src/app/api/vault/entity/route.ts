import { NextResponse } from "next/server";
import { isHex, type Hex } from "viem";
import { fetchEntityByKey } from "@grove/core";
import { serializeNote } from "@/lib/note-wire";
import { serverPublicClient } from "@/lib/server-grove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const key = new URL(req.url).searchParams.get("key")?.trim();
    if (!key || !isHex(key)) {
      return NextResponse.json(
        { error: "key (0x…) required" },
        { status: 400 },
      );
    }
    const note = await fetchEntityByKey(serverPublicClient(), key as Hex);
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
