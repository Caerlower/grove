import "server-only";
import { ExpirationTime } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { str, u64 } from "@arkiv-network/sdk/attr";
import {
  createGrovePublicClient,
  createGroveWalletClient,
  JSON_CONTENT_TYPE,
} from "@grove/core";
import { getAddress, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  requireAgentKey,
  serverCfg,
  serverRpcUrl,
} from "@/lib/server-grove";

/**
 * Active MCP write owner — durable on Arkiv so every Vercel instance sees it.
 */

const MCP_OWNER_TYPE = "mcp_owner";
const LIFE_SECONDS = 7 * 24 * 60 * 60;

declare global {
  // eslint-disable-next-line no-var
  var __groveMcpBoundOwnerCache:
    | { address: string; at: number }
    | undefined;
}

function attrStr(
  attrs: Record<string, { type: string; value: unknown } | undefined>,
  key: string,
): string {
  const a = attrs[key];
  if (!a) return "";
  return a.value != null ? String(a.value) : "";
}

function attrU64(
  attrs: Record<string, { type: string; value: unknown } | undefined>,
  key: string,
): number {
  const a = attrs[key];
  if (!a) return 0;
  if (a.type === "u64" || a.type === "i32") return Number(a.value);
  if (typeof a.value === "bigint" || typeof a.value === "number") {
    return Number(a.value);
  }
  if (typeof a.value === "string" && a.value) return Number(a.value);
  return 0;
}

export async function setBoundMcpOwner(address: string): Promise<string> {
  if (!isAddress(address)) throw new Error("Invalid address");
  const checksummed = getAddress(address);
  const cfg = serverCfg();
  const agentKey = requireAgentKey();
  const { client } = createGroveWalletClient(serverRpcUrl(), agentKey);
  const boundat = Math.floor(Date.now() / 1000);

  await client.createEntity({
    payload: new TextEncoder().encode(
      JSON.stringify({ ownerAddress: checksummed, boundat }),
    ),
    contentType: JSON_CONTENT_TYPE,
    attributes: {
      project: str(cfg.project),
      type: str(MCP_OWNER_TYPE),
      vault: str(cfg.vaultId),
      owneraddr: str(checksummed.toLowerCase()),
      boundat: u64(BigInt(boundat)),
    },
    expires: ExpirationTime.fromSeconds(LIFE_SECONDS),
  });

  globalThis.__groveMcpBoundOwnerCache = {
    address: checksummed,
    at: Date.now(),
  };
  return checksummed;
}

async function readBoundOnce(): Promise<string | null> {
  const cached = globalThis.__groveMcpBoundOwnerCache;
  if (cached && Date.now() - cached.at < 15_000) {
    return cached.address;
  }

  const cfg = serverCfg();
  const agentKey = requireAgentKey();
  const agent = privateKeyToAccount(agentKey as Hex).address;
  const publicClient = createGrovePublicClient(serverRpcUrl());

  let page;
  try {
    page = await publicClient
      .select({
        key: true,
        creator: true,
        payload: true,
        attributes: true,
      })
      .where(
        eq("project", str(cfg.project)),
        eq("type", str(MCP_OWNER_TYPE)),
        eq("vault", str(cfg.vaultId)),
      )
      .createdBy(getAddress(agent))
      .limit(50)
      .fetch();
  } catch (e) {
    console.error("[mcp-bound-owner] query failed", e);
    return cached?.address ?? null;
  }

  let best: { addr: string; at: number } | null = null;
  for (const e of page.entities) {
    const attrs = e.attributes as Record<
      string,
      { type: string; value: unknown } | undefined
    >;
    let addrRaw = attrStr(attrs, "owneraddr");
    if (!addrRaw) {
      try {
        const body = JSON.parse(
          new TextDecoder().decode(e.payload),
        ) as { ownerAddress?: string };
        if (body.ownerAddress) addrRaw = body.ownerAddress;
      } catch {
        /* ignore */
      }
    }
    if (!addrRaw || !isAddress(addrRaw)) continue;
    const at = attrU64(attrs, "boundat");
    if (!best || at >= best.at) {
      best = { addr: getAddress(addrRaw), at };
    }
  }

  if (!best) return null;
  globalThis.__groveMcpBoundOwnerCache = {
    address: best.addr,
    at: Date.now(),
  };
  return best.addr;
}

/** Resolve bound owner; retries help Arkiv index catch up after Live binds. */
export async function getBoundMcpOwner(
  opts?: { retries?: number; delayMs?: number },
): Promise<string | null> {
  const retries = opts?.retries ?? 4;
  const delayMs = opts?.delayMs ?? 750;
  let last: string | null = null;
  for (let i = 0; i < retries; i++) {
    last = await readBoundOnce();
    if (last) return last;
    if (i + 1 < retries) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return last;
}
