"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { useArkivWallet } from "@/lib/useArkivWallet";

type ClientId = "claude" | "cursor" | "desktop" | "chatgpt";

const CLIENTS: Array<{
  id: ClientId;
  name: string;
  blurb: string;
}> = [
  {
    id: "claude",
    name: "Claude.ai",
    blurb: "Custom connector · public HTTPS",
  },
  {
    id: "cursor",
    name: "Cursor",
    blurb: "Remote URL in mcp.json",
  },
  {
    id: "desktop",
    name: "Claude Desktop",
    blurb: "mcp-remote stdio bridge",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    blurb: "Where MCP connectors exist",
  },
];

export default function McpConnectPage() {
  const router = useRouter();
  const { address, isConnected } = useArkivWallet();
  const [origin, setOrigin] = useState("https://YOUR_HOST");
  const [client, setClient] = useState<ClientId>("claude");
  const [copied, setCopied] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [nid, setNid] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const mcpUrl = `${origin}/api/mcp`;
  const ownerHint = address ?? "0xYOUR_CONNECTED_WALLET";

  const askPrompt = useMemo(
    () =>
      `Call grove_help first if you need the tool list. Then use grove_write_note with title "Field brief", a short synthetic body about Tiramisu handoff, and ownerAddress ${ownerHint}. Reply with only the nid (and the endorse URL if the tool returns one).`,
    [ownerHint],
  );

  const endorseHref = useMemo(() => {
    const clean = nid.trim();
    if (!clean) return "/app/live?from=mcp";
    return `/app/live?nid=${encodeURIComponent(clean)}&from=mcp`;
  }, [nid]);

  const cursorSnippet = useMemo(
    () =>
      JSON.stringify(
        { mcpServers: { grove: { url: mcpUrl } } },
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
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      /* ignore */
    }
  }

  function goEndorse() {
    router.push(endorseHref);
  }

  return (
    <div className="mcp-page">
      <PageHeader title="Connect MCP">
        Write from Claude / Cursor, paste the{" "}
        <code className="font-mono">nid</code>, then endorse — Live’s allowlist
        wizard is not part of this path.
      </PageHeader>

      <div className="mcp-stage">
        <aside className="mcp-rail sheet" aria-label="Clients">
          <div className="sheet-pad mcp-rail-pad">
            <p className="sheet-label">Client</p>
            <h2 className="mcp-rail-title">Where will you write from?</h2>
            <ul className="mcp-client-list">
              {CLIENTS.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={
                      client === c.id ? "mcp-client is-on" : "mcp-client"
                    }
                    onClick={() => {
                      setClient(c.id);
                      setStep(0);
                    }}
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
              <p className="sheet-copy mt-2">
                Claude.ai needs this public HTTPS host. Cursor / Desktop can use
                localhost while developing.
              </p>
            </div>
          </section>

          <section className="mcp-steps sheet" key={client}>
            <div className="sheet-pad">
              <div className="mcp-stepper" role="tablist" aria-label="Setup steps">
                {["Connect", "Ask", "Endorse"].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={step === i}
                    className={step === i ? "mcp-step is-on" : "mcp-step"}
                    onClick={() => setStep(i)}
                  >
                    <span className="mcp-step-n">{i + 1}</span>
                    {label}
                  </button>
                ))}
              </div>

              {step === 0 && (
                <div className="mcp-panel">
                  {client === "claude" && (
                    <>
                      <h3 className="mcp-panel-title">Claude.ai connector</h3>
                      <ol className="mcp-ol">
                        <li>Settings → Connectors → Add custom connector</li>
                        <li>Paste the URL above (no trailing slash)</li>
                        <li>
                          Leave OAuth Client ID empty — a short Grove approve
                          page is normal
                        </li>
                        <li>
                          When Claude shows Connected, come back here for Ask →
                          Endorse (not Live’s Allowlist step)
                        </li>
                      </ol>
                    </>
                  )}
                  {client === "cursor" && (
                    <>
                      <h3 className="mcp-panel-title">Cursor mcp.json</h3>
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
                      <p className="sheet-copy">
                        Bridge Streamable HTTP through mcp-remote:
                      </p>
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
                        Use the same HTTPS URL wherever ChatGPT exposes remote
                        MCP connectors (plan-dependent). If connectors are not
                        available, use Claude.ai or Cursor for the demo.
                      </p>
                    </>
                  )}
                  <div className="sheet-actions">
                    <button
                      type="button"
                      className="d-btn d-btn-signal"
                      onClick={() => setStep(1)}
                    >
                      Next · Ask the AI
                    </button>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="mcp-panel">
                  <h3 className="mcp-panel-title">Prompt to paste</h3>
                  {!isConnected && (
                    <p className="mcp-warn">
                      Connect your wallet first so{" "}
                      <code className="font-mono">ownerAddress</code> is your
                      endorse wallet.
                    </p>
                  )}
                  <pre className="mcp-pre mcp-pre-prompt">{askPrompt}</pre>
                  <div className="sheet-actions">
                    <button
                      type="button"
                      className="d-btn d-btn-signal"
                      onClick={() => void copy("ask", askPrompt)}
                    >
                      {copied === "ask" ? "Copied" : "Copy prompt"}
                    </button>
                    <button
                      type="button"
                      className="d-btn d-btn-line"
                      onClick={() =>
                        void copy(
                          "help",
                          "Call grove_help and summarize the tools in one line each.",
                        )
                      }
                    >
                      {copied === "help" ? "Copied" : "Copy grove_help ask"}
                    </button>
                    <button
                      type="button"
                      className="d-btn d-btn-line"
                      onClick={() => setStep(2)}
                    >
                      Next · Paste nid
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="mcp-panel">
                  <h3 className="mcp-panel-title">Endorse the MCP note</h3>
                  <p className="sheet-copy">
                    Paste the <code className="font-mono">nid</code> Claude (or
                    Cursor) returned. Grove opens Live directly on{" "}
                    <strong>Endorse</strong> — not Allowlist.
                  </p>
                  <label className="mt-3 block text-xs text-[var(--mute)]">
                    nid from the AI
                    <input
                      className="d-field mt-1 font-mono"
                      value={nid}
                      onChange={(e) => setNid(e.target.value)}
                      placeholder="paste nid here"
                      autoFocus
                    />
                  </label>
                  <p className="sheet-copy mt-2 text-xs break-all">
                    Opens: <code className="font-mono">{endorseHref}</code>
                  </p>
                  <div className="sheet-actions">
                    <button
                      type="button"
                      className="d-btn d-btn-signal"
                      disabled={!nid.trim()}
                      onClick={goEndorse}
                    >
                      Open Endorse
                    </button>
                    <Link
                      href={endorseHref}
                      className="d-btn d-btn-line"
                      onClick={(e) => {
                        if (!nid.trim()) e.preventDefault();
                      }}
                    >
                      Open in new tab path
                    </Link>
                    <Link href="/app/pending" className="d-btn d-btn-line">
                      Or Pending queue
                    </Link>
                    <button
                      type="button"
                      className="d-btn d-btn-line"
                      onClick={() => setStep(1)}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
