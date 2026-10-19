import {
  exchangeCode,
  getClient,
  refreshAccessToken,
} from "@/lib/demo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function basicClient(req: Request): { id?: string; secret?: string } {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Basic ")) return {};
  try {
    const decoded = atob(auth.slice(6));
    const i = decoded.indexOf(":");
    if (i < 0) return {};
    return { id: decoded.slice(0, i), secret: decoded.slice(i + 1) };
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  let params: URLSearchParams;
  if (ct.includes("application/json")) {
    const json = (await req.json()) as Record<string, string>;
    params = new URLSearchParams(json);
  } else {
    params = new URLSearchParams(await req.text());
  }

  const basic = basicClient(req);
  const clientId = params.get("client_id") ?? basic.id ?? "";
  const clientSecret = params.get("client_secret") ?? basic.secret ?? "";
  const grant = params.get("grant_type") ?? "";

  const client = getClient(clientId);
  if (!client || (clientSecret && client.clientSecret !== clientSecret)) {
    // Public clients may omit secret; still require known client_id
    if (!client) {
      return Response.json(
        { error: "invalid_client" },
        { status: 401, headers: { "access-control-allow-origin": "*" } },
      );
    }
  }

  if (grant === "authorization_code") {
    const code = params.get("code") ?? "";
    const redirectUri = params.get("redirect_uri") ?? "";
    const codeVerifier = params.get("code_verifier") ?? undefined;
    const token = exchangeCode({
      code,
      clientId,
      redirectUri,
      codeVerifier,
    });
    if (!token) {
      return Response.json(
        { error: "invalid_grant" },
        { status: 400, headers: { "access-control-allow-origin": "*" } },
      );
    }
    return Response.json(token, {
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
    });
  }

  if (grant === "refresh_token") {
    const refresh = params.get("refresh_token") ?? "";
    const token = refreshAccessToken(refresh, clientId);
    if (!token) {
      return Response.json(
        { error: "invalid_grant" },
        { status: 400, headers: { "access-control-allow-origin": "*" } },
      );
    }
    return Response.json(token, {
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
    });
  }

  return Response.json(
    { error: "unsupported_grant_type" },
    { status: 400, headers: { "access-control-allow-origin": "*" } },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "*",
    },
  });
}
