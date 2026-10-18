import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
} from "@arkiv-network/sdk";
import { str, u64 } from "@arkiv-network/sdk/attr";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { eq, gte, lte } from "@arkiv-network/sdk/query";
import { http, webSocket, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  DRAFT_LIFE_SECONDS_DEFAULT,
  ENTITY_TYPE,
  NOTE_ENDORSED_LIFE_SECONDS,
} from "../constants.js";
import {
  agentCreateParams,
  endorsementCreateParams,
  noteCreateParams,
} from "../entities/builders.js";
import { extendToAtLeast, shouldExtend } from "../entities/extend.js";
import {
  blindTagHashes,
  decodeVaultKeyMaterial,
  deriveTagIndexKey,
  importVaultKey,
  randomNid,
  sealNoteContent,
  sha256Hex,
} from "../crypto/vault.js";
import type {
  AgentAllowEntry,
  EndorsementView,
  NoteContent,
  NoteView,
  WriteNoteResult,
} from "../types.js";
import { getAddress } from "viem";

export type GroveConfig = {
  rpcUrl: string;
  wsUrl?: string;
  project: string;
  vaultId: string;
  ownerAddress: string;
  draftLifeSeconds?: number;
};

function attrStr(
  attrs: Record<string, { type: string; value: unknown } | undefined>,
  name: string,
): string {
  const a = attrs[name];
  if (!a || a.type !== "str") return "";
  return String(a.value);
}

function attrU64(
  attrs: Record<string, { type: string; value: unknown } | undefined>,
  name: string,
): number {
  const a = attrs[name];
  if (!a) return 0;
  if (a.type === "u64" || a.type === "i32") return Number(a.value);
  return 0;
}

/** Append Hub access key to the RPC URL (path form). */
export function withArkivApiKey(rpcUrl: string, apiKey?: string | null): string {
  const key = apiKey?.trim();
  if (!key) return rpcUrl;
  const base = rpcUrl.replace(/\/$/, "");
  if (base.endsWith(`/${key}`) || base.includes(`/${key}/`)) return base;
  return `${base}/${key}`;
}

export function createGrovePublicClient(
  rpcUrl: string,
  _wsUrl?: string,
  opts?: { apiKey?: string | null },
) {
  const url = withArkivApiKey(rpcUrl, opts?.apiKey);
  return createPublicClient({
    chain: tiramisu,
    transport: http(url, {
      timeout: 20_000,
      retryCount: 0,
      fetchFn: async (input, init) => {
        const res = await fetch(input, init);
        if (res.status === 429) {
          let detail = "";
          try {
            detail = await res.text();
          } catch {
            /* ignore */
          }
          const budget =
            detail.includes("ANON_COST_LIMITED") ||
            detail.includes("unauthenticated query budget");
          throw new Error(
            budget
              ? "Tiramisu anonymous RPC budget exhausted. Add ARKIV_API_KEY from https://hub.arkiv.network to .env.local and restart."
              : `Tiramisu RPC rate-limited (429). ${detail.slice(0, 160)}`,
          );
        }
        return res;
      },
    }),
  });
}

export function createGroveWalletClient(rpcUrl: string, privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return {
    account,
    client: createWalletClient({
      account,
      chain: tiramisu,
      transport: http(rpcUrl),
    }),
  };
}

export function createGroveWsPublicClient(wsUrl: string) {
  return createPublicClient({
    chain: tiramisu,
    transport: webSocket(wsUrl),
  });
}

type AnyPublic = ReturnType<typeof createGrovePublicClient>;

