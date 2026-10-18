import {
  CONTENT_TYPE,
  decryptPayload,
  encryptPayload,
  generateKey,
  importKey,
} from "arkiv-encryption";
import {
  SEALED_CONTENT_TYPE,
  TAG_HASH_HEX_LEN,
  TAG_INDEX_HKDF_INFO,
} from "../constants.js";
import type { NoteContent } from "../types.js";

export { CONTENT_TYPE as ARKIV_ENCRYPTED_CONTENT_TYPE, generateKey, importKey };

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto subtle is unavailable in this runtime");
  }
  return subtle;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Convert vault key from env (base64 of 32 raw bytes, or 64-char hex). */
export function decodeVaultKeyMaterial(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return fromHex(trimmed);
  }
  // Prefer atob / Buffer depending on runtime
  let buf: Uint8Array;
  if (typeof Buffer !== "undefined") {
    buf = new Uint8Array(Buffer.from(trimmed, "base64"));
  } else {
    const bin = atob(trimmed);
    buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  }
  if (buf.length !== 32) {
    throw new Error(
      `VAULT_KEY must decode to 32 bytes (got ${buf.length}). Use base64 of 32 random bytes or 64 hex chars.`,
    );
  }
  return buf;
}

export async function importVaultKey(raw: string): Promise<CryptoKey> {
  return importKey(decodeVaultKeyMaterial(raw));
}

export function randomNid(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await getSubtle().digest(
    "SHA-256",
    bytes as BufferSource,
  );
  return toHex(new Uint8Array(digest));
}

export async function deriveTagIndexKey(
  vaultKeyRaw: Uint8Array,
): Promise<Uint8Array> {
  const baseKey = await getSubtle().importKey(
    "raw",
    vaultKeyRaw as BufferSource,
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await getSubtle().deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(TAG_INDEX_HKDF_INFO),
    },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

/** Blind tag hash: hex(HMAC-SHA256(indexKey, lower(trim(tag))))[0..16]. */
export async function blindTagHash(
  indexKey: Uint8Array,
  tag: string,
): Promise<string> {
  const normalized = tag.trim().toLowerCase();
  const key = await getSubtle().importKey(
    "raw",
    indexKey as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await getSubtle().sign(
    "HMAC",
    key,
    new TextEncoder().encode(normalized),
  );
  return toHex(new Uint8Array(sig)).slice(0, TAG_HASH_HEX_LEN);
}

export async function blindTagHashes(
  indexKey: Uint8Array,
  tags: string[],
  max = 3,
): Promise<string[]> {
  const unique = [
    ...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
  ];
  const out: string[] = [];
  for (const t of unique.slice(0, max)) {
    out.push(await blindTagHash(indexKey, t));
  }
  return out;
}

export async function sealNoteContent(
  key: CryptoKey,
  content: NoteContent,
): Promise<Uint8Array> {
  const plaintext = new TextEncoder().encode(JSON.stringify(content));
  return encryptPayload(key, plaintext);
}

export async function openNoteContent(
  key: CryptoKey,
  envelope: Uint8Array,
): Promise<NoteContent> {
  const bytes = await decryptPayload(key, envelope);
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as NoteContent;
  if (typeof parsed.title !== "string" || typeof parsed.body !== "string") {
    throw new Error("Decrypted note content missing title/body");
  }
  return {
    title: parsed.title,
    body: parsed.body,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    links: Array.isArray(parsed.links) ? parsed.links.map(String) : [],
  };
}

export function assertSealedContentType(contentType: string): boolean {
  return contentType === SEALED_CONTENT_TYPE || contentType === CONTENT_TYPE;
}

/** Deterministic sampling for trusted-agent review queue. */
export function shouldSampleForReview(entityKey: string, mod = 3): boolean {
  const hex = entityKey.startsWith("0x") ? entityKey.slice(2) : entityKey;
  const firstByte = parseInt(hex.slice(0, 2), 16);
  if (Number.isNaN(firstByte)) return true;
  return firstByte % mod === 0;
}

export { toHex, fromHex };
