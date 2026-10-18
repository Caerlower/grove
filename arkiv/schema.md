# Grove data contract

**Project stamp:** every entity sets `project` to `PROJECT_VALUE` (env). Every query filters `eq("project", str(PROJECT_VALUE))`.

**Network:** Tiramisu testnet, chain ID `7738577`.

**Vocabulary:** Arkiv entities · Entity Expiration · Lifetime Extension. Never TTL.

## Entity types

### `note`

| | |
|---|---|
| **Creator** | Agent wallet (`$creator` immutable) |
| **Owner** | Agent at create, then handed to vault owner via `changeOwnership` |
| **Payload** | Sealed with `arkiv-encryption` (`application/vnd.arkiv.encrypted.v1`). Plaintext JSON: `{ title, body, tags[], links[] }` where `links` are other note `nid`s |
| **Entity Expiration** | Draft: `DRAFT_LIFE_SECONDS` (demo default **600s / 10 min**). On owner approve: Lifetime Extension to **30 days** |
| **Why this expiry** | Unreviewed agent drafts must fade without a cron. Endorsed notes stay long enough for judging + demo |

**Public attributes (all lowercase):**

| name | type | purpose |
|---|---|---|
| `project` | str | tenant isolation |
| `type` | str | `"note"` |
| `vault` | str | vault id |
| `nid` | str | opaque 16-hex note id |
| `th1` `th2` `th3` | str | optional blind tag hashes (HMAC), equality only |
| `createdat` | u64 | unix seconds (client sort; `$createdAt` is not query-indexed) |

### `endorsement`

| | |
|---|---|
| **Creator / owner** | Vault owner |
| **Payload** | Plain JSON `{ noteKey, nid, payloadSha256, decision, agent, decidedAt }` |
| **Entity Expiration** | **90 days** (must outlive the note) |
| **Why** | Public, queryable proof of human decision bound to ciphertext hash |

**Attributes:** `project`, `type="endorsement"`, `vault`, `nid`, `decision` (`approve`\|`reject`), `agent` (lowercase addr), `decidedat` (u64).

### `agent` (allowlist)

| | |
|---|---|
| **Creator / owner** | Vault owner |
| **Payload** | Plain JSON `{ label }` |
| **Entity Expiration** | **90 days** |

**Attributes:** `project`, `type="agent"`, `vault`, `agentaddr` (lowercase; **not** `addr` — reserved by the query language), `status` (`allowed`\|`revoked`), `since` (u64).

**Latest-wins:** per `agentaddr`, highest `since` wins.

## Queries the app runs

```ts
// Notes by allowlisted creator
select({ key, creator, owner, contentType, payload, expiresAt, attributes: true })
  .where(eq("project",…), eq("type","note"), eq("vault",…))
  .createdBy(agentAddr).limit(200).fetch()

// Note by nid
.where(…, eq("nid", str(nid))).limit(10)

// Endorsements for nid (owner-created)
.where(eq("type","endorsement"), eq("nid",…)).createdBy(owner).limit(200)

// All owner endorsements (trust tiers)
.where(eq("type","endorsement"), eq("vault",…)).createdBy(owner)

// Allowlist
.where(eq("type","agent"), eq("vault",…)).createdBy(owner)

// Blind tag search
.where(eq("type","note"), or(eq("th1",h), eq("th2",h), eq("th3",h)))
```

No server-side `orderBy`. Sort by `createdat` / `decidedat` client-side.

## Trust model (readers enforce — chain does not)

Anyone can write entities with our `project` value. Readers run `evaluateNote()`:

1. `$creator` on allowlist  
2. `$owner` === vault owner (handoff complete)  
3. sealed content type  
4. decrypts with vault key  
5. no owner `reject` for `nid`  
6. owner `approve` with matching `payloadSha256` → allow `endorsed`  
7. else trust tier: `new`/`suspended` → `pending_review`; `trusted` → allow with warning unless `GROVE_STRICT`

Never trust an author field inside payload or attributes.

## What stays off Arkiv

Vault key, plaintext, agent API keys, private keys, trust thresholds (client config).
