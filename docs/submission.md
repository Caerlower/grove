# Devfolio submission draft (Grove)

Tracks: **Privacy (Global)**, **Security (Global)**. Optionally **Open Source** via [`/arkiv/schema.md`](../arkiv/schema.md) as the data contract.

## Why Privacy?

Agents store shared working notes that later agents treat as fact. Today those notes often live in operator-controlled stores or in plaintext on chain. Outsiders who can read the chain — or a compromised indexer — see content. Grove seals payloads with `arkiv-encryption` (`application/vnd.arkiv.encrypted.v1`). Public attributes are few (`project`, `type`, `vault`, `nid`, blind tag hashes, `createdat`). Entity Expiration lets drafts fade; endorsed notes get Lifetime Extension under owner control. What stays visible: addresses, timing, sizes — stated honestly in the threat model.

## Why Security?

Memory poisoning / prompt injection spreads when any writer can plant a note and any reader trusts it. Grove never trusts an author field in a payload. Readers filter by immutable on-chain `$creator` (allowlist), require ownership handoff to the vault owner, and bind endorsements to `payloadSha256` of the live ciphertext. The Attack page shows rogue, unreviewed, replayed, handoff-skipped, and unsealed notes rejected with explicit reasons.

## Why Arkiv?

- Postgres / our API: readers must trust our server for authorship and approval.
- IPFS: content-addressed but no first-class `$creator`, ownership handoff, or Entity Expiration.
- Subgraph: indexes someone else's chain logic; not a write-time authorship primitive agents can verify without us.

We keep vault keys, plaintext, and trust thresholds off Arkiv on purpose.

## How we use Arkiv (each feature → user-visible effect)

| Feature | Why | What the user sees |
|---|---|---|
| Attributes vs payload | Query filters on attrs; secrets in sealed payload | Explorer shows attrs only; body stays ciphertext |
| `createdBy` / project filter | Find an agent's notes / owner endorsements | Pending queue and MCP search scoped correctly |
| Entity Expiration | Unreviewed drafts die without cron | Draft life 10 min (demo); reject → fades |
| Lifetime Extension | Approve → keep for 30 days | Extends on approve |
| `changeOwnership` | Agent loses write after create | Verify shows `$owner` = vault owner; else `handoff_incomplete` |
| `$creator` | Unforgeable authorship | Gate rejects non-allowlisted creators |
| WebSocket events | Live pending (with poll fallback) | Pending page refreshes |
| Batch writes | Seed / multi-create probe | Faster setup |

## Friction

See [`/arkiv/friction.md`](../arkiv/friction.md) (probe + integration notes).

## Wallets that create entities

Listed via `pnpm wallets` / [`docs/evidence.md`](./evidence.md) after seed: OWNER, AGENT_A, AGENT_B, ROGUE. Also listed in the root README.

## Pre-existing work

None — built during the challenge window.

## LLMs used

Cursor / Composer (AI coding agent).

## One thing Arkiv should improve first

Clearer published function names for `arkiv-encryption` in the skill (we found `encryptPayload`/`decryptPayload`, not `seal`/`open`).
