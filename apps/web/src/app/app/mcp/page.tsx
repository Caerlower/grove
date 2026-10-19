"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useArkivWallet } from "@/lib/useArkivWallet";

export default function McpConnectPage() {
  const { address, isConnected } = useArkivWallet();
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://YOUR_HOST";
  const mcpUrl = `${origin}/api/mcp`;
  const [copied, setCopied] = useState<string | null>(null);

  const ownerHint = address ?? "0xYOUR_CONNECTED_WALLET";

  const askPrompt = useMemo(
    () =>
      `Use grove_write_note to create a sealed Grove note titled "Field brief" with a short synthetic body about Tiramisu handoff. Set ownerAddress to ${ownerHint}. Return the nid when done.`,
    [ownerHint],
  );

  const cursorSnippet = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            grove: {
              url: mcpUrl,
            },
          },
        },
        null,
        2,
      ),
    [mcpUrl],
  );

  const remoteSnippet = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            grove: {
              command: "npx",
              args: ["-y", "mcp-remote", mcpUrl],
            },
          },
        },
        null,
        2,
      ),
    [mcpUrl],
  );

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="desk-grid desk-fill">
      <PageHeader title="Connect MCP">
        Write sealed notes from Claude.ai, Cursor, ChatGPT, or Desktop — then
        endorse in{" "}
        <Link href="/app/live">Live</Link>.
      </PageHeader>

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">Which AI?</p>
          <h2 className="sheet-title">Same Grove tools, many clients</h2>
          <p className="sheet-copy">
            Connect any MCP-capable client to the URL below. They all call the
            same tools (<code className="font-mono">grove_write_note</code>,{" "}
            <code className="font-mono">grove_read_note</code>, …). Pass your
            Live wallet as <code className="font-mono">ownerAddress</code> so
            the note lands in your Vault after you Approve.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li className="d-chip">Claude.ai</li>
            <li className="d-chip">Cursor</li>
            <li className="d-chip">Claude Desktop</li>
            <li className="d-chip">ChatGPT*</li>
            <li className="d-chip">Other MCP clients</li>
          </ul>
          <p className="sheet-copy mt-2 text-xs">
            *ChatGPT only where remote MCP connectors are enabled on the
            account.
          </p>
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">1 · Endpoint</p>
          <h2 className="sheet-title">Remote MCP URL</h2>
          <p className="sheet-copy">
            Claude.ai needs public HTTPS (Vercel). Localhost works for Cursor /
            Desktop on your machine.
          </p>
          <p className="d-data mt-3 break-all">{mcpUrl}</p>
          <div className="sheet-actions">
            <button
              type="button"
              className="d-btn d-btn-signal"
              onClick={() => void copy("url", mcpUrl)}
            >
              {copied === "url" ? "Copied" : "Copy URL"}
            </button>
          </div>
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">2 · Connect</p>
          <h2 className="sheet-title">Claude.ai</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--mute)]">
            <li>Settings → Connectors → add custom connector.</li>
            <li>
              Paste <code className="font-mono">{mcpUrl}</code> (exactly, no
              trailing slash).
            </li>
            <li>
              Leave OAuth Client ID / Secret empty. Claude may open a short demo
              “Approve” page from Grove, then return — that is expected.
            </li>
            <li>
              Do not set <code className="font-mono">MCP_SHARED_SECRET</code> on
              Vercel if you want Claude.ai to connect (it forces a broken auth
              path).
            </li>
            <li>Paste the ask prompt below (includes your wallet).</li>
          </ol>

          <h3 className="write-path-title mt-6">Cursor</h3>
          <pre className="mt-2 overflow-auto rounded-xl border border-[var(--line)] bg-[#f8fafc] p-3 font-mono text-xs">
            {cursorSnippet}
          </pre>
          <p className="sheet-copy mt-2">Stdio proxy if needed:</p>
          <pre className="mt-2 overflow-auto rounded-xl border border-[var(--line)] bg-[#f8fafc] p-3 font-mono text-xs">
            {remoteSnippet}
          </pre>
          <div className="sheet-actions">
            <button
              type="button"
              className="d-btn d-btn-line"
              onClick={() => void copy("cursor", cursorSnippet)}
            >
              {copied === "cursor" ? "Copied" : "Copy Cursor config"}
            </button>
          </div>
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">Help</p>
          <h2 className="sheet-title">grove_help</h2>
          <p className="sheet-copy">
            Ask the connected AI:{" "}
            <code className="font-mono">Call grove_help</code>. It returns every
            tool with a one-line explanation, plus write tips.
          </p>
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">3 · Ask the AI to write</p>
          <h2 className="sheet-title">Example prompt</h2>
          {!isConnected && (
            <p className="sheet-copy">
              Connect your wallet in Live first so we can fill ownerAddress.
            </p>
          )}
          <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[#f8fafc] p-3 font-mono text-xs">
            {askPrompt}
          </pre>
          <div className="sheet-actions">
            <button
              type="button"
              className="d-btn d-btn-signal"
              onClick={() => void copy("ask", askPrompt)}
            >
              {copied === "ask" ? "Copied" : "Copy ask prompt"}
            </button>
            <Link href="/app/live" className="d-btn d-btn-line">
              Back to Live · Endorse
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
