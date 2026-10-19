import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getAddress, isAddress } from "viem";

/**
 * Demo-wide "active endorse wallet" for MCP writes.
 * Set from Connect MCP when the user connects; grove_write_note uses it
 * when ownerAddress is omitted. Durable enough for Vercel via /tmp + memory.
 */

type Bound = { a: string; exp: number };

const FILE = "/tmp/grove-mcp-bound-owner.json";
const TTL_MS = 7 * 24 * 60 * 60_000;

declare global {
  // eslint-disable-next-line no-var
  var __groveMcpBoundOwner: string | undefined;
}

function hmacSecret() {
  return (
    process.env.MCP_OAUTH_HMAC_SECRET?.trim() ||
    process.env.ARKIV_API_KEY?.trim() ||
    "grove-demo-oauth-dev-only"
  );
}

function b64url(data: string | Buffer) {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(raw: string) {
  return createHmac("sha256", hmacSecret()).update(raw).digest("base64url");
}

function seal(obj: Bound): string {
  const raw = b64url(JSON.stringify(obj));
  return `${raw}.${sign(raw)}`;
}

function open(token: string): Bound | null {
  const [raw, sig] = token.split(".");
  if (!raw || !sig) return null;
  const expect = sign(raw);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(fromB64url(raw).toString("utf8")) as Bound;
  } catch {
    return null;
  }
}

function readSealed(): string | undefined {
  if (globalThis.__groveMcpBoundOwner) return globalThis.__groveMcpBoundOwner;
  try {
    if (existsSync(FILE)) return readFileSync(FILE, "utf8").trim();
  } catch {
    /* ignore */
  }
  return undefined;
}

export function setBoundMcpOwner(address: string): string {
  if (!isAddress(address)) throw new Error("Invalid address");
  const checksummed = getAddress(address);
  const sealed = seal({ a: checksummed, exp: Date.now() + TTL_MS });
  globalThis.__groveMcpBoundOwner = sealed;
  try {
    writeFileSync(FILE, sealed, "utf8");
  } catch {
    /* /tmp may be unavailable in some runtimes — memory still works */
  }
  return checksummed;
}

export function getBoundMcpOwner(): string | null {
  const sealed = readSealed();
  if (!sealed) return null;
  const bound = open(sealed);
  if (!bound || bound.exp < Date.now() || !isAddress(bound.a)) return null;
  return getAddress(bound.a);
}
