"use client";

import { useEffect, useState } from "react";
import {
  computeTrustTier,
  evaluateNote,
  importVaultKey,
  wrapUntrustedNote,
  openNoteContent,
  type EndorsementView,
} from "@grove/core";
import { getAddress } from "viem";
import { KeyGate } from "@/components/KeyGate";
import { PageHeader } from "@/components/PageHeader";
import { groveCfg, publicConfig } from "@/lib/config";
import { loadNoteByEntityKey } from "@/lib/grove-client";

type Scenario = {
  id: string;
  description: string;
  expect: string;
  nid?: string;
  entityKey?: string;
  verdict?: { allow: boolean; reason: string; label: string };
};

type Verdict = {
  id: string;
  description: string;
  expect: string;
  allow: boolean;
  reason: string;
  label: string;
  entityKey?: string;
  mcpStyle: unknown;
  pass: boolean;
  source: "live" | "seed";
};

function expectPass(v: Verdict): boolean {
  if (v.id === "F" || v.id === "G") return v.allow;
  return !v.allow;
}

export default function AttackPage() {
  return (
    <div className="desk-grid desk-fill">
      <PageHeader title="Attack demo">
        Seven seeded Tiramisu cases that prove the gate rejects poison and
        allows only endorsed (or trusted-unreviewed) notes — same{" "}
        <code className="font-mono text-[0.85em]">evaluateNote</code> as MCP.
      </PageHeader>
      <KeyGate title="Unlock attack board">
        {(key) => <AttackInner vaultKeyRaw={key} />}
      </KeyGate>
    </div>
  );
}

