import { config } from "dotenv";
import { resolve } from "node:path";
import type { Hex } from "viem";
import type { GroveConfig } from "@grove/core";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function loadGroveEnv() {
  const rpcUrl =
    process.env.ARKIV_RPC_URL ??
    "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
  const wsUrl =
    process.env.ARKIV_WS_URL ??
    "wss://rpc.tiramisu.db-chain.testnet.arkiv.network";

  const cfg: GroveConfig = {
    rpcUrl,
    wsUrl,
    project: req("PROJECT_VALUE"),
    vaultId: req("VAULT_ID"),
    ownerAddress: req("OWNER_ADDRESS"),
    draftLifeSeconds: process.env.DRAFT_LIFE_SECONDS
      ? Number(process.env.DRAFT_LIFE_SECONDS)
      : 600,
  };

  return {
    cfg,
    vaultKeyRaw: req("VAULT_KEY"),
    agentPrivateKey: (process.env.AGENT_PRIVATE_KEY ??
      process.env.AGENT_A_PRIVATE_KEY) as Hex | undefined,
    ownerPrivateKey: process.env.OWNER_PRIVATE_KEY as Hex | undefined,
    strict: process.env.GROVE_STRICT === "1" || process.env.GROVE_STRICT === "true",
  };
}
