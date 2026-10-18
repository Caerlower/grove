import { config } from "dotenv";
import { resolve } from "node:path";
import { privateKeyToAccount, type Hex } from "viem/accounts";

config({ path: resolve(process.cwd(), ".env.local") });

function addr(label: string, pk?: string) {
  if (!pk) {
    console.log(`${label}: (missing key in .env.local)`);
    return;
  }
  const account = privateKeyToAccount(pk as Hex);
  console.log(`${label}: ${account.address}`);
}

console.log("Grove entity-creating wallets (list these on Devfolio):\n");
addr("OWNER", process.env.OWNER_PRIVATE_KEY);
addr("AGENT_A (MCP default)", process.env.AGENT_A_PRIVATE_KEY ?? process.env.AGENT_PRIVATE_KEY);
addr("AGENT_B", process.env.AGENT_B_PRIVATE_KEY);
addr("ROGUE", process.env.ROGUE_PRIVATE_KEY);
console.log("\nFund all four at https://hub.arkiv.network/faucet");
console.log(`PROJECT_VALUE=${process.env.PROJECT_VALUE}`);
console.log(`VAULT_ID=${process.env.VAULT_ID}`);
