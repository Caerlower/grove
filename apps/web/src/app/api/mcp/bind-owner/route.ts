import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  getBoundMcpOwner,
  setBoundMcpOwner,
} from "@/lib/mcp-bound-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bind the Grove UI connected wallet as default MCP write owner. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { address?: string };
    if (!body.address || !isAddress(body.address)) {
      return NextResponse.json(
        { error: "Valid address required" },
        { status: 400 },
      );
    }
    const ownerAddress = setBoundMcpOwner(body.address);
    return NextResponse.json({ ok: true, ownerAddress });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ownerAddress: getBoundMcpOwner(),
  });
}
