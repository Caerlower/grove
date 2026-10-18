# Grove

**Sealed notes for AI agents — nothing is trusted until a human endorses it.**

Agents write encrypted drafts on [Arkiv](https://arkiv.network). The vault owner endorses with their wallet. Every reader — MCP server and web app — runs the same `evaluateNote()` gate against on-chain `$creator`, `$owner`, and endorsement hashes before a note can influence another agent.

| | |
| --- | --- |
| **Network** | Arkiv Tiramisu testnet (`7738577`) |
| **Stack** | `@arkiv-network/sdk` · `arkiv-encryption` · Next.js · viem / wagmi |
| **License** | [MIT](./LICENSE) |
| **Repo** | https://github.com/Caerlower/grove |

Demo content is synthetic. Do not put real personal data on chain.

---

## Try the live demo (no local setup)

The **Vercel deploy is ready to use**. Demo agent keys, vault unlock, and keyed Arkiv RPC are already configured on the server. You do **not** need agent private keys locally.

**Your connected wallet is the vault owner** for Live, Vault, and Pending. Notes are handed to that address; after you Approve, they show in **your** Vault (not the shared seed library of ~7 notes — those stay on Attack / explorer evidence).

1. Open the hosted app (your Vercel URL).
2. Connect a funded Tiramisu wallet ([faucet](https://hub.arkiv.network/faucet)).
3. Go to **`/app/live`**: Allowlist Agent A → write → Approve.
4. Open **`/app`** (Vault) with the same wallet — your endorsed note should appear.

Attack board + [`docs/evidence.md`](./docs/evidence.md) still show the seeded A–G scenarios under the shared demo owner.

Local install below is only if you want to run or fork the stack yourself.

---

## Why Grove

Multi-agent systems share working memory as notes. Those notes often live in operator-controlled stores or as plaintext on chain. A planted note can poison the next agent, and there is no cheap way to prove **who wrote it** or whether a **human approved** that exact ciphertext.

Grove makes authorship and approval public and verifiable, while keeping note bodies sealed.

---

## Why Arkiv

| Property | Without it |
| --- | --- |
| Immutable `$creator` | Any server can lie about who wrote a note |
| Endorsements bound to `payloadSha256` | Readers need your backend to re-check approval |
| Entity Expiration | Unreviewed drafts need a cron to delete |
| Ownership handoff (`$owner`) | Agent keeps write rights after creating a draft |

**Not a fit:** Postgres/API (readers trust your server), IPFS (no `$creator` / handoff / expiration), subgraphs (not a write-time authorship primitive).

**Stays off Arkiv:** vault key, plaintext, agent API keys, private keys, trust thresholds.

---

## Architecture

```
┌─────────────┐     sealed note      ┌──────────────────┐
│ Agent / MCP │ ───────────────────► │ Arkiv            │
│  writer     │   changeOwnership    │  note            │
└─────────────┘                      │  endorsement     │
                                     │  agent allowlist │
                                     └────────┬─────────┘
                                              │ query
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
              ┌────────────┐           ┌────────────┐           ┌────────────┐
              │ MCP reader │           │  Web app   │           │  Verify UI │
              │ evaluateNote│           │ evaluateNote│           │  $creator  │
              └────────────┘           └────────────┘           └────────────┘
                                              ▲
                               ┌──────────────┴──────────────┐
                               │ Human vault owner (wallet)  │
                               │ endorse / reject / allowlist│
                               └─────────────────────────────┘
```

### Write

1. Seal `{ title, body, tags, links }` (`application/vnd.arkiv.encrypted.v1`).
2. Create a `note` (public attrs only: `project`, `type`, `vault`, `nid`, optional blind tags).
3. `changeOwnership` → vault owner; agent loses write rights.
4. Draft **Entity Expiration** (default 10 minutes in the demo config).

### Endorse

1. Owner decrypts locally (vault key stays client-side / owner CLI).
2. Create an `endorsement` with `decision` + `payloadSha256`.
3. On approve, **Lifetime Extension** (~30 days).

### Read

MCP, web, and verify all call **one** implementation: `evaluateNote()` in `@grove/core`. The chain does not enforce trust — readers do.

| Package | Role |
| --- | --- |
| `@grove/core` | Crypto, builders, gate, trust tiers, Arkiv client |
| `@grove/mcp` | stdio MCP server + owner CLI |
| `@grove/web` | Next.js UI + server routes for keyed RPC |

Contract: [`arkiv/schema.md`](./arkiv/schema.md) · SDK notes: [`arkiv/friction.md`](./arkiv/friction.md)

---

## Trust gate

Order in [`packages/core/src/gate/evaluateNote.ts`](./packages/core/src/gate/evaluateNote.ts):

1. `$creator` on allowlist  
2. `$owner` === vault owner  
3. Sealed content type  
4. Decrypts with vault key  
5. No owner `reject` for `nid`  
6. Owner `approve` + matching `payloadSha256` → `endorsed`  
7. Else trust tier (`new` / `suspended` → pending; `trusted` → allow with warning unless strict)

Never trust an author field inside the payload.

---

## Threat model

**Protects:** note bodies from chain readers; readers from untrusted writers (even if they hold the vault key), via `$creator` + hash-bound endorsement.

**Does not:** hide metadata (addresses, timing, size, expiry, attrs); stop vault-key holders from decrypting; un-read plaintext after expiry/rotation; enforce trust on-chain (anyone can write your `project` stamp — readers filter).

---

## Repository

```
grove/
├── apps/web/           Next.js UI
├── packages/core/      gate, crypto, Arkiv client
├── packages/mcp/       MCP + owner CLI
├── scripts/            probe, seed, wallets
├── arkiv/              schema + friction
├── docs/               evidence from seed
├── .env.example
└── LICENSE
```

---

## Quick start

```bash
git clone https://github.com/Caerlower/grove.git
cd grove
pnpm install
cp .env.example .env.local
```

Set wallets, `VAULT_KEY` / `DEMO_VAULT_KEY`, and `ARKIV_API_KEY` ([Hub](https://hub.arkiv.network)). Fund wallets at the [faucet](https://hub.arkiv.network/faucet):

```bash
pnpm wallets
pnpm test
pnpm seed    # optional: A–G scenarios → docs/evidence.md
cp scripts/seed-result.json apps/web/public/seed-result.json
pnpm web     # http://localhost:3000
```

```bash
pnpm owner pending|approve|reject|allow|revoke
pnpm mcp                 # see .mcp.json
pnpm probe               # appends to arkiv/friction.md
```

---

## App

| Route | Purpose |
| --- | --- |
| `/` | Landing |
| `/app/live` | Connect → allowlist → write → endorse → gate |
| `/app/pending` | Pending queue |
| `/app/attack` | Seeded edge-case board |
| `/app` | Vault graph + library |
| `/app/verify` | `$creator` / hash without vault key |
| `/app/agents` | Allowlist + trust tiers |

See [Try the live demo](#try-the-live-demo-no-local-setup) for the hosted path. `/api/vault/*` uses server-side `ARKIV_API_KEY` so the browser does not hit the anonymous RPC budget. Demo unlock uses `DEMO_VAULT_KEY` on the server only — never ship a real vault key as `NEXT_PUBLIC_*`.

---

## MCP

| Tool | Behavior |
| --- | --- |
| `grove_write_note` | Seal + create + handoff |
| `grove_read_note` | Gate, then unwrap or refuse |
| `grove_search` | Scoped / blind-tag search |
| `grove_my_status` | Allowlist / tier |
| `grove_trust_report` | Endorsement stats |

---

## On-chain demo (Tiramisu)

Optional seeded project `grove-c3d9f553` / vault `vault-43fda199`:

| Role | Address |
| --- | --- |
| OWNER | `0x811E77Fe50710984108648D0e101C37a5F435816` |
| AGENT_A | `0x63829773Be7d3fF99c008a5F5778390f9F6B5404` |
| AGENT_B | `0x0DC6De9cc933271C77a3d20550a08B3226B0fa6C` |
| ROGUE | `0x044ed18bFa874aaa2c573DE3ef52a167d40EEfD0` |

Entity keys and txs: [`docs/evidence.md`](./docs/evidence.md) · Explorer: https://tiramisu.explorer.arkiv.network

---

## License

[MIT](./LICENSE)
