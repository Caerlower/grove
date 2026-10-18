import "server-only";
import {
  createGrovePublicClient,
  withArkivApiKey,
  type GroveConfig,
} from "@grove/core";
import type { Hex } from "viem";

export function arkivApiKey(): string | undefined {
  return (
    process.env.ARKIV_API_KEY?.trim() ||
    process.env.ARKIV_ACCESS_KEY?.trim() ||
    undefined
  );
}

export function serverRpcUrl(): string {
  const base =
    process.env.ARKIV_RPC_URL ??
    process.env.NEXT_PUBLIC_ARKIV_RPC_URL ??
    "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
  return withArkivApiKey(base, arkivApiKey());
}

export function serverPublicClient() {
  return createGrovePublicClient(serverRpcUrl());
}

export function serverCfg(): GroveConfig {
  const project = process.env.NEXT_PUBLIC_PROJECT_VALUE;
  const vaultId = process.env.NEXT_PUBLIC_VAULT_ID;
  const ownerAddress = process.env.NEXT_PUBLIC_OWNER_ADDRESS;
  if (!project || !vaultId || !ownerAddress) {
    throw new Error("Missing NEXT_PUBLIC project/vault/owner config");
  }
  return {
    rpcUrl: serverRpcUrl(),
    project,
    vaultId,
    ownerAddress,
    draftLifeSeconds: Number(process.env.DRAFT_LIFE_SECONDS ?? 600),
  };
}

export function requireDemoVaultKey(): string {
  const k = process.env.DEMO_VAULT_KEY;
  if (!k) throw new Error("DEMO_VAULT_KEY not set");
  return k;
}

export function requireOwnerKey(): Hex {
  const k = process.env.OWNER_PRIVATE_KEY;
  if (!k) throw new Error("OWNER_PRIVATE_KEY not set on server");
  return k as Hex;
}

export function requireAgentKey(): Hex {
  const k = process.env.AGENT_A_PRIVATE_KEY;
  if (!k) throw new Error("AGENT_A_PRIVATE_KEY not set on server");
  return k as Hex;
}

export function demoSigningEnabled(): boolean {
  return Boolean(
    process.env.DEMO_VAULT_KEY &&
      process.env.OWNER_PRIVATE_KEY &&
      process.env.AGENT_A_PRIVATE_KEY,
  );
}
