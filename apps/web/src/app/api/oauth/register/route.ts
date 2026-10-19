import { registerClient } from "@/lib/demo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    redirect_uris?: string[];
    client_name?: string;
    token_endpoint_auth_method?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body ok */
  }
  const client = registerClient(body);
  return Response.json(
    {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method:
        body.token_endpoint_auth_method ?? "client_secret_post",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: body.client_name ?? "Grove MCP client",
    },
    {
      status: 201,
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
    },
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
