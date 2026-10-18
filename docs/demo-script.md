# Demo video script (~2:45)

1. **0:00 Problem** — Agents share notes; one planted note poisons the next agent. No cheap way to see who wrote it or whether a human approved it.
2. **0:20 Write** — MCP `grove_write_note` seals a draft. Explorer: ciphertext payload, public attrs only (`project`, `type`, `vault`, `nid`, …).
3. **0:50 Pending** — Owner decrypts locally, approves. Endorsement entity appears; note gets Lifetime Extension.
4. **1:15 Verify** — Paste entity key, no vault key. `$creator`, `$owner`, hash match.
5. **1:35 Attack** — A–E reject with reasons; F allow; G trusted-unreviewed warning.
6. **2:05 MCP refuse** — `grove_read_note` on injection note → `{allow:false, reason}` only.
7. **2:20 Agents** — Trust tier rises after approvals; fewer reviews for trusted.
8. **2:40 Close** — What it protects / does not (metadata, key holders, chain does not enforce trust).
