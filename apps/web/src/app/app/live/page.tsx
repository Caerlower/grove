"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { NoteView } from "@grove/core";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PageHeader } from "@/components/PageHeader";
import { allowAgentWithWallet, endorseWithWallet } from "@/lib/browser-arkiv";
import { publicConfig } from "@/lib/config";
import { loadNoteByNid } from "@/lib/grove-client";
import { useArkivWallet } from "@/lib/useArkivWallet";

type GateResult = {
  allow: boolean;
  reason?: string;
  label?: string;
  mcp?: unknown;
  explorer?: string;
  entityKey?: string;
};

type ChatMsg = { role: "user" | "assistant"; content: string };
type Step = "connect" | "allow" | "write" | "endorse";

type ActivityLink = { label: string; href: string };
type ActivityItem = {
  id: string;
  time: string;
  text: string;
  links?: ActivityLink[];
};

function txUrl(hash: string) {
  return `${publicConfig.explorer}/tx/${hash}`;
}

function entityUrl(key: string) {
  return `${publicConfig.explorer}/entity/${key}`;
}

function shortHash(h: string) {
  if (h.length < 12) return h;
  return `${h.slice(0, 10)}…${h.slice(-4)}`;
}

export default function LivePlaygroundPage() {
  const { address, isConnected, onTiramisu, arkiv, ensureTiramisu } =
    useArkivWallet();
  const [log, setLog] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [agentAllowed, setAgentAllowed] = useState(false);
  const [nid, setNid] = useState<string | null>(null);
  const [note, setNote] = useState<NoteView | null>(null);
  const [gateBefore, setGateBefore] = useState<GateResult | null>(null);
  const [gateAfter, setGateAfter] = useState<GateResult | null>(null);
  const [endorseTx, setEndorseTx] = useState<string | null>(null);
  const [endorseDecision, setEndorseDecision] = useState<
    "approve" | "reject" | null
  >(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [prompt, setPrompt] = useState(
    "Write a sealed Grove note titled 'Session memory' saying we verified Tiramisu handoff works. Keep it synthetic.",
  );
  const [noteTitle, setNoteTitle] = useState("Field brief — Oct 19");
  const [noteBody, setNoteBody] = useState(
    "Tiramisu RPC stay keyed, vault decrypt works after endorse, and the live playground handoff is confirmed.",
  );
  const [claudeOk, setClaudeOk] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("connect");
  const [fromMcp, setFromMcp] = useState(false);
  const [nidDraft, setNidDraft] = useState("");
  const [bootstrappedNid, setBootstrappedNid] = useState(false);

  const push = useCallback((text: string, links?: ActivityLink[]) => {
    setLog((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time: new Date().toLocaleTimeString(),
          text,
          links,
        },
        ...prev,
      ].slice(0, 50),
    );
  }, []);

  const openNoteForEndorse = useCallback(
    async (rawNid: string, opts?: { fromMcp?: boolean }) => {
      const clean = rawNid.trim();
      if (!clean) return;
      setError(null);
      setNid(clean);
      setEndorseTx(null);
      setEndorseDecision(null);
      setGateAfter(null);
      if (opts?.fromMcp) setFromMcp(true);
      try {
        const nte = await refreshNote(clean);
        if (!nte) {
          setError(`No note found for nid ${clean}`);
          push(`Could not load nid ${clean}`);
          return;
        }
        if (address) {
          const g = await fetchGate(clean);
          setGateBefore(g);
          if (g.reason === "creator_not_allowlisted") {
            setAgentAllowed(false);
          } else {
            setAgentAllowed(true);
          }
          push(
            `Loaded note for endorse · gate ${g.allow ? "ALLOW" : "REJECT"} (${g.reason ?? g.label ?? "ok"})`,
            [{ label: `nid ${clean}`, href: entityUrl(nte.key) }],
          );
        } else {
          setGateBefore(null);
          push(`Loaded nid ${clean} — connect wallet to endorse`, [
            { label: `nid ${clean}`, href: entityUrl(nte.key) },
          ]);
        }
        setStep(address ? "endorse" : "connect");
      } catch (e) {
        setError(String(e));
        push(`Load nid failed: ${String(e)}`);
      }
    },
    // refreshNote/fetchGate close over address; keep deps minimal
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, push],
  );

  useEffect(() => {
    push("Connect your wallet — you will be the vault owner who endorses.");
    fetch("/api/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [],
        ownerAddress:
          publicConfig.ownerAddress ||
          "0x0000000000000000000000000000000000000001",
      }),
    })
      .then(async (r) => {
        if (r.status === 503) setClaudeOk(false);
        else setClaudeOk(true);
      })
      .catch(() => setClaudeOk(false));

    const params = new URLSearchParams(window.location.search);
    const q = params.get("nid")?.trim();
    const mcp = params.get("from") === "mcp";
    if (q) {
      setFromMcp(mcp);
      setNidDraft(q);
      setBootstrappedNid(true);
      void openNoteForEndorse(q, { fromMcp: mcp });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push]);

  useEffect(() => {
    if (!isConnected) {
      if (!nid) setStep("connect");
      return;
    }
    if (step !== "connect") return;
    // MCP / deep-link: skip allowlist + write wizards and go endorse
    if (nid || bootstrappedNid) {
      setStep("endorse");
      if (nid) void openNoteForEndorse(nid, { fromMcp });
      return;
    }
    setStep("allow");
  }, [isConnected, step, nid, bootstrappedNid, fromMcp, openNoteForEndorse]);

  async function fetchGate(n: string): Promise<GateResult> {
    if (!address) return { allow: false, reason: "no_wallet" };
    const res = await fetch(
      `/api/demo/gate?nid=${encodeURIComponent(n)}&owner=${address}`,
    );
    return (await res.json()) as GateResult;
  }

  async function refreshNote(n: string) {
    const nte = await loadNoteByNid(n);
    setNote(nte);
    return nte;
  }

  async function registerAgent() {
    if (!arkiv || !address || !publicConfig.agentAAddress) return;
    setBusy("allow");
    setError(null);
    try {
      await ensureTiramisu();
      push("Confirm allowlist in your wallet…");
      const created = await allowAgentWithWallet(
        arkiv as never,
        publicConfig.agentAAddress,
        "Demo Agent A (MCP)",
      );
      setAgentAllowed(true);
      push(`Agent allowlisted on-chain`, [
        { label: shortHash(created.txHash), href: txUrl(created.txHash) },
        {
          label: "entity",
          href: entityUrl(created.entityKey),
        },
      ]);
      if (nid) {
        const g = await fetchGate(nid);
        setGateBefore(g);
        setStep("endorse");
      } else {
        setStep("write");
      }
    } catch (e) {
      setError(String(e));
      push(`Allowlist failed: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function askClaude() {
    if (!address) return;
    setBusy("claude");
    setError(null);
    const next: ChatMsg[] = [...chat, { role: "user", content: prompt }];
    setChat(next);
    push("Claude agent calling Grove tools (same as MCP)…");
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, ownerAddress: address }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        reply?: string;
        toolCalls?: Array<{
          name: string;
          result?: { nid?: string; entityKey?: string; status?: string };
        }>;
      };
      if (res.status === 503) {
        setClaudeOk(false);
        throw new Error(data.message ?? "Claude not configured");
      }
      if (!res.ok) throw new Error(data.error ?? "agent failed");
      setChat([...next, { role: "assistant", content: data.reply ?? "" }]);
      push(data.reply?.slice(0, 120) ?? "Agent replied");
      const write = data.toolCalls?.find((t) => t.name === "grove_write_note");
      if (write?.result?.nid) {
        setNid(write.result.nid);
        setEndorseTx(null);
        setEndorseDecision(null);
        const nte = await refreshNote(write.result.nid);
        const g = await fetchGate(write.result.nid);
        setGateBefore(g);
        setGateAfter(null);
        push(
          `Note written · gate BEFORE ${g.allow ? "ALLOW" : "REJECT"} (${g.reason})`,
          [
            ...(nte
              ? [{ label: `nid ${write.result.nid}`, href: entityUrl(nte.key) }]
              : []),
            ...(write.result.entityKey
              ? [
                  {
                    label: "entity",
                    href: entityUrl(write.result.entityKey),
                  },
                ]
              : []),
          ],
        );
        setStep("endorse");
      }
    } catch (e) {
      setError(String(e));
      push(`Agent error: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function triggerMcpEquivalentWrite() {
    if (!address) return;
    setBusy("write");
    setError(null);
    push("Demo agent write (same path as MCP grove_write_note)…");
    try {
      const res = await fetch("/api/demo/write", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerAddress: address,
          title: noteTitle.trim() || "MCP-equivalent note",
          body:
            noteBody.trim() ||
            "Written with the same server path as grove_write_note. Human must endorse.",
          tags: ["mcp", "synthetic", "live"],
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        nid?: string;
        explorer?: string;
        entityKey?: string;
        status?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "write failed");
      setNid(data.nid!);
      setEndorseTx(null);
      setEndorseDecision(null);
      const nte = await refreshNote(data.nid!);
      const g = await fetchGate(data.nid!);
      setGateBefore(g);
      setGateAfter(null);
      push(`Sealed note created · status ${data.status}`, [
        {
          label: `nid ${data.nid}`,
          href: entityUrl(nte?.key ?? data.entityKey ?? ""),
        },
        ...(data.explorer
          ? [{ label: "explorer", href: data.explorer }]
          : data.entityKey
            ? [{ label: "entity", href: entityUrl(data.entityKey) }]
            : []),
      ]);
      setStep("endorse");
    } catch (e) {
      setError(String(e));
      push(`Write failed: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!arkiv || !address || !note) return;
    setBusy(decision);
    setError(null);
    try {
      await ensureTiramisu();
      push(`Confirm ${decision} in your wallet…`);
      const result = await endorseWithWallet(
        arkiv as never,
        note,
        decision,
        address,
      );
      const hash = result.txHashes[0];
      if (hash) setEndorseTx(hash);
      setEndorseDecision(decision);
      push(`Endorsement submitted on Tiramisu`, [
        ...(hash
          ? [{ label: `tx ${shortHash(hash)}`, href: txUrl(hash) }]
          : []),
        {
          label: "endorsement entity",
          href: entityUrl(result.endorsementKey),
        },
        { label: "note entity", href: entityUrl(note.key) },
      ]);
      await new Promise((r) => setTimeout(r, 2500));
      const g = await fetchGate(note.nid);
      setGateAfter(g);
      push(
        g.allow
          ? `Gate flipped · ALLOW · ${g.label ?? "endorsed"}`
          : `Gate result · REJECT · ${g.reason}`,
        [
          ...(hash ? [{ label: "tx", href: txUrl(hash) }] : []),
          {
            label: "endorsement",
            href: entityUrl(result.endorsementKey),
          },
          { label: "note", href: entityUrl(note.key) },
        ],
      );
    } catch (e) {
      setError(String(e));
      push(`Endorse failed: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  const done = Boolean(endorseDecision && gateAfter);
  const doneOk = gateAfter?.allow === true;

  const tabs = useMemo(
    () =>
      [
        { id: "connect" as const, label: "1 · Connect", locked: false },
        {
          id: "allow" as const,
          label: "2 · Allowlist",
          locked: !isConnected,
        },
        {
          id: "write" as const,
          label: "3 · Write",
          locked: !isConnected,
        },
        {
          id: "endorse" as const,
          label: "4 · Endorse",
          locked: !isConnected,
        },
      ] as const,
    [isConnected],
  );

  return (
    <div className="desk-grid desk-fill">
      <PageHeader title="Live playground">
        Agent writes sealed ciphertext. You endorse with your wallet. Gate flips
        on Tiramisu.
      </PageHeader>

      <div className="live-board">
        <div className="live-main">
          <div className="step-tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={step === t.id}
                disabled={t.locked}
                onClick={() => setStep(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {step === "connect" && (
            <section className="sheet">
              <div className="sheet-pad">
                <p className="sheet-label">Step 1</p>
                <h2 className="sheet-title">Connect as the human owner</h2>
                <p className="sheet-copy">
                  Need test GLM on Tiramisu.{" "}
                  <a
                    href="https://hub.arkiv.network/faucet"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open faucet
                  </a>
                </p>
                <div className="mt-3">
                  <ConnectWallet />
                </div>
              </div>
            </section>
          )}

          {step === "allow" && isConnected && (
            <section className="sheet">
              <div className="sheet-pad">
                <p className="sheet-label">Step 2</p>
                <h2 className="sheet-title">Allowlist the demo agent</h2>
                <p className="sheet-copy">
                  One wallet signature creates an on-chain agent entity.
                </p>
                <p className="d-data mt-2">
                  {publicConfig.agentAAddress ||
                    "(set NEXT_PUBLIC_AGENT_A_ADDRESS)"}
                </p>
                <div className="sheet-actions">
                  <button
                    type="button"
                    disabled={!!busy || !onTiramisu || !arkiv}
                    onClick={() => void registerAgent()}
                    className="d-btn d-btn-signal"
                  >
                    {busy === "allow"
                      ? "Confirm in wallet…"
                      : agentAllowed
                        ? "Allowlisted ✓"
                        : "Allowlist Agent A"}
                  </button>
                  {agentAllowed && (
                    <button
                      type="button"
                      className="d-btn d-btn-line"
                      onClick={() => setStep("write")}
                    >
                      Continue →
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {step === "write" && isConnected && (
            <section className="sheet">
              <div className="sheet-pad">
                <p className="sheet-label">Step 3</p>
                <h2 className="sheet-title">Agent writes</h2>
                <p className="sheet-copy">
                  Pick how the agent creates the sealed note. Your connected
                  wallet ({address?.slice(0, 6)}…{address?.slice(-4)}) receives
                  ownership, then you endorse in step 4.
                </p>

                <div className="write-paths mt-4">
                  <div className="write-path write-path-focus">
                    <p className="sheet-label">Option A · Recommended</p>
                    <h3 className="write-path-title">Any AI via Grove MCP</h3>
                    <p className="sheet-copy">
                      Connect Claude.ai, Cursor, ChatGPT (where MCP is
                      supported), or Claude Desktop to the remote MCP URL, then
                      ask that AI to call <code className="font-mono">grove_write_note</code>{" "}
                      with your wallet as <code className="font-mono">ownerAddress</code>.
                    </p>
                    <p className="d-data mt-2 break-all">
                      ownerAddress: {address}
                    </p>
                    <div className="sheet-actions">
                      <Link href="/app/mcp" className="d-btn d-btn-signal">
                        Connect MCP clients
                      </Link>
                      <button
                        type="button"
                        className="d-btn d-btn-line"
                        onClick={() => {
                          if (!address) return;
                          void navigator.clipboard.writeText(address);
                          push("Copied your wallet address for MCP ownerAddress");
                        }}
                      >
                        Copy wallet address
                      </button>
                    </div>
                    <p className="sheet-copy mt-2 text-xs">
                      After the AI writes, open{" "}
                      <Link href="/app/mcp" className="underline">
                        Connect MCP → Approve
                      </Link>
                      — drafts for your wallet appear there automatically.
                    </p>
                    <div className="sheet-actions">
                      <Link href="/app/mcp" className="d-btn d-btn-line">
                        Open MCP Approve queue
                      </Link>
                    </div>
                  </div>

                  <div className="write-path">
                    <p className="sheet-label">Option B · In this page</p>
                    <h3 className="write-path-title">Demo agent write</h3>
                    <p className="sheet-copy">
                      Same on-chain path as MCP <code className="font-mono">grove_write_note</code>,
                      without leaving the site. Good for a quick judge walkthrough.
                    </p>
                    <label className="mt-3 block text-xs text-[var(--mute)]">
                      Note title
                      <input
                        className="d-field mt-1"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="Note title"
                      />
                    </label>
                    <label className="mt-2 block text-xs text-[var(--mute)]">
                      Note body
                      <textarea
                        className="d-area mt-1"
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        rows={3}
                      />
                    </label>
                    <div className="sheet-actions">
                      <button
                        type="button"
                        disabled={
                          !!busy || !noteTitle.trim() || !noteBody.trim()
                        }
                        onClick={() => void triggerMcpEquivalentWrite()}
                        className="d-btn d-btn-signal"
                      >
                        {busy === "write" ? "Writing…" : "Write as Agent A"}
                      </button>
                    </div>
                  </div>

                  <div className="write-path">
                    <p className="sheet-label">Option C · Optional</p>
                    <h3 className="write-path-title">Server-side Claude</h3>
                    <p className="sheet-copy">
                      Uses <code className="font-mono">ANTHROPIC_API_KEY</code> on
                      this deploy to drive the same write tool from a freeform
                      prompt. Not required if you use Option A or B.
                    </p>
                    {claudeOk === false && (
                      <p className="sheet-copy mt-2">
                        No API key configured on this host. Use MCP (A) or Write
                        as Agent A (B).
                      </p>
                    )}
                    <label className="mt-3 block text-xs text-[var(--mute)]">
                      Prompt
                      <textarea
                        className="d-area mt-1"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={claudeOk === false}
                      />
                    </label>
                    <div className="sheet-actions">
                      <button
                        type="button"
                        disabled={!!busy || claudeOk === false}
                        onClick={() => void askClaude()}
                        className="d-btn d-btn-line"
                      >
                        {busy === "claude" ? "Working…" : "Ask Claude API"}
                      </button>
                    </div>
                    {chat.length > 0 && (
                      <ul className="mt-3 max-h-36 space-y-2 overflow-auto border-t border-[var(--line)] pt-3 text-sm">
                        {chat.map((m, i) => (
                          <li key={i}>
                            <span className="d-chip">{m.role}</span>
                            <p className="mt-1 whitespace-pre-wrap text-[var(--mute)]">
                              {m.content}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === "endorse" && !nid && (
            <section className="sheet">
              <div className="sheet-pad">
                <p className="sheet-label">Step 4 · Endorse</p>
                <h2 className="sheet-title">Paste a note id from MCP</h2>
                <p className="sheet-copy">
                  After Claude / Cursor returns an <code className="font-mono">nid</code>,
                  paste it here to approve — you do not need the Allowlist or Write
                  steps again for that note.
                </p>
                <label className="mt-3 block text-xs text-[var(--mute)]">
                  nid
                  <input
                    className="d-field mt-1 font-mono"
                    value={nidDraft}
                    onChange={(e) => setNidDraft(e.target.value)}
                    placeholder="e.g. a1b2c3d4…"
                  />
                </label>
                <div className="sheet-actions">
                  <button
                    type="button"
                    className="d-btn d-btn-signal"
                    disabled={!nidDraft.trim() || !!busy}
                    onClick={() =>
                      void openNoteForEndorse(nidDraft, { fromMcp: true })
                    }
                  >
                    Load note · Endorse
                  </button>
                  <Link href="/app/pending" className="d-btn d-btn-line">
                    Open Pending queue
                  </Link>
                </div>
              </div>
            </section>
          )}

          {step === "endorse" && nid && (
            <section className="sheet endorse-sheet">
              <div className="sheet-pad endorse-panel">
                <p className="sheet-label">
                  {fromMcp ? "MCP write · Endorse" : "Step 4 · Endorse"}
                </p>
                <h2 className="sheet-title endorse-title">
                  {done
                    ? doneOk
                      ? "Note endorsed"
                      : "Note rejected"
                    : "Human endorsement required"}
                </h2>
                <p className="sheet-copy">
                  {done
                    ? doneOk
                      ? "evaluateNote() now allows this note. Agents can treat it as trusted memory."
                      : "You rejected this draft. The gate stays closed — no note body for readers."
                    : "Until you sign, every reader gets REJECT · pending_review. Approve binds your wallet to this ciphertext hash."}
                </p>

                {gateBefore?.reason === "creator_not_allowlisted" && !done && (
                  <div className="mcp-warn mt-3">
                    <p>
                      Demo Agent A is not allowlisted yet — required once so the
                      gate can allow this creator after you Approve.
                    </p>
                    <div className="sheet-actions" style={{ marginTop: "0.75rem" }}>
                      <button
                        type="button"
                        disabled={!!busy || !onTiramisu || !arkiv}
                        onClick={() => void registerAgent()}
                        className="d-btn d-btn-signal"
                      >
                        {busy === "allow"
                          ? "Confirm in wallet…"
                          : "Allowlist Agent A"}
                      </button>
                    </div>
                  </div>
                )}

                <dl className="endorse-meta">
                  <div>
                    <dt>Note ID</dt>
                    <dd>
                      <code>{nid}</code>
                    </dd>
                  </div>
                  {note && (
                    <div>
                      <dt>On-chain entity</dt>
                      <dd>
                        <a
                          href={entityUrl(note.key)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open note entity →
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="gate-rail" aria-label="Gate before and after">
                  <div
                    className={`gate-rail-cell ${
                      gateBefore?.allow
                        ? "is-allow"
                        : gateBefore
                          ? "is-reject"
                          : ""
                    }`}
                  >
                    <p className="gate-rail-kicker">Gate before</p>
                    <p className="gate-rail-verdict">
                      {gateBefore
                        ? gateBefore.allow
                          ? "Allow"
                          : "Reject"
                        : "—"}
                    </p>
                    <p className="gate-rail-detail">
                      {gateBefore
                        ? gateBefore.allow
                          ? gateBefore.label || "ok"
                          : gateBefore.reason || "blocked"
                        : "waiting"}
                    </p>
                  </div>
                  <div className="gate-rail-arrow" aria-hidden>
                    →
                  </div>
                  <div
                    className={`gate-rail-cell ${
                      gateAfter?.allow
                        ? "is-allow"
                        : gateAfter
                          ? "is-reject"
                          : "is-wait"
                    }`}
                  >
                    <p className="gate-rail-kicker">Gate after</p>
                    <p className="gate-rail-verdict">
                      {gateAfter
                        ? gateAfter.allow
                          ? "Allow"
                          : "Reject"
                        : "Waiting"}
                    </p>
                    <p className="gate-rail-detail">
                      {gateAfter
                        ? gateAfter.allow
                          ? gateAfter.label || "endorsed"
                          : gateAfter.reason || "blocked"
                        : "Sign approve or reject"}
                    </p>
                  </div>
                </div>

                {done ? (
                  <div
                    className={`endorse-result ${doneOk ? "is-ok" : "is-bad"}`}
                  >
                    <div>
                      <p className="endorse-result-kicker">
                        {doneOk ? "Endorsed on Tiramisu" : "Rejected on Tiramisu"}
                      </p>
                      <p className="endorse-result-copy">
                        Decision: <strong>{endorseDecision}</strong>
                        {gateAfter?.label ? ` · ${gateAfter.label}` : ""}
                        {gateAfter?.reason && !doneOk
                          ? ` · ${gateAfter.reason}`
                          : ""}
                      </p>
                    </div>
                    <div className="endorse-result-links">
                      {endorseTx && (
                        <a
                          className="d-btn d-btn-signal"
                          href={txUrl(endorseTx)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View endorsement tx
                        </a>
                      )}
                      {note && (
                        <a
                          className="d-btn d-btn-line"
                          href={entityUrl(note.key)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View note entity
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="endorse-actions">
                    <button
                      type="button"
                      disabled={!!busy || !note}
                      onClick={() => void decide("approve")}
                      className="d-btn d-btn-signal"
                    >
                      {busy === "approve" ? "Confirm in wallet…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !note}
                      onClick={() => void decide("reject")}
                      className="d-btn d-btn-bad"
                    >
                      {busy === "reject" ? "Confirm in wallet…" : "Reject"}
                    </button>
                    {note && (
                      <a
                        className="d-btn d-btn-line"
                        href={entityUrl(note.key)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Explorer
                      </a>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {error && (
            <p className="sheet sheet-pad text-sm text-[var(--bad)]">{error}</p>
          )}
        </div>

        <aside className="live-side">
          <section className="sheet">
            <div className="sheet-pad">
              <p className="sheet-label">Activity</p>
              <ul className="activity-list">
                {log.map((item) => (
                  <li key={item.id} className="activity-item">
                    <span className="activity-time">{item.time}</span>
                    <p className="activity-text">{item.text}</p>
                    {item.links && item.links.length > 0 && (
                      <div className="activity-links">
                        {item.links
                          .filter((l) => l.href)
                          .map((l) => (
                            <a
                              key={`${item.id}-${l.href}-${l.label}`}
                              href={l.href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {l.label}
                            </a>
                          ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-[var(--mute)]">
                <Link href="/app/attack" className="text-[var(--signal)]">
                  Attack board
                </Link>{" "}
                · seeded A–G proofs
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