export async function fetchNotesByCreator(
  publicClient: AnyPublic,
  cfg: GroveConfig,
  creator: string,
): Promise<NoteView[]> {
  const page = await publicClient
    .select({
      key: true,
      creator: true,
      owner: true,
      contentType: true,
      payload: true,
      expiresAt: true,
      attributes: true,
    })
    .where(
      eq("project", str(cfg.project)),
      eq("type", str(ENTITY_TYPE.note)),
      eq("vault", str(cfg.vaultId)),
    )
    .createdBy(getAddress(creator))
    .limit(200)
    .fetch();

  return page.entities.map((e) => {
    const attrs = e.attributes as Record<
      string,
      { type: string; value: unknown }
    >;
    return {
      key: e.key,
      creator: e.creator,
      owner: e.owner,
      contentType: e.contentType,
      payload: e.payload,
      nid: attrStr(attrs, "nid"),
      vault: attrStr(attrs, "vault"),
      project: attrStr(attrs, "project"),
      createdat: attrU64(attrs, "createdat"),
      th1: attrStr(attrs, "th1") || undefined,
      th2: attrStr(attrs, "th2") || undefined,
      th3: attrStr(attrs, "th3") || undefined,
      expiresAtBlock: e.expiresAt,
    } satisfies NoteView;
  });
}

export async function fetchNoteByNid(
  publicClient: AnyPublic,
  cfg: GroveConfig,
  nid: string,
): Promise<NoteView | null> {
  const page = await publicClient
    .select({
      key: true,
      creator: true,
      owner: true,
      contentType: true,
      payload: true,
      expiresAt: true,
      attributes: true,
    })
    .where(
      eq("project", str(cfg.project)),
      eq("type", str(ENTITY_TYPE.note)),
      eq("vault", str(cfg.vaultId)),
      eq("nid", str(nid)),
    )
    .limit(10)
    .fetch();

  const e = page.entities[0];
  if (!e) return null;
  const attrs = e.attributes as Record<string, { type: string; value: unknown }>;
  return {
    key: e.key,
    creator: e.creator,
    owner: e.owner,
    contentType: e.contentType,
    payload: e.payload,
    nid: attrStr(attrs, "nid"),
    vault: attrStr(attrs, "vault"),
    project: attrStr(attrs, "project"),
    createdat: attrU64(attrs, "createdat"),
    th1: attrStr(attrs, "th1") || undefined,
    th2: attrStr(attrs, "th2") || undefined,
    th3: attrStr(attrs, "th3") || undefined,
    expiresAtBlock: e.expiresAt,
  };
}

