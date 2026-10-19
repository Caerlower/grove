"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { KeyGate } from "@/components/KeyGate";
import { WalletTxHint } from "@/components/WalletTxHint";
import { endorseWithWallet } from "@/lib/browser-arkiv";
import { loadOwnerDrafts } from "@/lib/grove-client";
import { publicConfig } from "@/lib/config";
import { useArkivWallet } from "@/lib/useArkivWallet";

type Item = Awaited<ReturnType<typeof loadOwnerDrafts>>[number];

/** Polls drafts owned by the connected wallet (MCP writes land here). */
export function OwnerDraftQueue({
  emptyHint,
  pollMs = 8_000,
}: {
  emptyHint?: React.ReactNode;
  pollMs?: number;
}) {
  return (
    <KeyGate title="Unlock to see MCP drafts">
      {(key) => (
        <OwnerDraftQueueInner
          vaultKeyRaw={key}
          emptyHint={emptyHint}
          pollMs={pollMs}
        />
      )}
    </KeyGate>
  );
}

function OwnerDraftQueueInner({
  vaultKeyRaw,
  emptyHint,
  pollMs,
}: {
  vaultKeyRaw: string;
  emptyHint?: React.ReactNode;
  pollMs: number;
}) {
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
    loadOwnerDrafts(vaultKeyRaw, { ownerAddress: address })
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [vaultKeyRaw, address]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  async function decide(item: Item, decision: "approve" | "reject") {
    if (!address || !arkiv) return;
    setBusyNid(item.note.nid);
    setFlash(null);
    setError(null);
    try {
      await ensureTiramisu();
      await endorseWithWallet(arkiv as never, item.note, decision, address);
      setFlash(`${decision} submitted · nid ${item.note.nid}`);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyNid(null);
    }
  }

  if (!isConnected || !address) {
    return (
      <div className="mcp-queue-connect">
        <p className="sheet-copy">
          Connect the same wallet you passed as{" "}
          <code className="font-mono">ownerAddress</code> — MCP drafts show up
          here automatically.
        </p>
        <div className="mt-3">
          <ConnectWallet />
        </div>
      </div>
    );
  }

  return (
    <div className="mcp-queue">
      {flash && <div className="d-banner text-[var(--ok)]">{flash}</div>}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

      <div className="mcp-queue-head">
        <div>
          <p className="sheet-label">Your wallet</p>
          <p className="d-data break-all">{address}</p>
        </div>
        <button
          type="button"
          className="d-btn d-btn-line"
          onClick={() => refresh()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading && items.length === 0 && (
        <p className="d-empty mt-3">Looking for MCP drafts…</p>
      )}

      {items.length > 0 && <WalletTxHint />}

      <ul className="d-rows mt-3">
        {!loading && items.length === 0 && (
          <li className="d-empty">
            {emptyHint ?? (
              <>
                No drafts yet. Ask the AI to call{" "}
                <code className="font-mono">grove_write_note</code> with this
                wallet as <code className="font-mono">ownerAddress</code>, then
                wait a few seconds.
              </>
            )}
          </li>
        )}
        {items.map((item) => (
          <li key={item.note.key} className="d-row">
            <span className="d-chip warn">pending · {item.note.nid}</span>
            <h3>{item.title}</h3>
            <p className="body whitespace-pre-wrap">{item.body}</p>
            <div className="sheet-actions">
              <button
                type="button"
                disabled={!!busyNid || !onTiramisu || !arkiv}
                onClick={() => void decide(item, "approve")}
                className="d-btn d-btn-signal"
              >
                {busyNid === item.note.nid ? "Signing…" : "Approve"}
              </button>
              <button
                type="button"
                disabled={!!busyNid || !onTiramisu || !arkiv}
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
                Explorer →
              </a>
              <Link
                href={`/app/live?nid=${encodeURIComponent(item.note.nid)}&from=mcp`}
                className="d-link self-center"
              >
                Gate detail →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
