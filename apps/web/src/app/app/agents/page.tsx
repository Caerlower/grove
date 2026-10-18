"use client";

import { useEffect, useState } from "react";
import { TRUST } from "@grove/core";
import { PageHeader } from "@/components/PageHeader";
import { loadAgents } from "@/lib/grove-client";

type Row = Awaited<ReturnType<typeof loadAgents>>[number];

export default function AgentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents()
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="desk-grid desk-fill">
      <PageHeader title="Agents">
        On-chain allowlist · trust tiers from endorsement history.
      </PageHeader>

      {loading && <p className="d-empty">Loading allowlist…</p>}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

      <div className="agents-board">
        <section className="sheet">
          <div className="sheet-pad">
            <p className="sheet-label">Allowlist</p>
            <h2 className="sheet-title">{rows.length} agents</h2>
            <ul className="d-rows mt-4">
              {!loading && rows.length === 0 && (
                <li className="d-empty">No allowlisted agents yet.</li>
              )}
              {rows.map((r) => (
                <li key={r.addr} className="d-row">
                  <span className="d-chip">{r.tier}</span>
                  <h3>{r.label || "agent"}</h3>
                  <p className="d-data mt-1 break-all">{r.addr}</p>
                  <p className="d-data mt-2">
                    decisions={r.decisions} · approvals={r.approvals} · rejects=
                    {r.rejects} · rate={r.approvalRate.toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sheet">
          <div className="sheet-pad">
            <p className="sheet-label">Thresholds</p>
            <h2 className="sheet-title">Client trust config</h2>
            <ul className="mt-4 space-y-2.5 font-mono text-[11px] text-[var(--mute)]">
              <li>window = last {TRUST.WINDOW_SIZE} decisions</li>
              <li>new ≤ {TRUST.NEW_MAX_DECISIONS} decisions</li>
              <li>
                trusted ≥ {TRUST.TRUSTED_MIN_DECISIONS}, rate ≥{" "}
                {TRUST.TRUSTED_MIN_APPROVAL_RATE}
              </li>
              <li>
                suspended if rate &lt; {TRUST.SUSPENDED_MAX_APPROVAL_RATE}
              </li>
              <li>
                sample: sha256 % {TRUST.SAMPLE_MOD} or tag `
                {TRUST.SENSITIVE_TAG}`
              </li>
            </ul>
            <p className="sheet-copy mt-6">
              Tiers are computed client-side from endorsement history — not a
              forgeable on-chain attribute.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
