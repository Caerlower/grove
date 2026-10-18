"use client";

import {
  computeTrustTier,
  createGrovePublicClient,
  evaluateNote,
  fetchAllEndorsements,
  fetchAllowlist,
  fetchNotesByCreator,
  importVaultKey,
  openNoteContent,
  shouldSampleForReview,
  TRUST,
  type EndorsementView,
  type GateResult,
  type NoteView,
} from "@grove/core";
import { getAddress, isAddress } from "viem";
import { groveCfg, publicConfig } from "./config";
import { reviveNote, type NoteWire } from "./note-wire";

type VaultItem = {
  note: NoteView;
  gate: GateResult;
  title: string;
  body: string;
  tags: string[];
  links: string[];
};

type Snapshot = {
  allow: Array<{
    key: string;
    addr: string;
    status: "allowed" | "revoked";
    since: number;
    label: string;
    creator: string;
  }>;
  endorsements: EndorsementView[];
  notes: NoteWire[];
  keyed?: boolean;
  error?: string;
  hint?: string;
};

let vaultCache: { key: string; at: number; items: VaultItem[] } | null = null;
const VAULT_CACHE_MS = 45_000;

function getPublic() {
  return createGrovePublicClient(publicConfig.rpcUrl, undefined, {
    apiKey: publicConfig.apiKey,
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () =>
        reject(
          new Error(
            `${label} timed out after ${Math.round(ms / 1000)}s — Tiramisu RPC may be slow or rate-limited. Retry.`,
          ),
        ),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function fetchSnapshot(
  onStatus: (msg: string) => void,
  ownerAddress?: string,
): Promise<Snapshot> {
  onStatus("Fetching vault snapshot…");
  const q =
    ownerAddress && isAddress(ownerAddress)
      ? `?owner=${encodeURIComponent(getAddress(ownerAddress))}`
      : "";
  const res = await fetch(`/api/vault/snapshot${q}`, { cache: "no-store" });
  const data = (await res.json()) as Snapshot;
  if (!res.ok) {
    throw new Error(
      [data.error ?? `Snapshot failed (${res.status})`, data.hint]
        .filter(Boolean)
        .join(" — "),
    );
  }
  return data;
}

function resolveOwner(ownerAddress?: string): string {
  const raw = ownerAddress?.trim() || publicConfig.ownerAddress;
  if (!raw || !isAddress(raw)) {
    throw new Error(
      "Connect a wallet (vault owner) or set NEXT_PUBLIC_OWNER_ADDRESS.",
    );
  }
  return getAddress(raw);
}

export async function loadNoteByNid(nid: string): Promise<NoteView | null> {
  const res = await fetch(`/api/vault/note?nid=${encodeURIComponent(nid)}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as {
    found?: boolean;
    error?: string;
    note?: NoteWire;
  };
  if (res.status === 404 || data.found === false) return null;
  if (!res.ok) throw new Error(data.error ?? `Note fetch failed (${res.status})`);
  return data.note ? reviveNote(data.note) : null;
}

export async function loadNoteByEntityKey(
  entityKey: string,
): Promise<NoteView | null> {
  const res = await fetch(
    `/api/vault/entity?key=${encodeURIComponent(entityKey)}`,
    { cache: "no-store" },
  );
  const data = (await res.json()) as {
    found?: boolean;
    error?: string;
    note?: NoteWire;
  };
  if (res.status === 404 || data.found === false) return null;
  if (!res.ok) {
    throw new Error(data.error ?? `Entity fetch failed (${res.status})`);
  }
  return data.note ? reviveNote(data.note) : null;
}

export async function loadChainHead(): Promise<bigint> {
  const res = await fetch("/api/chain/head", { cache: "no-store" });
  const data = (await res.json()) as { blockNumber?: string; error?: string };
  if (!res.ok || data.blockNumber == null) {
    throw new Error(data.error ?? "Failed to read chain head");
  }
  return BigInt(data.blockNumber);
}

export async function loadVaultNotes(
  vaultKeyRaw: string,
  opts?: {
    force?: boolean;
    onStatus?: (msg: string) => void;
    /** Connected wallet — vault owner for this session. */
    ownerAddress?: string;
  },
): Promise<VaultItem[]> {
  const status = opts?.onStatus ?? (() => {});
  const ownerAddress = resolveOwner(opts?.ownerAddress);
  const cacheKey = `${vaultKeyRaw.trim()}::${ownerAddress.toLowerCase()}`;
  if (
    !opts?.force &&
    vaultCache &&
    vaultCache.key === cacheKey &&
    Date.now() - vaultCache.at < VAULT_CACHE_MS
  ) {
    status("Loaded from cache");
    return vaultCache.items;
  }

  const cfg = { ...groveCfg(), ownerAddress };
  if (!cfg.project || !cfg.vaultId) {
    throw new Error("Missing NEXT_PUBLIC_PROJECT_VALUE / VAULT_ID in env.");
  }

  status("Unlocking vault key…");
  const vaultKey = await importVaultKey(vaultKeyRaw);

  let allow: Snapshot["allow"];
  let allEndorsements: EndorsementView[];
  let notes: NoteView[];

  try {
    const snap = await withTimeout(
      fetchSnapshot(status, ownerAddress),
      60_000,
      "Vault snapshot",
    );
    allow = snap.allow;
    allEndorsements = snap.endorsements;
    notes = snap.notes.map(reviveNote);
    status(`Decrypting ${notes.length} notes…`);
  } catch (snapErr) {
    status("Snapshot unavailable — reading chain from browser…");
    console.warn(snapErr);
    const publicClient = getPublic();
    allow = await withTimeout(
      fetchAllowlist(publicClient, cfg),
      25_000,
      "Allowlist",
    );
    allEndorsements = await withTimeout(
      fetchAllEndorsements(publicClient, cfg),
      25_000,
      "Endorsements",
    );
    notes = [];
    for (let i = 0; i < allow.length; i++) {
      const agent = allow[i]!;
      status(`Fetching notes ${i + 1}/${allow.length}…`);
      try {
        notes.push(
          ...(await withTimeout(
            fetchNotesByCreator(publicClient, cfg, getAddress(agent.addr)),
            25_000,
            `Notes for ${agent.addr.slice(0, 10)}`,
          )),
        );
      } catch (e) {
        console.warn("skip agent notes", agent.addr, e);
      }
    }
  }

  const allowlist = new Set(allow.map((a) => a.addr.toLowerCase()));
  const items: VaultItem[] = [];

  for (const note of notes) {
    const endorsements = allEndorsements.filter((e) => e.nid === note.nid);
    const stats = computeTrustTier(note.creator, allEndorsements);
    const gate = await evaluateNote(note, {
      ownerAddress,
      allowlist,
      endorsements,
      creatorTier: stats.tier,
      vaultKey,
      strict: false,
    });
    if (!gate.allow) continue;
    try {
      const content = await openNoteContent(vaultKey, note.payload);
      items.push({
        note,
        gate,
        title: content.title,
        body: content.body,
        tags: content.tags,
        links: content.links,
      });
    } catch {
      /* skip undecryptable */
    }
  }

  status(`Ready · ${items.length} notes`);
  vaultCache = { key: cacheKey, at: Date.now(), items };
  return items;
}

export async function loadPending(
  vaultKeyRaw: string,
  opts?: { ownerAddress?: string },
) {
  const ownerAddress = resolveOwner(opts?.ownerAddress);
  const cfg = { ...groveCfg(), ownerAddress };
  const vaultKey = await importVaultKey(vaultKeyRaw);

  let allEndorsements: EndorsementView[];
  let notes: NoteView[];

  try {
    const snap = await fetchSnapshot(() => {}, ownerAddress);
    allEndorsements = snap.endorsements;
    notes = snap.notes.map(reviveNote);
  } catch {
    const publicClient = getPublic();
    const allow = await withTimeout(
      fetchAllowlist(publicClient, cfg),
      25_000,
      "Allowlist",
    );
    allEndorsements = await withTimeout(
      fetchAllEndorsements(publicClient, cfg),
      25_000,
      "Endorsements",
    );
    notes = [];
    for (const agent of allow) {
      try {
        notes.push(
          ...(await withTimeout(
            fetchNotesByCreator(publicClient, cfg, getAddress(agent.addr)),
            25_000,
            "Notes",
          )),
        );
      } catch {
        /* skip */
      }
    }
  }

  const queue: Array<{
    note: NoteView;
    title: string;
    body: string;
    tier: string;
    sampleReason: string;
  }> = [];

  for (const note of notes) {
    if (getAddress(note.owner) !== ownerAddress) continue;
    if (allEndorsements.some((e) => e.nid === note.nid)) continue;
    const stats = computeTrustTier(note.creator, allEndorsements);
    let content;
    try {
      content = await openNoteContent(vaultKey, note.payload);
    } catch {
      continue;
    }
    const sensitive = content.tags
      .map((t) => t.toLowerCase())
      .includes(TRUST.SENSITIVE_TAG);
    if (stats.tier === "trusted") {
      if (!sensitive && !shouldSampleForReview(note.key, TRUST.SAMPLE_MOD)) {
        continue;
      }
    }
    queue.push({
      note,
      title: content.title,
      body: content.body,
      tier: stats.tier,
      sampleReason: sensitive
        ? "sensitive_tag"
        : stats.tier === "trusted"
          ? "sample"
          : "new_or_suspended",
    });
  }
  return queue;
}

export async function verifyEntity(entityKey: string) {
  const res = await fetch(
    `/api/vault/entity?key=${encodeURIComponent(entityKey)}`,
    { cache: "no-store" },
  );
  const data = (await res.json()) as {
    found?: boolean;
    error?: string;
    note?: NoteWire;
  };
  if (res.status === 404 || data.found === false) {
    return { found: false as const };
  }
  if (!res.ok || !data.note) {
    throw new Error(data.error ?? `Entity fetch failed (${res.status})`);
  }
  const note = reviveNote(data.note);
  const { sha256Hex } = await import("@grove/core");
  const liveHash = await sha256Hex(note.payload);

  let endorsements: EndorsementView[] = [];
  try {
    const snap = await fetchSnapshot(() => {});
    endorsements = snap.endorsements.filter(
      (e) => e.nid === note.nid && e.decision === "approve",
    );
  } catch {
    /* optional */
  }
  const match = endorsements.find(
    (e) => e.payloadSha256.toLowerCase() === liveHash.toLowerCase(),
  );

  return {
    found: true as const,
    note,
    liveHash,
    endorsement: endorsements[0] ?? null,
    hashMatches: Boolean(match),
    explorerUrl: `${publicConfig.explorer}/entity/${entityKey}`,
  };
}

export async function loadAgents() {
  try {
    const snap = await fetchSnapshot(() => {});
    return snap.allow.map((a) => ({
      ...a,
      ...computeTrustTier(a.addr, snap.endorsements),
    }));
  } catch {
    const publicClient = getPublic();
    const cfg = groveCfg();
    const allow = await fetchAllowlist(publicClient, cfg);
    const endorsements = await fetchAllEndorsements(publicClient, cfg);
    return allow.map((a) => ({
      ...a,
      ...computeTrustTier(a.addr, endorsements),
    }));
  }
}
