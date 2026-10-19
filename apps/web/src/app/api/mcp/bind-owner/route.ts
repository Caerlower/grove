import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  getBoundMcpOwner,
  setBoundMcpOwner,
} from "@/lib/mcp-bound-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Bind the Grove UI connected wallet as default MCP write owner (on-chain). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { address?: string };
    if (!body.address || !isAddress(body.address)) {
      return NextResponse.json(
        { error: "Valid address required" },
        { status: 400 },
      );
    }
    const ownerAddress = await setBoundMcpOwner(body.address);
    return NextResponse.json({ ok: true, ownerAddress });
  } catch (e) {
    console.error("[bind-owner]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      ownerAddress: await getBoundMcpOwner(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
