import "server-only";
import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Stateless demo OAuth for Claude.ai on Vercel (signed client_id / codes / tokens).
 * Not production identity — only completes Claude's connector registration flow.
 */

type ClientPayload = {
  r: string[];
  s: string;
};

type CodePayload = {
  cid: string;
  ru: string;
  cc?: string;
  cm?: string;
  exp: number;
};

type TokenPayload = {
  cid: string;
  typ: "at" | "rt";
  exp: number;
};

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

function seal(obj: unknown): string {
  const raw = b64url(JSON.stringify(obj));
  return `${raw}.${sign(raw)}`;
}

function open<T>(token: string): T | null {
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
    return JSON.parse(fromB64url(raw).toString("utf8")) as T;
  } catch {
    return null;
  }
}

const DEFAULT_REDIRECTS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
];

export function originFromRequest(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: [
      "none",
      "client_secret_post",
      "client_secret_basic",
    ],
    scopes_supported: ["grove"],
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["grove"],
  };
}

export type Client = {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
};

export function registerClient(body: {
  redirect_uris?: string[];
  client_name?: string;
  token_endpoint_auth_method?: string;
}): Client {
  const redirectUris = body.redirect_uris?.length
    ? body.redirect_uris
    : DEFAULT_REDIRECTS;
  const clientSecret = randomBytes(24).toString("hex");
  const payload: ClientPayload = { r: redirectUris, s: clientSecret };
  const clientId = `g_${seal(payload)}`;
  return { clientId, clientSecret, redirectUris };
}

export function getClient(clientId: string): Client | null {
  if (!clientId.startsWith("g_")) return null;
  const payload = open<ClientPayload>(clientId.slice(2));
  if (!payload?.r?.length || !payload.s) return null;
  return {
    clientId,
    clientSecret: payload.s,
    redirectUris: payload.r,
  };
}

export function issueAuthCode(opts: {
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}) {
  const payload: CodePayload = {
    cid: opts.clientId,
    ru: opts.redirectUri,
    cc: opts.codeChallenge,
    cm: opts.codeChallengeMethod,
    exp: Date.now() + 10 * 60_000,
  };
  return `c_${seal(payload)}`;
}

function verifyPkce(codeVerifier: string | undefined, entry: CodePayload) {
  if (!entry.cc) return true;
  if (!codeVerifier) return false;
  if (entry.cm === "plain") return codeVerifier === entry.cc;
  const hash = createHash("sha256").update(codeVerifier).digest("base64url");
  return hash === entry.cc;
}

export function exchangeCode(opts: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier?: string;
}) {
  if (!opts.code.startsWith("c_")) return null;
  const entry = open<CodePayload>(opts.code.slice(2));
  if (!entry || entry.exp < Date.now()) return null;
  if (entry.cid !== opts.clientId) return null;
  if (entry.ru !== opts.redirectUri) return null;
  if (!verifyPkce(opts.codeVerifier, entry)) return null;

  const access = seal({
    cid: opts.clientId,
    typ: "at",
    exp: Date.now() + 24 * 60 * 60_000,
  } satisfies TokenPayload);
  const refresh = seal({
    cid: opts.clientId,
    typ: "rt",
    exp: Date.now() + 30 * 24 * 60 * 60_000,
  } satisfies TokenPayload);

  return {
    access_token: `grove_at_${access}`,
    token_type: "bearer",
    expires_in: 86_400,
    refresh_token: `grove_rt_${refresh}`,
    scope: "grove",
  };
}

export function refreshAccessToken(refreshToken: string, clientId: string) {
  if (!refreshToken.startsWith("grove_rt_")) return null;
  const entry = open<TokenPayload>(refreshToken.slice("grove_rt_".length));
  if (!entry || entry.typ !== "rt" || entry.exp < Date.now()) return null;
  if (entry.cid !== clientId) return null;
  const access = seal({
    cid: clientId,
    typ: "at",
    exp: Date.now() + 24 * 60 * 60_000,
  } satisfies TokenPayload);
  return {
    access_token: `grove_at_${access}`,
    token_type: "bearer",
    expires_in: 86_400,
    refresh_token: refreshToken,
    scope: "grove",
  };
}

export function isDemoAccessToken(token: string | undefined): boolean {
  if (!token?.startsWith("grove_at_")) return false;
  const entry = open<TokenPayload>(token.slice("grove_at_".length));
  if (!entry || entry.typ !== "at") return false;
  return entry.exp >= Date.now();
}

export function redirectUriAllowed(client: Client, redirectUri: string) {
  if (client.redirectUris.includes(redirectUri)) return true;
  return (
    redirectUri.startsWith("https://claude.ai/api/mcp/auth_callback") ||
    redirectUri.startsWith("https://claude.com/api/mcp/auth_callback") ||
    redirectUri.startsWith("http://127.0.0.1:") ||
    redirectUri.startsWith("http://localhost:")
  );
}
