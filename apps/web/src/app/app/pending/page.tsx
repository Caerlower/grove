"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KeyGate } from "@/components/KeyGate";
import { PageHeader } from "@/components/PageHeader";
import { loadPending } from "@/lib/grove-client";
import { publicConfig } from "@/lib/config";

type Item = Awaited<ReturnType<typeof loadPending>>[number];

export default function PendingPage() {
  return (
    <div className="desk-grid desk-fill">
      <PageHeader title="Pending review">
        Approve or reject drafts on Tiramisu.{" "}
        <Link href="/app/live">Live playground</Link>
      </PageHeader>
      <KeyGate>{(key) => <PendingInner vaultKeyRaw={key} />}</KeyGate>
    </div>
  );
}

function PendingInner({ vaultKeyRaw }: { vaultKeyRaw: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyNid, setBusyNid] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    loadPending(vaultKeyRaw)
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [vaultKeyRaw]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function decide(nid: string, decision: "approve" | "reject") {
    setBusyNid(nid);
    setFlash(null);
    setError(null);
    try {
      const res = await fetch("/api/demo/endorse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nid, decision }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      setFlash(data.message ?? `${decision} submitted`);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyNid(null);
    }
  }

  return (
    <div className="desk-grid">
      {flash && <div className="d-banner text-[var(--ok)]">{flash}</div>}
      {loading && items.length === 0 && <p className="d-empty">Loading queue…</p>}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

      <section className="sheet">
        <div className="sheet-pad">
          <p className="sheet-label">Queue</p>
          <h2 className="sheet-title">{items.length} drafts waiting</h2>
          <ul className="d-rows mt-4">
            {!loading && items.length === 0 && (
              <li className="d-empty">
                Queue empty.{" "}
                <Link href="/app/live">Write a note in Live</Link>.
              </li>
            )}
            {items.map((item) => (
              <li key={item.note.key} className="d-row">
                <span className="d-chip warn">
                  {item.tier} · {item.sampleReason}
                </span>
                <h3>{item.title}</h3>
                <p className="body whitespace-pre-wrap">{item.body}</p>
                <div className="sheet-actions">
                  <button
                    type="button"
                    disabled={busyNid === item.note.nid}
                    onClick={() => void decide(item.note.nid, "approve")}
                    className="d-btn d-btn-signal"
                  >
                    {busyNid === item.note.nid ? "Signing…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={busyNid === item.note.nid}
                    onClick={() => void decide(item.note.nid, "reject")}
                    className="d-btn d-btn-bad"
                  >
                    Reject
                  </button>
                  <a
                    className="d-link self-center"
                    href={`${publicConfig.explorer}/entity/${item.note.key}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on explorer →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
