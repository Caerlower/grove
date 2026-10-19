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
  const [mode, setMode] = useState<"demo" | "manual">("demo");

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
      <section className="gate-unlock">
        <div className="gate-unlock-card sheet">
          <div className="sheet-pad gate-unlock-pad">
            <p className="sheet-label">Vault access</p>
            <h2 className="sheet-title">{title}</h2>
            <p className="sheet-copy">
              Decrypt runs in your browser. Demo unlock uses the seeded key on
              the server; your own key stays in sessionStorage only.
            </p>

            <div className="gate-tabs" role="tablist" aria-label="Unlock method">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "demo"}
                className={mode === "demo" ? "gate-tab is-on" : "gate-tab"}
                onClick={() => setMode("demo")}
              >
                Seeded demo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "manual"}
                className={mode === "manual" ? "gate-tab is-on" : "gate-tab"}
                onClick={() => setMode("manual")}
              >
                Paste key
              </button>
            </div>

            {mode === "demo" ? (
              <div className="gate-panel-body">
                <p className="sheet-copy">
                  One click for judges and demos. Same vault the Attack board
                  seeds against.
                </p>
                <div className="sheet-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void unlockDemo()}
                    className="d-btn d-btn-signal"
                  >
                    {busy ? "Unlocking…" : "Unlock seeded demo"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="gate-panel-body">
                <label className="block text-xs text-[var(--mute)]">
                  Vault key
                  <input
                    className="d-field font-mono mt-1"
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    placeholder="VAULT_KEY"
                    autoComplete="off"
                  />
                </label>
                <div className="sheet-actions">
                  <button
                    type="button"
                    className="d-btn d-btn-signal"
                    disabled={!raw.trim()}
                    onClick={() => {
                      if (!raw.trim()) return;
                      setSessionVaultKey(raw);
                      setActive(raw.trim());
                    }}
                  >
                    Unlock with key
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-[var(--bad)]" role="alert">
                {error}
              </p>
            )}
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