function AttackInner({ vaultKeyRaw }: { vaultKeyRaw: string }) {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("A");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/seed-result.json");
        if (!res.ok) {
          throw new Error("Missing /seed-result.json — run pnpm seed");
        }
        const data = (await res.json()) as { scenarios: Scenario[] };
        const snapRes = await fetch("/api/vault/snapshot", {
          cache: "no-store",
        });
        const snap = (await snapRes.json()) as {
          error?: string;
          allow?: Array<{ addr: string }>;
          endorsements?: EndorsementView[];
        };
        if (!snapRes.ok) {
          throw new Error(snap.error ?? "Vault snapshot failed");
        }
        const cfg = groveCfg();
        const allowlist = new Set(
          (snap.allow ?? []).map((a) => a.addr.toLowerCase()),
        );
        const allEndorsements = snap.endorsements ?? [];
        const vaultKey = await importVaultKey(vaultKeyRaw);

        // Parallel entity loads (keyed server RPC)
        const loaded = await Promise.all(
          data.scenarios.map(async (s) => ({
            s,
            note: s.entityKey
              ? await loadNoteByEntityKey(s.entityKey)
              : null,
          })),
        );

        const out: Verdict[] = [];
        let liveCount = 0;
        for (const { s, note } of loaded) {
          if (!s.entityKey) continue;

          if (!note) {
            const recorded = s.verdict;
            out.push({
              id: s.id,
              description: s.description,
              expect: s.expect,
              allow: recorded?.allow ?? false,
              reason: recorded?.reason ?? "not_found",
              label: recorded?.label ?? "none",
              entityKey: s.entityKey,
              source: "seed",
              mcpStyle: {
                allow: recorded?.allow ?? false,
                reason: recorded?.reason ?? "entity_expired",
                source: "seed-result.json",
                note: "On-chain entity expired or missing — showing recorded seed verdict. Re-run pnpm seed for a live gate.",
              },
              pass: false,
            });
            const row = out[out.length - 1]!;
            row.pass = expectPass(row);
            continue;
          }

          liveCount += 1;
          const endorsements = allEndorsements.filter(
            (e) => e.nid === note.nid,
          );
          const stats = computeTrustTier(note.creator, allEndorsements);
          const gate = await evaluateNote(note, {
            ownerAddress: cfg.ownerAddress,
            allowlist,
            endorsements,
            creatorTier: stats.tier,
            vaultKey,
            strict: false,
          });

          let mcpStyle: unknown;
          if (!gate.allow) {
            mcpStyle = { allow: false, reason: gate.reason, source: "live" };
          } else {
            const content = await openNoteContent(vaultKey, note.payload);
            mcpStyle = {
              allow: true,
              wrapped: wrapUntrustedNote(content),
              label: gate.label,
              warnings: gate.warnings,
              creator: getAddress(note.creator),
              source: "live",
            };
          }

          const row: Verdict = {
            id: s.id,
            description: s.description,
            expect: s.expect,
            allow: gate.allow,
            reason: gate.reason,
            label: gate.label,
            entityKey: s.entityKey,
            mcpStyle,
            pass: false,
            source: "live",
          };
          row.pass = expectPass(row);
          out.push(row);
        }

        if (!cancelled) {
          setVerdicts(out.sort((a, b) => a.id.localeCompare(b.id)));
          setSelected(out.find((x) => x.id === "A")?.id ?? out[0]?.id ?? "A");
          if (liveCount === 0) {
            setError(
              "Seeded attack entities expired on Tiramisu. Showing recorded verdicts from seed — run pnpm seed to refresh live proofs.",
            );
          } else if (liveCount < out.length) {
            setError(
              `${liveCount}/${out.length} scenarios still live on-chain; others show the recorded seed verdict (draft TTL expired).`,
            );
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultKeyRaw]);

  const active = verdicts.find((v) => v.id === selected);
  const score = verdicts.filter((v) => v.pass).length;
  const liveN = verdicts.filter((v) => v.source === "live").length;

  return (
    <div className="desk-grid">
      {loading && (
        <p className="d-empty">Fetching entities and running the gate…</p>
      )}

      {!loading && (
        <div className="sheet sheet-pad">
          <p className="sheet-label">What this is</p>
          <p className="sheet-copy">
            A board of attack / edge cases (rogue writer, skipped handoff,
            replayed content, unsealed payload, etc.). Each tab runs the same
            gate the MCP reader uses and checks whether ALLOW/REJECT matches the
            expected outcome.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-[var(--warn)] bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {!loading && verdicts.length > 0 && (
        <div className="d-banner">
          <p className="text-sm text-[var(--mute)]">
            Score{" "}
            <strong className="text-[var(--ink)]">
              {score}/{verdicts.length}
            </strong>{" "}
            · {liveN} live gate · {verdicts.length - liveN} from seed record
          </p>
          <span className="d-chip ok">A–G</span>
        </div>
      )}

      <div className="d-tabs" role="tablist">
        {verdicts.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={selected === v.id}
            onClick={() => setSelected(v.id)}
          >
            {v.id}
            <span className="ml-1 opacity-70">{v.pass ? "ok" : "x"}</span>
          </button>
        ))}
      </div>

      {active && (
        <article className="sheet">
          <div className="sheet-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="sheet-label">
                  Scenario {active.id} ·{" "}
                  {active.source === "live" ? "live gate" : "seed record"}
                </p>
                <h2 className="sheet-title">{active.description}</h2>
                <p className="sheet-copy">Expect: {active.expect}</p>
              </div>
              <span
                className={`d-gate ${active.allow ? "allow" : "reject"}`}
              >
                {active.allow ? "ALLOW" : "REJECT"} · {active.reason}
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="d-data mb-2">MCP-style tool output</p>
                <pre className="d-pre">
                  {JSON.stringify(active.mcpStyle, null, 2)}
                </pre>
              </div>
              <div className="space-y-3 text-sm text-[var(--mute)]">
                <p>
                  Gate order: allowlist → handoff → sealed → decrypt → reject
                  endorsement → approve+hash → trust tier.
                </p>
                {active.entityKey && (
                  <a
                    className="d-link"
                    href={`${publicConfig.explorer}/entity/${active.entityKey}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on explorer →
                  </a>
                )}
              </div>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
