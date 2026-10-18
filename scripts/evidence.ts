import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

console.log("Entity-creating wallets:");
console.log(`  OWNER:  ${process.env.OWNER_ADDRESS}`);
console.log(`  AGENT_A: ${process.env.AGENT_A_ADDRESS}`);
console.log(`  AGENT_B: ${process.env.AGENT_B_ADDRESS}`);
console.log(`  ROGUE:  ${process.env.ROGUE_ADDRESS}`);
console.log(`PROJECT: ${process.env.PROJECT_VALUE}`);
console.log(`VAULT:   ${process.env.VAULT_ID}`);

const evidence = resolve(process.cwd(), "docs/evidence.md");
if (existsSync(evidence)) {
  console.log("\ndocs/evidence.md present. First lines:\n");
  console.log(readFileSync(evidence, "utf8").slice(0, 800));
} else {
  console.log(
    "\nNo docs/evidence.md yet — run `pnpm seed` after funding wallets.",
  );
}
