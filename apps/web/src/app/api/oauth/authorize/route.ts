import {
  getClient,
  issueAuthCode,
  redirectUriAllowed,
} from "@/lib/demo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Auto-approve demo consent — redirects back to Claude with ?code= */
export function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge") ?? undefined;
  const codeChallengeMethod =
    url.searchParams.get("code_challenge_method") ?? undefined;

  const client = getClient(clientId);
  if (!client) {
    return Response.json(
      { error: "invalid_client", error_description: "Unknown client_id" },
      { status: 400 },
    );
  }
  if (!redirectUriAllowed(client, redirectUri)) {
    return Response.json(
      { error: "invalid_request", error_description: "redirect_uri not allowed" },
      { status: 400 },
    );
  }

  const code = issueAuthCode({
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
  });
  const next = new URL(redirectUri);
  next.searchParams.set("code", code);
  if (state) next.searchParams.set("state", state);

  // Landing page so humans see what happened during demo OAuth
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Grove MCP</title>
<meta http-equiv="refresh" content="0;url=${next.toString().replace(/"/g, "&quot;")}"/>
</head><body style="font-family:system-ui;padding:2rem">
<p>Grove demo OAuth approved. Returning to Claude…</p>
<p><a href="${next.toString().replace(/"/g, "&quot;")}">Continue</a></p>
</body></html>`;

  return new Response(html, {
    status: 302,
    headers: {
      Location: next.toString(),
      "content-type": "text/html; charset=utf-8",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "*",
    },
  });
}
