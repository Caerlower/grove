"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { KeyGate } from "@/components/KeyGate";
import { PageHeader } from "@/components/PageHeader";
import { endorseWithWallet } from "@/lib/browser-arkiv";
import { loadPending } from "@/lib/grove-client";
import { publicConfig } from "@/lib/config";
import { useArkivWallet } from "@/lib/useArkivWallet";

type Item = Awaited<ReturnType<typeof loadPending>>[number];

export default function PendingPage() {
  return (
    <div className="desk-grid desk-fill">
      <PageHeader title="Pending review">
        Drafts handed to your connected wallet.{" "}
        <Link href="/app/live">Live playground</Link>
      </PageHeader>
      <KeyGate>{(key) => <PendingInner vaultKeyRaw={key} />}</KeyGate>
    </div>
  );
}

function PendingInner({ vaultKeyRaw }: { vaultKeyRaw: string }) {
  const { address, isConnected, onTiramisu, arkiv, ensureTiramisu } =
    useArkivWallet();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyNid, setBusyNid] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!address) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadPending(vaultKeyRaw, { ownerAddress: address })
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [vaultKeyRaw, address]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function decide(item: Item, decision: "approve" | "reject") {
    if (!address || !arkiv) return;
    setBusyNid(item.note.nid);
    setFlash(null);
    setError(null);
    try {
      await ensureTiramisu();
      await endorseWithWallet(arkiv as never, item.note, decision, address);
      setFlash(`${decision} submitted`);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyNid(null);
    }
  }

  if (!isConnected || !address) {
    return (
      <div className="sheet sheet-pad">
        <p className="sheet-label">Vault owner</p>
        <h2 className="sheet-title">Connect your wallet</h2>
        <p className="sheet-copy mt-2">
          Pending shows drafts owned by the connected address.
        </p>
        <div className="mt-4">
          <ConnectWallet />
        </div>
      </div>
    );
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
                    disabled={
                      !!busyNid || !onTiramisu || !arkiv
                    }
                    onClick={() => void decide(item, "approve")}
                    className="d-btn d-btn-signal"
                  >
                    {busyNid === item.note.nid ? "Signing…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !!busyNid || !onTiramisu || !arkiv
                    }
                    onClick={() => void decide(item, "reject")}
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
