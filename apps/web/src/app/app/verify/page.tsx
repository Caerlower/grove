"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { verifyEntity } from "@/lib/grove-client";

export default function VerifyPage() {
  const [key, setKey] = useState("");
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof verifyEntity>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await verifyEntity(key.trim()));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desk-grid desk-fill">
      <PageHeader title="Verify">
        Recheck authorship and endorsement against live ciphertext.
      </PageHeader>

      <div className="verify-board">
        <section className="sheet">
          <div className="sheet-pad">
            <p className="sheet-label">Entity</p>
            <h2 className="sheet-title">Paste a note key</h2>
            <p className="sheet-copy">
              No vault key needed. We re-fetch the entity and compare the live
              payload hash to any owner endorsement.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className="d-field flex-1 font-mono"
                placeholder="0x… note entity key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !key.trim()}
                onClick={run}
                className="d-btn d-btn-signal"
              >
                {busy ? "Checking…" : "Verify"}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-[var(--bad)]">{error}</p>
            )}
          </div>
        </section>

        <section className="sheet">
          <div className="sheet-pad">
            {!result && (
              <>
                <p className="sheet-label">Result</p>
                <h2 className="sheet-title">Waiting for a key</h2>
                <p className="sheet-copy">
                  Paste an entity key from the explorer, Live playground, or
                  Attack board to see creator, owner, expiry, and hash match.
                </p>
              </>
            )}
            {result && !result.found && (
              <>
                <p className="sheet-label">Result</p>
                <h2 className="sheet-title">Not found</h2>
                <p className="sheet-copy text-[var(--warn)]">
                  Entity missing — expired, deleted, or wrong key.
                </p>
              </>
            )}
            {result?.found && (
              <>
                <p className="sheet-label">Result</p>
                <div className="mt-2">
                  <span
                    className={`d-chip ${result.hashMatches ? "ok" : "bad"}`}
                  >
                    hash {result.hashMatches ? "matches" : "mismatch"}
                  </span>
                </div>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["$creator", result.note.creator],
                      ["$owner", result.note.owner],
                      [
                        "expiresAt",
                        result.note.expiresAtBlock?.toString() ?? "—",
                      ],
                      ["contentType", result.note.contentType],
                      ["live payloadSha256", result.liveHash],
                      [
                        "endorsement",
                        result.endorsement
                          ? `${result.endorsement.decision} · ${result.endorsement.payloadSha256.slice(0, 18)}…`
                          : "none",
                      ],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k}>
                      <dt className="d-data">{k}</dt>
                      <dd className="mt-1 break-all font-mono text-xs">{v}</dd>
                    </div>
                  ))}
                </dl>
                <a
                  href={result.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-sm font-medium text-[var(--signal)]"
                >
                  Open in explorer →
                </a>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
