"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export default function McpConnectPage() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://YOUR_HOST";
  const mcpUrl = `${origin}/api/mcp`;
  const [copied, setCopied] = useState(false);

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

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="desk-grid desk-fill">
      <PageHeader title="Connect MCP">
        Use Grove tools from Claude.ai, Cursor, Claude Desktop, and other MCP
        clients.{" "}
        <Link href="/app/live">Live playground</Link>
      </PageHeader>

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">Remote endpoint</p>
          <h2 className="sheet-title">Streamable HTTP</h2>
          <p className="sheet-copy">
            The hosted app exposes Grove MCP over HTTPS. Claude.ai needs a
            public URL (Vercel). Localhost only works for Cursor / Desktop on
            your machine.
          </p>
          <p className="d-data mt-3 break-all">{mcpUrl}</p>
          <div className="sheet-actions">
            <button
              type="button"
              className="d-btn d-btn-signal"
              onClick={() => void copy(mcpUrl)}
            >
              {copied ? "Copied" : "Copy URL"}
            </button>
          </div>
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">Claude.ai</p>
          <h2 className="sheet-title">Custom connector</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--mute)]">
            <li>Open Claude.ai → Settings → Connectors (or Customize → Connectors).</li>
            <li>Add custom connector → paste the URL above.</li>
            <li>Leave auth empty unless you set MCP_SHARED_SECRET on the deploy.</li>
            <li>
              Ask Claude to call <code className="font-mono">grove_write_note</code>{" "}
              or <code className="font-mono">grove_read_note</code>.
            </li>
          </ol>
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">Cursor</p>
          <h2 className="sheet-title">mcp.json</h2>
          <p className="sheet-copy">
            Prefer a direct URL when your Cursor build supports remote MCP:
          </p>
          <pre className="mt-3 overflow-auto rounded-xl border border-[var(--line)] bg-[#f8fafc] p-3 font-mono text-xs">
            {cursorSnippet}
          </pre>
          <p className="sheet-copy mt-3">
            If URL config is not available, proxy with mcp-remote:
          </p>
          <pre className="mt-3 overflow-auto rounded-xl border border-[var(--line)] bg-[#f8fafc] p-3 font-mono text-xs">
            {remoteSnippet}
          </pre>
          <div className="sheet-actions">
            <button
              type="button"
              className="d-btn d-btn-line"
              onClick={() => void copy(cursorSnippet)}
            >
              Copy Cursor config
            </button>
          </div>
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">ChatGPT / others</p>
          <h2 className="sheet-title">What works today</h2>
          <p className="sheet-copy">
            ChatGPT MCP connectors are limited (plan / region). Same HTTPS URL
            works anywhere Streamable HTTP MCP is supported. Claude Desktop can
            use the mcp-remote snippet above. Local stdio is still available via{" "}
            <code className="font-mono">pnpm mcp</code> in the repo.
          </p>
          <p className="sheet-copy mt-2">
            Tools: grove_write_note, grove_read_note, grove_search,
            grove_my_status, grove_trust_report. Writes hand off to the
            configured vault owner; endorse in the web Live UI with a wallet.
          </p>
        </div>
      </section>
    </div>
  );
}