export async function fetchEntityByKey(
  publicClient: AnyPublic,
  entityKey: Hex,
): Promise<NoteView | null> {
  try {
    const e = await publicClient.getEntity(entityKey);
    const attrs = e.attributes as Record<
      string,
      { type: string; value: unknown }
    >;
    return {
      key: e.key,
      creator: e.creator,
      owner: e.owner,
      contentType: e.contentType,
      payload: e.payload,
      nid: attrStr(attrs, "nid"),
      vault: attrStr(attrs, "vault"),
      project: attrStr(attrs, "project"),
      createdat: attrU64(attrs, "createdat"),
      th1: attrStr(attrs, "th1") || undefined,
      th2: attrStr(attrs, "th2") || undefined,
      th3: attrStr(attrs, "th3") || undefined,
      expiresAtBlock: e.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function fetchEndorsementsForNid(
  publicClient: AnyPublic,
  cfg: GroveConfig,
  nid: string,
): Promise<EndorsementView[]> {
  const page = await publicClient
    .select({
      key: true,
      creator: true,
      payload: true,
      attributes: true,
    })
    .where(
      eq("project", str(cfg.project)),
      eq("type", str(ENTITY_TYPE.endorsement)),
      eq("vault", str(cfg.vaultId)),
      eq("nid", str(nid)),
    )
    .createdBy(getAddress(cfg.ownerAddress))
    .limit(200)
    .fetch();

  return page.entities.map((e) => parseEndorsement(e));
}

export async function fetchAllEndorsements(
  publicClient: AnyPublic,
  cfg: GroveConfig,
): Promise<EndorsementView[]> {
  const page = await publicClient
    .select({
      key: true,
      creator: true,
      payload: true,
      attributes: true,
    })
    .where(
      eq("project", str(cfg.project)),
      eq("type", str(ENTITY_TYPE.endorsement)),
      eq("vault", str(cfg.vaultId)),
    )
    .createdBy(getAddress(cfg.ownerAddress))
    .limit(200)
    .fetch();

  return page.entities.map((e) => parseEndorsement(e));
}

function parseEndorsement(e: {
  key: Hex;
  creator: string;
  payload: Uint8Array;
  attributes: Record<string, { type: string; value: unknown }>;
}): EndorsementView {
  let payloadSha256 = "";
  let noteKey: string | undefined;
  try {
    const json = JSON.parse(new TextDecoder().decode(e.payload)) as {
      payloadSha256?: string;
      noteKey?: string;
    };
    payloadSha256 = json.payloadSha256 ?? "";
    noteKey = json.noteKey;
  } catch {
    /* ignore */
  }
  return {
    key: e.key,
    creator: e.creator,
    nid: attrStr(e.attributes, "nid"),
    decision: attrStr(e.attributes, "decision") === "reject" ? "reject" : "approve",
    agent: attrStr(e.attributes, "agent"),
    decidedat: attrU64(e.attributes, "decidedat"),
    payloadSha256,
    noteKey,
  };
}

export async function fetchAllowlist(
  publicClient: AnyPublic,
  cfg: GroveConfig,
): Promise<AgentAllowEntry[]> {
  const page = await publicClient
    .select({
      key: true,
      creator: true,
      payload: true,
      attributes: true,
    })
    .where(
      eq("project", str(cfg.project)),
      eq("type", str(ENTITY_TYPE.agent)),
      eq("vault", str(cfg.vaultId)),
    )
    .createdBy(getAddress(cfg.ownerAddress))
    .limit(200)
    .fetch();

  const entries: AgentAllowEntry[] = page.entities.map((e) => {
    const attrs = e.attributes as Record<
      string,
      { type: string; value: unknown }
    >;
    let label = "";
    try {
      label = (JSON.parse(new TextDecoder().decode(e.payload)) as { label?: string })
        .label ?? "";
    } catch {
      /* ignore */
    }
    return {
      key: e.key,
      addr: (
        attrStr(attrs, "agentaddr") || attrStr(attrs, "addr")
      ).toLowerCase(),
      status: attrStr(attrs, "status") === "revoked" ? "revoked" : "allowed",
      since: attrU64(attrs, "since"),
      label,
      creator: e.creator,
    };
  });

  // Latest-wins per address by highest `since`
  const byAddr = new Map<string, AgentAllowEntry>();
  for (const e of entries.sort((a, b) => a.since - b.since)) {
    byAddr.set(e.addr, e);
  }
  return [...byAddr.values()].filter((e) => e.status === "allowed");
}

export async function fetchEndorsementsForAgent(
  publicClient: AnyPublic,
  cfg: GroveConfig,
  agent: string,
  decidedFrom?: number,
  decidedTo?: number,
): Promise<EndorsementView[]> {
  const predicates = [
    eq("project", str(cfg.project)),
    eq("type", str(ENTITY_TYPE.endorsement)),
    eq("vault", str(cfg.vaultId)),
    eq("agent", str(agent.toLowerCase())),
  ];
  if (decidedFrom !== undefined) {
    predicates.push(gte("decidedat", u64(BigInt(decidedFrom))));
  }
  if (decidedTo !== undefined) {
    predicates.push(lte("decidedat", u64(BigInt(decidedTo))));
  }

  const page = await publicClient
    .select({
      key: true,
      creator: true,
      payload: true,
      attributes: true,
    })
    .where(...predicates)
    .createdBy(getAddress(cfg.ownerAddress))
    .limit(200)
    .fetch();

  return page.entities.map((e) => parseEndorsement(e));
}

export async function writeNoteAsAgent(opts: {
  rpcUrl: string;
  agentPrivateKey: Hex;
  cfg: GroveConfig;
  vaultKeyRaw: string;
  content: NoteContent;
}): Promise<WriteNoteResult> {
  const { account, client } = createGroveWalletClient(
    opts.rpcUrl,
    opts.agentPrivateKey,
  );
  const vaultKey = await importVaultKey(opts.vaultKeyRaw);
  const indexKey = await deriveTagIndexKey(
    decodeVaultKeyMaterial(opts.vaultKeyRaw),
  );
  const nid = randomNid();
  const sealed = await sealNoteContent(vaultKey, opts.content);
  const tagHashes = await blindTagHashes(indexKey, opts.content.tags);
  const createdat = Math.floor(Date.now() / 1000);

  const create = await client.createEntity(
    noteCreateParams({
      project: opts.cfg.project,
      vault: opts.cfg.vaultId,
      nid,
      sealedPayload: sealed,
      tagHashes,
      createdat,
      draftLifeSeconds:
        opts.cfg.draftLifeSeconds ?? DRAFT_LIFE_SECONDS_DEFAULT,
    }),
  );

  const txHashes: string[] = [create.txHash];
  let status: WriteNoteResult["status"] = "handoff_incomplete";

  try {
    const handoff = await client.changeOwnership({
      entityKey: create.entityKey,
      newOwner: getAddress(opts.cfg.ownerAddress),
    });
    txHashes.push(handoff.txHash);
    status = "pending_review";
  } catch {
    status = "handoff_incomplete";
  }

  return {
    nid,
    entityKey: create.entityKey,
    status,
    txHashes,
    payloadSha256: await sha256Hex(sealed),
  };
}

export async function endorseNote(opts: {
  rpcUrl: string;
  ownerPrivateKey: Hex;
  cfg: GroveConfig;
  note: NoteView;
  decision: "approve" | "reject";
}): Promise<{ endorsementKey: string; txHashes: string[] }> {
  const { client } = createGroveWalletClient(opts.rpcUrl, opts.ownerPrivateKey);
  const decidedat = Math.floor(Date.now() / 1000);
  const payloadSha256 = await sha256Hex(opts.note.payload);

  const created = await client.createEntity(
    endorsementCreateParams({
      project: opts.cfg.project,
      vault: opts.cfg.vaultId,
      nid: opts.note.nid,
      decision: opts.decision,
      agent: opts.note.creator,
      decidedat,
      noteKey: opts.note.key,
      payloadSha256,
    }),
  );

  const txHashes: string[] = [created.txHash];

  if (opts.decision === "approve") {
    const publicClient = createGrovePublicClient(opts.rpcUrl);
    const head = await publicClient.getBlockNumber();
    if (
      opts.note.expiresAtBlock === undefined ||
      shouldExtend(
        opts.note.expiresAtBlock,
        head,
        NOTE_ENDORSED_LIFE_SECONDS,
      )
    ) {
      const ext = await client.extendEntity({
        entityKey: opts.note.key as Hex,
        expires: extendToAtLeast(NOTE_ENDORSED_LIFE_SECONDS),
      });
      txHashes.push(ext.txHash);
    }
  }

  return { endorsementKey: created.entityKey, txHashes };
}

export async function allowAgent(opts: {
  rpcUrl: string;
  ownerPrivateKey: Hex;
  cfg: GroveConfig;
  addr: string;
  label: string;
  status?: "allowed" | "revoked";
}): Promise<{ entityKey: string; txHash: string }> {
  const { client } = createGroveWalletClient(opts.rpcUrl, opts.ownerPrivateKey);
  const created = await client.createEntity(
    agentCreateParams({
      project: opts.cfg.project,
      vault: opts.cfg.vaultId,
      addr: opts.addr,
      status: opts.status ?? "allowed",
      since: Math.floor(Date.now() / 1000),
      label: opts.label,
    }),
  );
  return { entityKey: created.entityKey, txHash: created.txHash };
}

export async function extendNoteLife(opts: {
  rpcUrl: string;
  ownerPrivateKey: Hex;
  entityKey: Hex;
  targetSeconds: number;
}): Promise<{ txHash: string }> {
  const { client } = createGroveWalletClient(opts.rpcUrl, opts.ownerPrivateKey);
  const ext = await client.extendEntity({
    entityKey: opts.entityKey,
    expires: extendToAtLeast(opts.targetSeconds),
  });
  return { txHash: ext.txHash };
}

export { ExpirationTime, getAddress };
export type { PrivateKeyAccount, Hex };
