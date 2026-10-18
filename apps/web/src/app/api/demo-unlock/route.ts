import { NextResponse } from "next/server";

/**
 * Returns the synthetic demo vault key for the seeded Attack/Vault experience.
 * Intentionally public for hackathon judging — real vaults never use this path.
 */
export async function GET() {
  const vaultKey = process.env.DEMO_VAULT_KEY;
  if (!vaultKey) {
    return NextResponse.json(
      {
        error:
          "DEMO_VAULT_KEY not configured. Paste a vault key manually, or set DEMO_VAULT_KEY in apps/web/.env.local",
      },
      { status: 404 },
    );
  }
  return NextResponse.json({
    vaultKey,
    synthetic: true,
    warning:
      "Synthetic demo key only. Anyone with this key can decrypt seeded demo notes.",
  });
}
