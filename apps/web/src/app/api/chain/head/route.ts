import { NextResponse } from "next/server";
import { serverPublicClient } from "@/lib/server-grove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const n = await serverPublicClient().getBlockNumber();
    return NextResponse.json({ blockNumber: n.toString() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
