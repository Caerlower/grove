"use client";

import { useEffect, useState } from "react";
import {
  clearSessionVaultKey,
  getSessionVaultKey,
  setSessionVaultKey,
} from "@/lib/vault-session";

export function KeyGate({
  children,
  title = "Unlock to continue",
}: {
  children: (vaultKeyRaw: string) => React.ReactNode;
  title?: string;
}) {
  const [raw, setRaw] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActive(getSessionVaultKey());
  }, []);

  async function unlockDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo-unlock");
      const data = (await res.json()) as { vaultKey?: string; error?: string };
      if (!res.ok || !data.vaultKey) {
        throw new Error(data.error ?? "Demo unlock unavailable");
      }
      setSessionVaultKey(data.vaultKey);
      setActive(data.vaultKey);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!active) {
    return (
      <section className="gate-board">
        <div className="sheet gate-panel">
          <div className="sheet-pad">
            <p className="sheet-label">Access</p>
            <h2 className="sheet-title">{title}</h2>
            <p className="sheet-copy">
              Decrypt stays in your browser. Keys live in sessionStorage except
              the seeded demo unlock.
            </p>
            <div className="sheet-actions">
              <button
                type="button"
                disabled={busy}
                onClick={unlockDemo}
                className="d-btn d-btn-signal"
              >
                {busy ? "Loading…" : "Unlock seeded demo"}
              </button>
            </div>
          </div>
        </div>
        <div className="sheet gate-panel">
          <div className="sheet-pad">
            <p className="sheet-label">Manual</p>
            <h2 className="sheet-title">Paste a vault key</h2>
            <p className="sheet-copy">
              Use your own key if you seeded locally or shared one out-of-band.
            </p>
            <input
              className="d-field font-mono mt-3"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="VAULT_KEY"
              autoComplete="off"
            />
            <div className="sheet-actions">
              <button
                type="button"
                className="d-btn d-btn-line"
                onClick={() => {
                  if (!raw.trim()) return;
                  setSessionVaultKey(raw);
                  setActive(raw.trim());
                }}
              >
                Unlock with key
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-[var(--bad)]">{error}</p>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="key-gate-live">
      <div className="d-banner">
        <span className="inline-flex items-center gap-2 text-sm text-[var(--mute)]">
          <span className="d-chip ok">unlocked</span>
          Session key active
        </span>
        <button
          type="button"
          className="d-data underline"
          onClick={() => {
            clearSessionVaultKey();
            setActive(null);
          }}
        >
          Lock
        </button>
      </div>
      <div className="key-gate-body">{children(active)}</div>
    </div>
  );
}
