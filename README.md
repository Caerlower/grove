# Grove

**A private, expiring notes vault for AI agents.** Agents can only write sealed drafts. Nothing is trusted until the human vault owner endorses it. Every reader (MCP server and web app) runs the same `evaluateNote()` gate against on-chain `$creator` / `$owner` / endorsements before showing a note to an agent.

Built for **Arkiv: Global Tour Stop** (Privacy + Security tracks) on **Tiramisu** testnet with `@arkiv-network/sdk` 0.8.x and `arkiv-encryption` 0.1.0.

All demo content is **synthetic**.

## Why Arkiv

| Property | What breaks without it |
|---|---|
| Immutable `$creator` | Any server can lie about who wrote a note |
| Public endorsements bound to `payloadSha256` | Readers need our backend to recheck approval |
| Entity Expiration | Unreviewed drafts need a cron / operator to delete |
| Ownership handoff (`$owner`) | Agent keeps write rights after creating a draft |

**What stays off Arkiv:** vault key, plaintext, agent API keys, private keys, trust thresholds (client config).

## Honest threat model

**Protects**

- Note content from outsiders who can read the chain (payload is sealed).
- Readers from notes written by untrusted or compromised agents — even agents that hold the vault key — because allowlist + endorsement bind to `$creator` and ciphertext hash.

**Does not**

- Hide metadata: creator/owner addresses, timing, payload size (plaintext length + 28 bytes), expiry, attributes.
- Stop anyone who holds the vault key from decrypting.
- Un-read plaintext after Entity Expiration or key rotation.
- Enforce trust on-chain. Anyone can write entities with our `project` value. **Our readers enforce trust using `$creator`.**

Blind tag index (`th1`–`th3`) leaks tag frequency patterns; equality match only.

## Monorepo

```
grove/
  apps/web/          Next.js UI (landing + Clear Desk app)
  packages/core/     crypto, evaluateNote, trust, Arkiv client
  packages/mcp/      MCP server (stdio) + grove-owner CLI
  scripts/           probe, seed, wallets, evidence
  docs/              schema, friction, design, submission, evidence
```

## Setup

```bash
cd grove
pnpm install
cp .env.example .env.local
# Fill wallets, VAULT_KEY, and ARKIV_API_KEY (Hub → free access key)
```

Fund these addresses on [Tiramisu faucet](https://hub.arkiv.network/faucet):

```bash
pnpm wallets
```

Then:

```bash
pnpm probe          # appends to docs/friction.md
pnpm test           # unit tests (no network)
pnpm seed           # scenarios A–G → docs/evidence.md
cp scripts/seed-result.json apps/web/public/seed-result.json
pnpm web            # http://localhost:3000
```

Owner CLI:

```bash
pnpm owner pending
pnpm owner approve <nid>
pnpm owner reject <nid>
pnpm owner allow <addr> [label]
pnpm owner revoke <addr>
```

MCP (Cursor): see `.mcp.json`. Tools: `grove_write_note`, `grove_read_note`, `grove_search`, `grove_my_status`, `grove_trust_report`.

## Public deploy & demo UX

| Route | Purpose |
|---|---|
| `/` | Landing — problem, Arkiv flow, threat model, CTAs |
| `/app/live` | **Connect wallet + agent** — allowlist agent → Claude/MCP writes → you endorse in-wallet → gate flips |
| `/app/pending` | Same endorse buttons on the full queue |
| `/app/attack` | Seeded A–G board (proof cases) |
| `/app` | Vault of allowed notes |
| `/app/verify` | No-key verification of `$creator` / hash |
| `/app/agents` | Allowlist + trust tiers |

Demo signing uses server-side OWNER + AGENT_A keys on Tiramisu (synthetic only). Keys never reach the browser.

Public mode is read/verify/attack only — **no owner private key on the server**.

Judges click **Unlock seeded demo vault** → `/api/demo-unlock` returns the synthetic `DEMO_VAULT_KEY` (server env only, never `NEXT_PUBLIC_*`). Real vaults must not use this path.

## Architecture

1. Agent seals `{title,body,tags,links}` → creates `note` → `changeOwnership` to vault owner.
2. Owner reviews pending queue → `endorsement` (+ Lifetime Extension on approve).
3. Readers call `evaluateNote()` (single implementation in `@grove/core`).

Trust tiers (`new` / `trusted` / `suspended`) are computed client-side from owner endorsements. Trusted agents get deterministic review sampling.

## Future work (not built)

- Company-verified knowledge MCP (same gate; endorser = org wallet; agents in strict mode only see `endorsed`).
- Agent quorum corroboration (agreement ≠ truth).
- Time-boxed wrapped-key grants; versioned note edits.

## License

MIT
