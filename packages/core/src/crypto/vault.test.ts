import { describe, expect, it } from "vitest";
import { generateKey } from "arkiv-encryption";
import {
  blindTagHash,
  decodeVaultKeyMaterial,
  deriveTagIndexKey,
  importVaultKey,
  openNoteContent,
  sealNoteContent,
  shouldSampleForReview,
} from "./vault.js";

describe("vault crypto", () => {
  it("seals and opens a note", async () => {
    const raw = generateKey();
    const key = await importVaultKey(raw);
    const sealed = await sealNoteContent(key, {
      title: "Field note",
      body: "Synthetic builder observation near Mumbai.",
      tags: ["india", "demo"],
      links: ["aabbccddeeff0011"],
    });
    const opened = await openNoteContent(key, sealed);
    expect(opened.title).toBe("Field note");
    expect(opened.tags).toContain("india");
  });

  it("blind tag index is deterministic and case-insensitive", async () => {
    const raw = decodeVaultKeyMaterial(generateKey());
    const indexKey = await deriveTagIndexKey(raw);
    const a = await blindTagHash(indexKey, " Sensitive ");
    const b = await blindTagHash(indexKey, "sensitive");
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it("decodeVaultKeyMaterial accepts hex and base64", () => {
    const hex = "ab".repeat(32);
    expect(decodeVaultKeyMaterial(hex).length).toBe(32);
    const b64 = Buffer.from(hex, "hex").toString("base64");
    expect(decodeVaultKeyMaterial(b64).length).toBe(32);
  });

  it("shouldSampleForReview is deterministic", () => {
    const key =
      "0x00aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(shouldSampleForReview(key, 3)).toBe(true);
    const key2 =
      "0x01aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(shouldSampleForReview(key2, 3)).toBe(false);
  });
});
