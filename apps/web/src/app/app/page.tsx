"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyGate } from "@/components/KeyGate";
import {
  ObsidianGraph,
  type GraphEdge,
  type GraphNode,
} from "@/components/ObsidianGraph";
import { PageHeader } from "@/components/PageHeader";
import { loadVaultNotes } from "@/lib/grove-client";
import { publicConfig } from "@/lib/config";

type Item = Awaited<ReturnType<typeof loadVaultNotes>>[number];

export default function VaultPage() {
  return (
    <div className="vault-page">
      <PageHeader title="Vault">
        Graph + library of sealed notes.{" "}
        <Link href="/app/attack">Attack demo</Link>
      </PageHeader>
      <KeyGate>{(key) => <VaultInner vaultKeyRaw={key} />}</KeyGate>
    </div>
  );
}

function VaultInner({ vaultKeyRaw }: { vaultKeyRaw: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Starting…");
  const [selected, setSelected] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStatus("Starting…");
    loadVaultNotes(vaultKeyRaw, {
      onStatus: (msg) => {
        if (!cancelled) setStatus(msg);
      },
    })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vaultKeyRaw, tick]);

  const { nodes, edges } = useMemo(() => {
    const nodes: GraphNode[] = items.map((item) => ({
      id: item.note.nid,
      label: item.title.slice(0, 18),
      title: item.title,
      kind: item.gate.label === "endorsed" ? "endorsed" : "amber",
    }));

    const ids = new Set(nodes.map((n) => n.id));
    const edges: GraphEdge[] = [];
    for (const item of items) {
      for (const to of item.links) {
        if (ids.has(to) && to !== item.note.nid) {
          edges.push({ from: item.note.nid, to, kind: "link" });
        }
      }
    }

    const byTag = new Map<string, string[]>();
    for (const item of items) {
      for (const t of item.tags) {
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t)!.push(item.note.nid);
      }
    }
    for (const group of byTag.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          edges.push({ from: group[i], to: group[j], kind: "affinity" });
        }
      }
    }

    return { nodes, edges };
  }, [items]);

  if (loading) {
    return (
      <div className="sheet sheet-pad">
        <p className="sheet-label">Vault</p>
        <h2 className="sheet-title">Loading notes</h2>
        <p className="sheet-copy mt-2">{status}</p>
        <p className="d-data mt-3">
          Reading sealed notes from Tiramisu — first load can take ~10–30s.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="sheet sheet-pad">
        <p className="sheet-label">Vault</p>
        <h2 className="sheet-title text-[var(--bad)]">Couldn’t load notes</h2>
        <p className="mt-2 text-sm text-[var(--bad)]">{error}</p>
        <p className="mt-2 text-sm text-[var(--mute)]">
          If you see a budget / 429 error: get a free key at{" "}
          <a
            className="d-link"
            href="https://hub.arkiv.network"
            target="_blank"
            rel="noreferrer"
          >
            hub.arkiv.network
          </a>
          , add{" "}
          <code className="font-mono text-[0.8em]">ARKIV_API_KEY=…</code> to{" "}
          <code className="font-mono text-[0.8em]">.env.local</code>, restart
          the server, then Retry.
        </p>
        <p className="mt-2 text-sm text-[var(--mute)]">
          Project={publicConfig.project || "(missing)"} · Vault=
          {publicConfig.vaultId || "(missing)"}
        </p>
        <button
          type="button"
          className="d-btn d-btn-signal mt-4"
          onClick={() => setTick((n) => n + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  const selectedItem = items.find((i) => i.note.nid === selected) ?? null;

  return (
    <div className="vault-board">
      <section id="constellation" className="sheet vault-graph">
        <div className="sheet-pad vault-graph-pad">
          <div className="vault-graph-head">
            <div>
              <p className="sheet-label">Constellation</p>
              <h2 className="sheet-title">Note graph</h2>
            </div>
            <span className="d-chip">
              {nodes.length} nodes · {edges.length} links
            </span>
          </div>
          <div className="vault-graph-stage">
            {nodes.length === 0 ? (
              <p className="d-empty">
                No allowed notes yet. Run pnpm seed or approve drafts in Pending.
              </p>
            ) : (
              <ObsidianGraph
                nodes={nodes}
                edges={edges}
                selectedId={selected}
                onSelect={setSelected}
                detail={
                  selectedItem
                    ? {
                        title: selectedItem.title,
                        body: selectedItem.body,
                        label: selectedItem.gate.label,
                        nid: selectedItem.note.nid,
                        href: `${publicConfig.explorer}/entity/${selectedItem.note.key}`,
                      }
                    : null
                }
              />
            )}
          </div>
        </div>
      </section>

      <section className="sheet vault-list-sheet">
        <div className="sheet-pad vault-list-pad">
          <div className="vault-list-head">
            <p className="sheet-label">Library</p>
            <h2 className="sheet-title">Allowed notes</h2>
          </div>
          <ul className="d-rows vault-list">
            {items.length === 0 && (
              <li className="d-empty">Empty vault — seed or endorse first.</li>
            )}
            {items.map((item) => (
              <li
                key={item.note.key}
                className={`d-row click ${
                  selected === item.note.nid ? "selected" : ""
                }`}
                onClick={() => setSelected(item.note.nid)}
              >
                <span
                  className={`d-chip ${
                    item.gate.label === "endorsed" ? "ok" : "warn"
                  }`}
                >
                  {item.gate.label}
                </span>
                <h3>{item.title}</h3>
                <p className="body line-clamp-2 whitespace-pre-wrap">
                  {item.body}
                </p>
                <p className="d-data mt-1.5">
                  {item.note.nid}
                  <a
                    className="d-link"
                    href={`${publicConfig.explorer}/entity/${item.note.key}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View on explorer →
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
