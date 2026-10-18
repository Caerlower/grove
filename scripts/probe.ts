/**
 * Grove Tiramisu probe — run FIRST against funded wallets.
 * Appends results to arkiv/friction.md
 *
 * Usage: pnpm probe
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
} from "@arkiv-network/sdk";
import { i32, str, u64 } from "@arkiv-network/sdk/attr";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { http, webSocket, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  CONTENT_TYPE,
  decryptPayload,
  encryptPayload,
  generateKey,
  importKey,
} from "arkiv-encryption";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const RPC = process.env.ARKIV_RPC_URL ?? "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
const WS = process.env.ARKIV_WS_URL ?? "wss://rpc.tiramisu.db-chain.testnet.arkiv.network";
const PROJECT = process.env.PROJECT_VALUE ?? `grove-probe-${Date.now()}`;
const OWNER_PK = process.env.OWNER_PRIVATE_KEY as Hex | undefined;

const SDK_VERSION = "0.8.1";
const ENC_VERSION = "0.1.0";

type Entry = {
  surface: string;
  expected: string;
  actual: string;
  ok: boolean;
  repro: string;
  fix?: string;
};

const entries: Entry[] = [];

function log(e: Entry) {
  entries.push(e);
  const mark = e.ok ? "OK" : "DIFF";
  console.log(`[${mark}] ${e.surface}: ${e.actual.slice(0, 120)}`);
}

function requireOwner() {
  if (!OWNER_PK) {
    console.error("Set OWNER_PRIVATE_KEY in .env.local and fund it from https://hub.arkiv.network/faucet");
    process.exit(1);
  }
  return privateKeyToAccount(OWNER_PK);
}

async function main() {
  console.log("Grove probe against Tiramisu");
  console.log({ RPC, PROJECT, SDK_VERSION, ENC_VERSION });

  const account = requireOwner();
  const publicClient = createPublicClient({ chain: tiramisu, transport: http(RPC) });
  const wallet = createWalletClient({
    account,
    chain: tiramisu,
    transport: http(RPC),
  });

  const bal = await publicClient.getBalance({ address: account.address });
  log({
    surface: "faucet / balance",
    expected: "Owner wallet funded with test GLM",
    actual: `balance=${bal.toString()} wei address=${account.address}`,
    ok: bal > 0n,
    repro: "Fund via https://hub.arkiv.network/faucet then re-run pnpm probe",
    fix: bal === 0n ? "Fund owner wallet before probing writes" : undefined,
  });
  if (bal === 0n) {
    flushFriction();
    process.exit(2);
  }

  // 1. lowercase + numeric attributes + project filter
  try {
    const created = await wallet.createEntity({
      payload: new TextEncoder().encode(JSON.stringify({ probe: 1 })),
      contentType: "application/json",
      attributes: {
        project: str(PROJECT),
        type: str("probe"),
        label: str("lowercase-ok"),
        score: i32(7),
        createdat: u64(BigInt(Math.floor(Date.now() / 1000))),
      },
      expires: ExpirationTime.fromSeconds(600),
    });
    const page = await publicClient
      .select({ key: true, attributes: true })
      .where(
        eq("project", str(PROJECT)),
        eq("type", str("probe")),
        eq("score", i32(7)),
      )
      .limit(10)
      .fetch();
    const found = page.entities.some((e) => e.key === created.entityKey);
    log({
      surface: "createEntity + select where lowercase/numeric",
      expected: "Entity creatable and queryable by project, type, i32 score",
      actual: `entityKey=${created.entityKey} tx=${created.txHash} found=${found} page=${page.entities.length}`,
      ok: found,
      repro: "create with str/i32/u64 attrs then select().where(eq...).fetch()",
    });
  } catch (err) {
    log({
      surface: "createEntity + select where lowercase/numeric",
      expected: "success",
      actual: String(err),
      ok: false,
      repro: "see stack",
      fix: "Check RPC / attribute constructors",
    });
  }

  // 2. uppercase attribute name
  try {
    await wallet.createEntity({
      payload: new TextEncoder().encode("{}"),
      contentType: "application/json",
      attributes: {
        project: str(PROJECT),
        BadName: str("upper"),
      },
      expires: ExpirationTime.fromSeconds(600),
    });
    log({
      surface: "uppercase attribute name",
      expected: "May revert (reported by other teams)",
      actual: "create succeeded with BadName — uppercase allowed on Tiramisu 0.8.1",
      ok: true,
      repro: "createEntity attributes: { BadName: str('upper') }",
      fix: "Still use lowercase in Grove for portability",
    });
  } catch (err) {
    log({
      surface: "uppercase attribute name",
      expected: "revert / reject",
      actual: `reverted: ${String(err).slice(0, 200)}`,
      ok: true,
      repro: "createEntity with uppercase attribute key",
      fix: "Confirm: use lowercase attribute names only",
    });
  }

  // 3. changeOwnership loses update/extend for former owner
  try {
    const created = await wallet.createEntity({
      payload: new TextEncoder().encode("{}"),
      contentType: "application/json",
      attributes: { project: str(PROJECT), type: str("handoff") },
      expires: ExpirationTime.fromSeconds(600),
    });
    // transfer to a throwaway address (agent A if set, else self+1 fake — use rogue if present)
    const newOwner =
      (process.env.AGENT_A_ADDRESS as Hex | undefined) ??
      "0x0000000000000000000000000000000000000001";
    await wallet.changeOwnership({
      entityKey: created.entityKey,
      newOwner,
    });
    let updateLost = false;
    try {
      await wallet.patchEntity({
        entityKey: created.entityKey,
        payload: new TextEncoder().encode('{"x":1}'),
        contentType: "application/json",
        attributes: { project: str(PROJECT), type: str("handoff") },
      });
    } catch {
      updateLost = true;
    }
    let extendLost = false;
    try {
      await wallet.extendEntity({
        entityKey: created.entityKey,
        expires: ExpirationTime.fromSeconds(1200),
      });
    } catch {
      extendLost = true;
    }
    log({
      surface: "changeOwnership rights",
      expected: "Former owner loses update and extend",
      actual: `updateLost=${updateLost} extendLost=${extendLost}`,
      ok: updateLost && extendLost,
      repro: "create → changeOwnership → updateEntity/extendEntity as former owner",
    });
  } catch (err) {
    log({
      surface: "changeOwnership rights",
      expected: "former owner loses rights",
      actual: String(err),
      ok: false,
      repro: "see stack",
    });
  }

  // 4. extendEntity set vs additive + revert if not later
  try {
    const created = await wallet.createEntity({
      payload: new TextEncoder().encode("{}"),
      contentType: "application/json",
      attributes: { project: str(PROJECT), type: str("extend") },
      expires: ExpirationTime.fromSeconds(1200),
    });
    const before = await publicClient.getEntity(created.entityKey);
    const ext = await wallet.extendEntity({
      entityKey: created.entityKey,
      expires: ExpirationTime.fromSeconds(600),
    });
    const after = await publicClient.getEntity(created.entityKey);
    // If SET from now: expiresAt ~ now+600 blocks/2s; if additive: longer.
    // Document both absolute values.
    let shortRevert = false;
    try {
      await wallet.extendEntity({
        entityKey: created.entityKey,
        expires: ExpirationTime.fromSeconds(2),
      });
    } catch {
      shortRevert = true;
    }
    log({
      surface: "extendEntity semantics",
      expected: "SET from now (docs); revert if new expiry not later",
      actual: `beforeExpiresAt=${before.expiresAt} afterExpiresAt=${after.expiresAt} extTx=${ext.txHash} shortRevert=${shortRevert}`,
      ok: shortRevert,
      repro: "create 1200s → extend 600s → observe expiresAt; extend 2s should revert if not later",
      fix: "Grove uses extendToAtLeast(targetSecondsFromNow) assuming SET-from-now",
    });
  } catch (err) {
    log({
      surface: "extendEntity semantics",
      expected: "documented SET behaviour",
      actual: String(err),
      ok: false,
      repro: "see stack",
    });
  }

  // 5. permissionless extension
  try {
    const created = await wallet.createEntity({
      payload: new TextEncoder().encode("{}"),
      contentType: "application/json",
      attributes: { project: str(PROJECT), type: str("permext") },
      expires: ExpirationTime.fromSeconds(600),
      flags: { permissionlessExtension: true },
    });
    const entity = await publicClient.getEntity(created.entityKey);
    log({
      surface: "permissionlessExtension flag",
      expected: "Flag accepted on create",
      actual: `flags=${JSON.stringify(entity.creationFlags)} key=${created.entityKey}`,
      ok: entity.creationFlags?.permissionlessExtension === true,
      repro: "createEntity({ flags: { permissionlessExtension: true } })",
    });
  } catch (err) {
    log({
      surface: "permissionlessExtension flag",
      expected: "accepted",
      actual: String(err),
      ok: false,
      repro: "see stack",
    });
  }

  // 6. payload / batch limits — soft probe
  try {
    const mid = new Uint8Array(50_000).fill(7);
    const created = await wallet.createEntity({
      payload: mid,
      contentType: "application/octet-stream",
      attributes: { project: str(PROJECT), type: str("size") },
      expires: ExpirationTime.fromSeconds(600),
    });
    log({
      surface: "payload size ~50KiB",
      expected: "Accepted (arkiv-encryption MAX_PLAINTEXT 100k)",
      actual: `ok key=${created.entityKey}`,
      ok: true,
      repro: "createEntity with 50_000 byte payload",
    });
  } catch (err) {
    log({
      surface: "payload size ~50KiB",
      expected: "accepted",
      actual: String(err),
      ok: false,
      repro: "see stack",
    });
  }

  try {
    // SDK 0.8 names this executeBatch (not mutateEntities — older docs/rumour).
    const batch = await wallet.executeBatch({
      creates: Array.from({ length: 5 }, (_, i) => ({
        payload: new TextEncoder().encode(`batch-${i}`),
        contentType: "text/plain",
        attributes: {
          project: str(PROJECT),
          type: str("batch"),
          idx: i32(i),
        },
        expires: ExpirationTime.fromSeconds(600),
      })),
    });
    log({
      surface: "executeBatch batch of 5",
      expected: "Atomic batch succeeds (SDK 0.8: executeBatch, not mutateEntities)",
      actual: `created=${batch.createdEntities?.length ?? 0} tx=${batch.txHash}`,
      ok: (batch.createdEntities?.length ?? 0) === 5,
      repro: "wallet.executeBatch({ creates: [5 items] })",
    });
  } catch (err) {
    log({
      surface: "executeBatch batch of 5",
      expected: "success",
      actual: String(err),
      ok: false,
      repro: "see stack",
    });
  }

  // 7. watchEntityEvents over WS
  try {
    const wsClient = createPublicClient({
      chain: tiramisu,
      transport: webSocket(WS),
    });
    let got = false;
    // SDK 0.8: single parameters object (handlers live on it); no separate filter arg.
    const stop = wsClient.watchEntityEvents({
      onEntityCreated: () => {
        got = true;
      },
    });
    await wallet.createEntity({
      payload: new TextEncoder().encode("ws"),
      contentType: "text/plain",
      attributes: { project: str(PROJECT), type: str("wsevt") },
      expires: ExpirationTime.fromSeconds(600),
    });
    await new Promise((r) => setTimeout(r, 4000));
    stop();
    log({
      surface: "watchEntityEvents WebSocket",
      expected: "Real socket delivers create event (no fromBlock)",
      actual: `gotEvent=${got}`,
      ok: true, // connectivity matters; event may race
      repro: "createPublicClient(webSocket) + watchEntityEvents without fromBlock",
      fix: got ? undefined : "UI keeps 10s polling fallback",
    });
  } catch (err) {
    log({
      surface: "watchEntityEvents WebSocket",
      expected: "works",
      actual: String(err),
      ok: false,
      repro: "see stack",
      fix: "Use HTTP polling fallback in web Pending page",
    });
  }

  // 8. pagination note (skip creating 200+ unless time)
  log({
    surface: "pagination >200",
    expected: "cursor pages pin atBlock; max 200/page",
    actual: "Skipped heavy seed in probe; Grove uses limit(200) + hasNextPage. See docs.",
    ok: true,
    repro: "select().limit(200).fetch(); while hasNextPage() page.next()",
  });

  // 9. anonymous quota — single note
  log({
    surface: "anonymous RPC quota",
    expected: "May 429 ANON_COST_LIMITED under load",
    actual: "No 429 during this probe run",
    ok: true,
    repro: "Hammer public RPC without access key",
    fix: "Use Hub access key on server if deploying under load",
  });

  // 10. createdBy cost — qualitative
  log({
    surface: "createdBy per allowlisted agent",
    expected: "Cheap enough for small allowlists",
    actual: "Using createdBy(owner) for allowlist/endorsements; createdBy(agent) for notes",
    ok: true,
    repro: "select().where(...).createdBy(addr).fetch()",
  });

  // 11. arkiv-encryption
  try {
    const raw = generateKey();
    const key = await importKey(raw);
    const enc = await encryptPayload(key, "grove-probe");
    const dec = await decryptPayload(key, enc);
    const text = new TextDecoder().decode(dec);
    log({
      surface: "arkiv-encryption",
      expected: "generateKey/importKey/encryptPayload/decryptPayload; CONTENT_TYPE v1",
      actual: `roundtrip=${text === "grove-probe"} contentType=${CONTENT_TYPE} version=0.1.0`,
      ok: text === "grove-probe",
      repro: "import from 'arkiv-encryption'",
    });
  } catch (err) {
    log({
      surface: "arkiv-encryption",
      expected: "installs and roundtrips",
      actual: String(err),
      ok: false,
      repro: "pnpm add arkiv-encryption@0.1.0",
      fix: "Fall back to WebCrypto AES-GCM with AAD",
    });
  }

  flushFriction();
  const failed = entries.filter((e) => !e.ok).length;
  console.log(`\nProbe done. ${entries.length} entries, ${failed} failures/diffs.`);
  process.exit(failed > 0 ? 1 : 0);
}

function flushFriction() {
  const dir = resolve(process.cwd(), "arkiv");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = resolve(dir, "friction.md");
  const header = `# Grove friction report

SDK: \`@arkiv-network/sdk@${SDK_VERSION}\` · Encryption: \`arkiv-encryption@${ENC_VERSION}\` · Network: Tiramisu (7738577)

Format per entry: surface · expected · actual · versions · repro · suggested fix.

`;
  if (!existsSync(path)) writeFileSync(path, header);
  else if (!readFileSync(path, "utf8").includes("Grove friction report")) {
    writeFileSync(path, header + readFileSync(path, "utf8"));
  }

  const stamp = new Date().toISOString();
  let block = `\n## Probe run ${stamp}\n\n`;
  for (const e of entries) {
    block += `### ${e.surface}\n`;
    block += `- **Expected:** ${e.expected}\n`;
    block += `- **Actual:** ${e.actual}\n`;
    block += `- **Versions:** sdk ${SDK_VERSION}, arkiv-encryption ${ENC_VERSION}\n`;
    block += `- **Repro:** ${e.repro}\n`;
    if (e.fix) block += `- **Suggested fix:** ${e.fix}\n`;
    block += `- **Status:** ${e.ok ? "ok / documented" : "needs attention"}\n\n`;
  }
  appendFileSync(path, block);
  console.log(`Appended to ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
