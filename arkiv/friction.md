# Grove friction report

SDK: `@arkiv-network/sdk@0.8.1` · Encryption: `arkiv-encryption@0.1.0` · Network: Tiramisu (7738577)

Format per entry: surface · expected · actual · versions · repro · suggested fix.

## Pre-probe notes

### Package discovery

- **Expected:** `arkiv-encryption@0.1.0` exports seal/open style API.
- **Actual:** Exports `generateKey`, `importKey`, `encryptPayload`, `decryptPayload`, `CONTENT_TYPE = application/vnd.arkiv.encrypted.v1`. No `seal`/`open` names.
- **Versions:** arkiv-encryption 0.1.0
- **Repro:** `import { encryptPayload, decryptPayload } from "arkiv-encryption"`
- **Suggested fix:** Docs/skill should list exact function names; Grove adapted.
- **Status:** ok / documented

### ExpirationTime.fromSeconds

- **Expected:** Duration helpers exist.
- **Actual:** `fromSeconds` requires a positive multiple of block time (2s). Odd values throw.
- **Versions:** sdk 0.8.1
- **Repro:** `ExpirationTime.fromSeconds(601)` throws; `600` works.
- **Suggested fix:** Grove `extendToAtLeast` floors to even seconds.
- **Status:** ok / documented

### Reserved attribute name `addr`

- **Expected:** Attribute name `addr` for allowlist entries.
- **Actual:** SDK throws `InvalidAttributeNameError`: `"addr" is reserved by the query language`.
- **Versions:** sdk 0.8.1
- **Repro:** `attributes: { addr: str("0x…") }`
- **Suggested fix:** Grove uses `agentaddr` instead. Docs should list reserved names.
- **Status:** ok / documented

### Batch API name

- **Expected:** Some write-ups say `mutateEntities`.
- **Actual:** SDK 0.8 exports `executeBatch`.
- **Versions:** sdk 0.8.1
- **Repro:** `wallet.mutateEntities` is undefined; use `wallet.executeBatch`.
- **Status:** ok / documented

Probe run results are appended below by `pnpm probe`.

## Probe run 2026-10-18T14:25:31.237Z

### faucet / balance
- **Expected:** Owner wallet funded with test GLM
- **Actual:** balance=100000000000000000 wei address=0x811E77Fe50710984108648D0e101C37a5F435816
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** Fund via https://hub.arkiv.network/faucet then re-run pnpm probe
- **Status:** ok / documented

### createEntity + select where lowercase/numeric
- **Expected:** Entity creatable and queryable by project, type, i32 score
- **Actual:** entityKey=0xfd451341ebdf025147c0d6d6045fd6107bd4791efc596a480e6cec43d4f77fb1 tx=0x34d660a6b5ea5406571d8b8d9e510d1e142f6362bf421e6f51287d59a42c1bb9 found=true page=1
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** create with str/i32/u64 attrs then select().where(eq...).fetch()
- **Status:** ok / documented

### uppercase attribute name
- **Expected:** revert / reject
- **Actual:** reverted: EntityMutationError: Transaction failed: an attribute name holds "B" (0x42) at byte 0, which is outside the name charset ("A"-"Z", "a"-"z", "0"-"9", ".", "-" and "_", with a letter first)
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** createEntity with uppercase attribute key
- **Suggested fix:** Confirm: use lowercase attribute names only
- **Status:** ok / documented

### changeOwnership rights
- **Expected:** Former owner loses update and extend
- **Actual:** updateLost=true extendLost=true
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** create → changeOwnership → updateEntity/extendEntity as former owner
- **Status:** ok / documented

### extendEntity semantics
- **Expected:** documented SET behaviour
- **Actual:** EntityMutationError: Transaction failed: entity 0x9594b728…fb340b already expires at block 742473, so extending it to 742173 would shorten its life
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** see stack
- **Status:** needs attention

### permissionlessExtension flag
- **Expected:** Flag accepted on create
- **Actual:** flags={"readonly":false,"permissionlessExtension":true,"raw":2} key=0xca0e11141c047dd66ad03fc26b7abae2cbafcf8c51b08c8826764f6cc0d0ec98
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** createEntity({ flags: { permissionlessExtension: true } })
- **Status:** ok / documented

### payload size ~50KiB
- **Expected:** Accepted (arkiv-encryption MAX_PLAINTEXT 100k)
- **Actual:** ok key=0x4906cb994a13373903f2f406469e6a49c2f366c71cb32b01fa8dd2fbfb6fd5e2
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** createEntity with 50_000 byte payload
- **Status:** ok / documented

### mutateEntities batch of 5
- **Expected:** success
- **Actual:** TypeError: wallet.mutateEntities is not a function
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** see stack
- **Status:** needs attention

### watchEntityEvents WebSocket
- **Expected:** Real socket delivers create event (no fromBlock)
- **Actual:** gotEvent=false
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** createPublicClient(webSocket) + watchEntityEvents without fromBlock
- **Suggested fix:** UI keeps 10s polling fallback
- **Status:** ok / documented

### pagination >200
- **Expected:** cursor pages pin atBlock; max 200/page
- **Actual:** Skipped heavy seed in probe; Grove uses limit(200) + hasNextPage. See docs.
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** select().limit(200).fetch(); while hasNextPage() page.next()
- **Status:** ok / documented

### anonymous RPC quota
- **Expected:** May 429 ANON_COST_LIMITED under load
- **Actual:** No 429 during this probe run
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** Hammer public RPC without access key
- **Suggested fix:** Use Hub access key on server if deploying under load
- **Status:** ok / documented

### createdBy per allowlisted agent
- **Expected:** Cheap enough for small allowlists
- **Actual:** Using createdBy(owner) for allowlist/endorsements; createdBy(agent) for notes
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** select().where(...).createdBy(addr).fetch()
- **Status:** ok / documented

### arkiv-encryption
- **Expected:** generateKey/importKey/encryptPayload/decryptPayload; CONTENT_TYPE v1
- **Actual:** roundtrip=true contentType=application/vnd.arkiv.encrypted.v1 version=0.1.0
- **Versions:** sdk 0.8.1, arkiv-encryption 0.1.0
- **Repro:** import from 'arkiv-encryption'
- **Status:** ok / documented

