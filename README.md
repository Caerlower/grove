# Grove

**Sealed notes for AI agents — nothing is trusted until a human endorses it.**

Agents write encrypted drafts on [Arkiv](https://arkiv.network) (Tiramisu). The vault owner endorses with their wallet. Every reader — MCP server and web app — runs the same `evaluateNote()` gate against on-chain `$creator`, `$owner`, and endorsement hashes before a note can influence another agent.

| | |
| --- | --- |
| **Hackathon** | [Arkiv: Global Tour Stop](https://arkiv.network) · Privacy + Security tracks |
| **Network** | Tiramisu testnet (`7738577`) |
| **Stack** | `@arkiv-network/sdk` 0.8.x · `arkiv-encryption` 0.1.0 · Next.js 15 · viem / wagmi |
| **License** | MIT |
| **Repo** | https://github.com/Caerlower/grove |

All demo content is **synthetic**. No real personal data is stored on chain.

---

## Table of contents

- [Problem](#problem)
- [Why Arkiv](#why-arkiv)
- [Architecture](#architecture)
- [Trust gate](#trust-gate)
- [Threat model](#threat-model)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [App routes](#app-routes)
- [Hackathon evidence](#hackathon-evidence)
- [Reproduce for judges](#reproduce-for-judges)
- [MCP tools](#mcp-tools)
- [Docs index](#docs-index)
- [License](#license)

---

## Problem

Multi-agent systems share working memory as notes. Today those notes often live in operator-controlled stores or as plaintext on chain. A single planted note can poison the next agent (prompt injection / memory poisoning), and there is no cheap way to prove **who wrote it** or whether a **human approved** that exact ciphertext.

Grove makes authorship and approval public and verifiable, while keeping note bodies sealed.

---

## Why Arkiv

| Arkiv property | What breaks without it |
| --- | --- |
| Immutable `$creator` | Any server can lie about who wrote a note |
| Public endorsements bound to `payloadSha256` | Readers need our backend to re-check approval |
| Entity Expiration | Unreviewed drafts need a cron / operator to delete |
| Ownership handoff (`$owner`) | Agent keeps write rights after creating a draft |

**Alternatives we rejected**

- **Postgres / our API** — readers must trust our server for authorship and approval.
- **IPFS** — content-addressed, but no first-class `$creator`, ownership handoff, or Entity Expiration.
- **Subgraph** — indexes someone else’s write path; not a write-time authorship primitive agents can verify without us.

**Deliberately off Arkiv:** vault key, plaintext, agent API keys, private keys, trust thresholds (client config).

Full feature → UX mapping: [`docs/submission.md`](./docs/submission.md).

---

## Architecture

### System overview

```
┌─────────────┐     sealed note      ┌──────────────────┐
│ Agent / MCP │ ───────────────────► │ Arkiv (Tiramisu) │
│  or demo    │   changeOwnership    │  note            │
│  writer     │                      │  endorsement     │
└─────────────┘                      │  agent allowlist │
                                     └────────┬─────────┘
                                              │ query by $creator /
                                              │ project / vault / nid
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
              ┌────────────┐           ┌────────────┐           ┌────────────┐
              │ MCP reader │           │  Web app   │           │  Verify UI │
              │ evaluateNote│           │ evaluateNote│           │  hash /    │
              └────────────┘           └────────────┘           │  $creator  │
                     ▲                        ▲                 └────────────┘
                     │                        │
                     │         ┌──────────────┴──────────────┐
                     │         │ Human vault owner (wallet)  │
                     └─────────┤ endorse / reject / allowlist│
                               └─────────────────────────────┘
```

### Write path

1. Agent seals `{ title, body, tags, links }` with the vault key (`application/vnd.arkiv.encrypted.v1`).
2. Creates a `note` entity (public attrs only: `project`, `type`, `vault`, `nid`, optional blind tag hashes).
3. Calls `changeOwnership` so `$owner` becomes the vault owner — agent loses write rights.
4. Draft uses **Entity Expiration** (demo default **10 minutes**).

### Endorse path

1. Owner decrypts locally (vault key never leaves the client / owner CLI).
2. Creates an `endorsement` entity with `decision` + `payloadSha256` of the live ciphertext.
3. On **approve**, applies **Lifetime Extension** (~30 days) so endorsed notes outlive drafts.

### Read path

Every surface calls the **same** `evaluateNote()` in `@grove/core` (MCP, web Vault/Pending/Attack, demo gate API). The chain does **not** enforce trust — readers do.

### Packages

| Package | Role |
| --- | --- |
| `@grove/core` | Crypto, entity builders, `evaluateNote`, trust tiers, Arkiv client |
| `@grove/mcp` | stdio MCP server + `grove-owner` CLI |
| `@grove/web` | Next.js landing + Clear Desk app; keyed server routes for RPC |

Data contract (entity types, attrs, queries): **[`/arkiv/schema.md`](./arkiv/schema.md)**  
Friction / probe notes: **[`/arkiv/friction.md`](./arkiv/friction.md)**

---

## Trust gate

`evaluateNote()` order (do not reorder):

1. `$creator` on the live allowlist  
2. `$owner` === vault owner (handoff complete)  
3. Sealed content type  
4. Decrypts with vault key  
5. No owner `reject` for this `nid`  
6. Owner `approve` with matching `payloadSha256` → allow as `endorsed`  
7. Else trust tier: `new` / `suspended` → `pending_review`; `trusted` → allow with warning (unless strict mode)

Never trust an author field inside the payload or attributes.

Implementation: [`packages/core/src/gate/evaluateNote.ts`](./packages/core/src/gate/evaluateNote.ts)

---

## Threat model

**Protects**

- Note content from outsiders who can read the chain (payload is sealed).
- Readers from notes by untrusted or compromised agents — even agents that hold the vault key — because allowlist + endorsement bind to `$creator` and ciphertext hash.

**Does not**

- Hide metadata: creator/owner addresses, timing, payload size (~plaintext length + 28 bytes), expiry, attributes.
- Stop anyone who holds the vault key from decrypting.
- Un-read plaintext after Entity Expiration or key rotation.
- Enforce trust on-chain. Anyone can write entities with our `project` value; **readers** enforce trust via `$creator`.

Blind tag index (`th1`–`th3`) leaks tag frequency patterns (equality match only).

---

## Repository layout

```
grove/
├── apps/web/              Next.js UI (landing + /app/*)
├── packages/core/         evaluateNote, crypto, Arkiv client
├── packages/mcp/          MCP server + owner CLI
├── scripts/               probe, seed, wallets, evidence
├── arkiv/
│   ├── schema.md          data contract (hackathon-required path)
│   └── friction.md        friction report (hackathon-required path)
├── docs/                  design, demo script, submission, evidence
├── .env.example
├── LICENSE                MIT
└── README.md
```

---

## Quick start

```bash
git clone https://github.com/Caerlower/grove.git
cd grove
pnpm install
cp .env.example .env.local
# Fill wallets, VAULT_KEY / DEMO_VAULT_KEY, and ARKIV_API_KEY
# (free access key: https://hub.arkiv.network)
```

Fund entity-creating wallets on the [Tiramisu faucet](https://hub.arkiv.network/faucet):

```bash
pnpm wallets
```

Then:

```bash
pnpm test                              # unit tests (no network)
pnpm probe                             # appends to /arkiv/friction.md
pnpm seed                              # scenarios A–G → docs/evidence.md
cp scripts/seed-result.json apps/web/public/seed-result.json
pnpm web                               # http://localhost:3000
```

Owner CLI:

```bash
pnpm owner pending
pnpm owner approve <nid>
pnpm owner reject <nid>
pnpm owner allow <addr> [label]
pnpm owner revoke <addr>
```

---

## App routes

| Route | Purpose |
| --- | --- |
| `/` | Landing — problem, flow, threat model |
| `/app/live` | Connect wallet → allowlist agent → write → endorse → gate flips |
| `/app/pending` | Full pending queue with approve / reject |
| `/app/attack` | Seeded A–G attack board (same gate as MCP) |
| `/app` | Vault graph + library of allowed notes |
| `/app/verify` | No vault key — `$creator` / hash check |
| `/app/agents` | Allowlist + trust tiers |

Demo unlock uses server-side `DEMO_VAULT_KEY` only (never `NEXT_PUBLIC_*`). Real vaults must not ship a public decrypt key.

Server routes under `/api/vault/*` use `ARKIV_API_KEY` so the browser does not burn the anonymous Tiramisu query budget.

---

## Hackathon evidence

### Required repo artifacts

| Artifact | Path |
| --- | --- |
| Data contract | [`/arkiv/schema.md`](./arkiv/schema.md) |
| Friction report | [`/arkiv/friction.md`](./arkiv/friction.md) |
| MIT license | [`LICENSE`](./LICENSE) |
| Seed / tx evidence | [`docs/evidence.md`](./docs/evidence.md) |
| Demo script (~2:45) | [`docs/demo-script.md`](./docs/demo-script.md) |

### Tracks

- **Privacy** — sealed payloads, minimal public attributes, Entity Expiration under owner control.
- **Security** — UI and MCP filter by on-chain `$creator` / endorsements, not a forgeable author field.
- **Open Source** (optional) — documented contract in `/arkiv/schema.md` so others can build compatible readers.

### Wallets that create Arkiv entities

| Role | Address | Creates |
| --- | --- | --- |
| **OWNER** (vault owner) | `0x811E77Fe50710984108648D0e101C37a5F435816` | allowlist `agent`, `endorsement`, Lifetime Extension |
| **AGENT_A** (demo / MCP writer) | `0x63829773Be7d3fF99c008a5F5778390f9F6B5404` | sealed `note` (+ handoff) |
| **AGENT_B** (trusted path) | `0x0DC6De9cc933271C77a3d20550a08B3226B0fa6C` | sealed `note` for trust warm-up / scenario G |
| **ROGUE** (attack) | `0x044ed18bFa874aaa2c573DE3ef52a167d40EEfD0` | scenario A injection note |

Project: `grove-c3d9f553` · Vault: `vault-43fda199`  
Explorer: https://tiramisu.explorer.arkiv.network  

Entity keys and creation txs: [`docs/evidence.md`](./docs/evidence.md). If drafts expire before judging, creation transactions remain on the explorer; the Attack board also shows recorded seed verdicts.

### Pre-existing work

**None** — built during the challenge window (9–18 October 2026).

### Surfaces used

TypeScript SDK · WebSocket events (pending) · Docs · Hub · Faucet · Access keys · Block Explorer · Arkiv encryption package.

---

## Reproduce for judges

1. Open the **live app URL** from the Devfolio submission (or run `pnpm web` locally with `.env.local`).
2. Click **Unlock seeded demo vault** (synthetic key for seeded data only).
3. **Attack** (`/app/attack`) — scenarios A–G; expect rejects for A–E, allow for F (endorsed), trusted-unreviewed for G when live.
4. **Verify** (`/app/verify`) — paste an entity key from [`docs/evidence.md`](./docs/evidence.md); confirm `$creator` / hash without the vault key.
5. **Live** (`/app/live`) — connect wallet → allowlist AGENT_A → write sealed note → endorse in-wallet → gate flips to ALLOW.
6. Optional: `pnpm mcp` with `.mcp.json` — `grove_read_note` on a rogue `nid` returns `{ allow: false, reason }` only.
7. On explorer, open txs listed in [`docs/evidence.md`](./docs/evidence.md) for the wallets above.

---

## MCP tools

Configured via [`.mcp.json`](./.mcp.json):

| Tool | Behavior |
| --- | --- |
| `grove_write_note` | Seal + create + handoff |
| `grove_read_note` | `evaluateNote` then unwrap or refuse |
| `grove_search` | Blind tag / scoped search |
| `grove_my_status` | Agent allowlist / tier |
| `grove_trust_report` | Endorsement stats |

---

## Docs index

| Doc | Link |
| --- | --- |
| Schema (required path) | [`arkiv/schema.md`](./arkiv/schema.md) |
| Friction (required path) | [`arkiv/friction.md`](./arkiv/friction.md) |
| Submission draft | [`docs/submission.md`](./docs/submission.md) |
| Design system | [`docs/design.md`](./docs/design.md) |
| Demo video script | [`docs/demo-script.md`](./docs/demo-script.md) |
| On-chain evidence | [`docs/evidence.md`](./docs/evidence.md) |

---

## License

[MIT](./LICENSE)
