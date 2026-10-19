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
 * Browser Live/MCP bind writes here; grove_write_note reads it.
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
  attrs: Record<string, { type: string; value: unknown }>,
  key: string,
): string {
  const v = attrs[key]?.value;
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function attrU64(
  attrs: Record<string, { type: string; value: unknown }>,
  key: string,
): number {
  const v = attrs[key]?.value;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v) return Number(v);
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

export async function getBoundMcpOwner(): Promise<string | null> {
  const cached = globalThis.__groveMcpBoundOwnerCache;
  if (cached && Date.now() - cached.at < 30_000) {
    return cached.address;
  }

  try {
    const cfg = serverCfg();
    const agentKey = requireAgentKey();
    const agent = privateKeyToAccount(agentKey as Hex).address;
    const publicClient = createGrovePublicClient(serverRpcUrl());
    const page = await publicClient
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

    let best: { addr: string; at: number } | null = null;
    for (const e of page.entities) {
      const attrs = e.attributes as Record<
        string,
        { type: string; value: unknown }
      >;
      const addrRaw = attrStr(attrs, "owneraddr");
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
  } catch (e) {
    console.error("[mcp-bound-owner] read failed", e);
    return cached?.address ?? null;
  }
}
