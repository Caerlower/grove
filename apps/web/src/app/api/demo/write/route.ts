import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { writeNoteAsAgent } from "@grove/core";
import {
  requireAgentKey,
  requireDemoVaultKey,
  serverCfg,
} from "@/lib/server-grove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo agent write (same txs as MCP grove_write_note).
 * Handoff goes to the human's connected wallet address.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      body?: string;
      tags?: string[];
      ownerAddress?: string;
    };
    const title = (body.title ?? "").trim();
    const text = (body.body ?? "").trim();
    if (!title || !text) {
      return NextResponse.json(
        { error: "title and body required" },
        { status: 400 },
      );
    }
    if (!body.ownerAddress || !isAddress(body.ownerAddress)) {
      return NextResponse.json(
        { error: "ownerAddress (your connected wallet) required" },
        { status: 400 },
      );
    }

    const cfg = {
      ...serverCfg(),
      ownerAddress: getAddress(body.ownerAddress),
    };

    const result = await writeNoteAsAgent({
      rpcUrl: cfg.rpcUrl,
      agentPrivateKey: requireAgentKey(),
      cfg,
      vaultKeyRaw: requireDemoVaultKey(),
      content: {
        title,
        body: text,
        tags: body.tags?.slice(0, 5) ?? ["demo", "synthetic"],
        links: [],
      },
    });

    return NextResponse.json({
      ...result,
      ownerAddress: cfg.ownerAddress,
      explorer: `https://tiramisu.explorer.arkiv.network/entity/${result.entityKey}`,
      message:
        result.status === "pending_review"
          ? `Sealed note handed to ${cfg.ownerAddress}. Your wallet must endorse it.`
          : "Created but handoff incomplete.",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
