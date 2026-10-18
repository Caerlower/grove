import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import {
  fetchNoteByNid,
  writeNoteAsAgent,
  evaluateNote,
  fetchAllowlist,
  fetchEndorsementsForNid,
  fetchAllEndorsements,
  computeTrustTier,
  importVaultKey,
  wrapUntrustedNote,
  openNoteContent,
} from "@grove/core";
import {
  requireAgentKey,
  requireDemoVaultKey,
  serverCfg,
  serverPublicClient,
} from "@/lib/server-grove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * In-page Claude agent that only uses Grove tools (same as MCP).
 * Requires ANTHROPIC_API_KEY. Without it, returns setup instructions.
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "no_anthropic_key",
        message:
          "Set ANTHROPIC_API_KEY in apps/web/.env.local for in-page Claude. Or use Cursor MCP (grove_write_note) — see the Live page.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as {
      messages?: Msg[];
      ownerAddress?: string;
    };
    if (!body.ownerAddress || !isAddress(body.ownerAddress)) {
      return NextResponse.json(
        { error: "ownerAddress required" },
        { status: 400 },
      );
    }
    const ownerAddress = getAddress(body.ownerAddress);
    const messages = body.messages ?? [];

    const tools = [
      {
        name: "grove_write_note",
        description:
          "Write a sealed draft note into the Grove vault. Ownership is handed to the human vault owner. Content stays pending_review until they endorse.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["title", "body"],
        },
      },
      {
        name: "grove_read_note",
        description:
          "Read a note by nid through the trust gate. On deny returns only {allow:false, reason}.",
        input_schema: {
          type: "object",
          properties: { nid: { type: "string" } },
          required: ["nid"],
        },
      },
    ];

    const system = `You are an AI agent writing into Grove, a sealed notes vault on Arkiv (Tiramisu).
Rules:
- Use grove_write_note to store notes the human may later endorse.
- Never claim a note is trusted until the human endorses it on chain.
- If you read a note and get allow:false, tell the human the reason — do not invent content.
- Keep notes synthetic / demo-safe. No real personal data.
The human vault owner address is ${ownerAddress}.`;

    // Anthropic Messages API with tool use (one round of tools is enough for demo)
    const first = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system,
        tools,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!first.ok) {
      const errText = await first.text();
      return NextResponse.json(
        { error: `anthropic: ${errText.slice(0, 400)}` },
        { status: 502 },
      );
    }

    const firstJson = (await first.json()) as {
      content: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
      stop_reason?: string;
    };

    const toolUses = firstJson.content.filter((c) => c.type === "tool_use");
    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
    }> = [];

    const cfg = { ...serverCfg(), ownerAddress };
    const vaultKeyRaw = requireDemoVaultKey();

    for (const t of toolUses) {
      if (!t.id || !t.name) continue;
      let result: unknown = { error: "unknown tool" };
      if (t.name === "grove_write_note") {
        const title = String(t.input?.title ?? "");
        const noteBody = String(t.input?.body ?? "");
        const tags = Array.isArray(t.input?.tags)
          ? (t.input?.tags as string[])
          : ["agent", "synthetic"];
        result = await writeNoteAsAgent({
          rpcUrl: cfg.rpcUrl,
          agentPrivateKey: requireAgentKey(),
          cfg,
          vaultKeyRaw,
          content: { title, body: noteBody, tags, links: [] },
        });
      } else if (t.name === "grove_read_note") {
        const nid = String(t.input?.nid ?? "");
        const publicClient = serverPublicClient();
        const note = await fetchNoteByNid(publicClient, cfg, nid);
        if (!note) {
          result = { allow: false, reason: "not_found" };
        } else {
          const allow = await fetchAllowlist(publicClient, cfg);
          const allowlist = new Set(allow.map((a) => a.addr.toLowerCase()));
          const endorsements = await fetchEndorsementsForNid(
            publicClient,
            cfg,
            nid,
          );
          const all = await fetchAllEndorsements(publicClient, cfg);
          const stats = computeTrustTier(note.creator, all);
          const vaultKey = await importVaultKey(vaultKeyRaw);
          const gate = await evaluateNote(note, {
            ownerAddress,
            allowlist,
            endorsements,
            creatorTier: stats.tier,
            vaultKey,
            strict: false,
          });
          if (!gate.allow) {
            result = { allow: false, reason: gate.reason };
          } else {
            const content = await openNoteContent(vaultKey, note.payload);
            result = {
              allow: true,
              wrapped: wrapUntrustedNote(content),
              label: gate.label,
              warnings: gate.warnings,
            };
          }
        }
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: t.id,
        content: JSON.stringify(result),
      });
    }

    if (toolResults.length === 0) {
      const text = firstJson.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return NextResponse.json({
        reply: text || "(no reply)",
        toolCalls: [],
      });
    }

    const second = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system,
        tools,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant", content: firstJson.content },
          { role: "user", content: toolResults },
        ],
      }),
    });

    if (!second.ok) {
      const errText = await second.text();
      return NextResponse.json(
        { error: `anthropic2: ${errText.slice(0, 400)}`, toolResults },
        { status: 502 },
      );
    }

    const secondJson = (await second.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const reply = secondJson.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    return NextResponse.json({
      reply,
      toolCalls: toolUses.map((t, i) => ({
        name: t.name,
        input: t.input,
        result: toolResults[i]?.content
          ? JSON.parse(toolResults[i].content)
          : null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
