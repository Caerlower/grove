"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useArkivWallet } from "@/lib/useArkivWallet";

type ClientId = "claude" | "cursor" | "desktop" | "chatgpt";

const CLIENTS: Array<{
  id: ClientId;
  name: string;
  blurb: string;
}> = [
  { id: "claude", name: "Claude.ai", blurb: "Custom connector" },
  { id: "cursor", name: "Cursor", blurb: "mcp.json URL" },
  { id: "desktop", name: "Claude Desktop", blurb: "mcp-remote" },
  { id: "chatgpt", name: "ChatGPT", blurb: "Where supported" },
];

export default function McpConnectPage() {
  const { address } = useArkivWallet();
  const [origin, setOrigin] = useState("https://YOUR_HOST");
  const [client, setClient] = useState<ClientId>("claude");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Quietly bind wallet so grove_write_note owns drafts for this address.
  useEffect(() => {
    if (!address) return;
    void fetch("/api/mcp/bind-owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    }).catch(() => undefined);
  }, [address]);

  const mcpUrl = `${origin}/api/mcp`;

  const cursorSnippet = useMemo(
    () =>
      JSON.stringify({ mcpServers: { grove: { url: mcpUrl } } }, null, 2),
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
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mcp-page">
      <PageHeader title="Connect MCP">
        Hook Claude / Cursor / Desktop to Grove. Writing and endorsing stay in{" "}
        <Link href="/app/live">Live</Link>.
      </PageHeader>

      <div className="mcp-stage">
        <aside className="mcp-rail sheet" aria-label="Clients">
          <div className="sheet-pad mcp-rail-pad">
            <p className="sheet-label">Client</p>
            <h2 className="mcp-rail-title">Pick a client</h2>
            <ul className="mcp-client-list">
              {CLIENTS.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={
                      client === c.id ? "mcp-client is-on" : "mcp-client"
                    }
                    onClick={() => setClient(c.id)}
                  >
                    <span className="mcp-client-name">{c.name}</span>
                    <span className="mcp-client-blurb">{c.blurb}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="mcp-main">
          <section className="mcp-hero sheet">
            <div className="sheet-pad">
              <div className="mcp-hero-top">
                <div>
                  <p className="sheet-label">Endpoint</p>
                  <h2 className="sheet-title">Remote MCP URL</h2>
                </div>
                <span className="d-chip ok">live</span>
              </div>
              <div className="mcp-url-row">
                <code className="mcp-url">{mcpUrl}</code>
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

          <section className="sheet" key={client}>
            <div className="sheet-pad">
              {client === "claude" && (
                <>
                  <h3 className="mcp-panel-title">Claude.ai</h3>
                  <ol className="mcp-ol">
                    <li>Settings → Connectors → Add custom connector</li>
                    <li>Paste the URL above (no trailing slash)</li>
                    <li>Leave OAuth Client ID empty</li>
                    <li>
                      On Grove’s consent page, connect the same wallet you use
                      in Live
                    </li>
                  </ol>
                </>
              )}
              {client === "cursor" && (
                <>
                  <h3 className="mcp-panel-title">Cursor</h3>
                  <pre className="mcp-pre">{cursorSnippet}</pre>
                  <div className="sheet-actions">
                    <button
                      type="button"
                      className="d-btn d-btn-line"
                      onClick={() => void copy("cursor", cursorSnippet)}
                    >
                      {copied === "cursor" ? "Copied" : "Copy config"}
                    </button>
                  </div>
                </>
              )}
              {client === "desktop" && (
                <>
                  <h3 className="mcp-panel-title">Claude Desktop</h3>
                  <pre className="mcp-pre">{remoteSnippet}</pre>
                  <div className="sheet-actions">
                    <button
                      type="button"
                      className="d-btn d-btn-line"
                      onClick={() => void copy("remote", remoteSnippet)}
                    >
                      {copied === "remote" ? "Copied" : "Copy config"}
                    </button>
                  </div>
                </>
              )}
              {client === "chatgpt" && (
                <>
                  <h3 className="mcp-panel-title">ChatGPT</h3>
                  <p className="sheet-copy">
                    Use the same HTTPS URL wherever ChatGPT supports remote MCP.
                    Otherwise use Claude.ai or Cursor.
                  </p>
                </>
              )}
              <div className="sheet-actions">
                <Link href="/app/live" className="d-btn d-btn-signal">
                  Back to Live
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
