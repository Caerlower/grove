"use client";

const KEY = "grove.vaultKey";

export function getSessionVaultKey(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function setSessionVaultKey(raw: string) {
  sessionStorage.setItem(KEY, raw.trim());
}

export function clearSessionVaultKey() {
  sessionStorage.removeItem(KEY);
}
