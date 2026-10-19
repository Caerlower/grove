import { getAddress, isAddress } from "viem";
import {
  getClient,
  issueAuthCode,
  redirectUriAllowed,
} from "@/lib/demo-oauth";
import { setBoundMcpOwner } from "@/lib/mcp-bound-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function complete(opts: {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  ownerAddress?: string;
}) {
  const client = getClient(opts.clientId);
  if (!client) {
    return Response.json(
      { error: "invalid_client", error_description: "Unknown client_id" },
      { status: 400 },
    );
  }
  if (!redirectUriAllowed(client, opts.redirectUri)) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri not allowed",
      },
      { status: 400 },
    );
  }

  let owner: string | undefined;
  if (opts.ownerAddress && isAddress(opts.ownerAddress)) {
    owner = getAddress(opts.ownerAddress);
    try {
      setBoundMcpOwner(owner);
    } catch {
      /* non-fatal */
    }
  }

  const code = issueAuthCode({
    clientId: opts.clientId,
    redirectUri: opts.redirectUri,
    codeChallenge: opts.codeChallenge,
    codeChallengeMethod: opts.codeChallengeMethod,
    ownerAddress: owner,
  });
  const next = new URL(opts.redirectUri);
  next.searchParams.set("code", code);
  if (opts.state) next.searchParams.set("state", opts.state);
  return next;
}

/** Consent UI — connect wallet so MCP writes default to that owner. */
export function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge") ?? undefined;
  const codeChallengeMethod =
    url.searchParams.get("code_challenge_method") ?? undefined;
  const ownerParam = url.searchParams.get("owner") ?? undefined;
  const approved = url.searchParams.get("approved") === "1";

  // After consent (with or without wallet)
  if (approved) {
    const next = complete({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      ownerAddress:
        ownerParam && isAddress(ownerParam) ? ownerParam : undefined,
    });
    if (next instanceof Response) return next;
    return Response.redirect(next.toString(), 302);
  }

  const client = getClient(clientId);
  if (!client) {
    return Response.json(
      { error: "invalid_client", error_description: "Unknown client_id" },
      { status: 400 },
    );
  }
  if (!redirectUriAllowed(client, redirectUri)) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri not allowed",
      },
      { status: 400 },
    );
  }

  const qsJson = JSON.stringify(url.searchParams.toString());
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Grove MCP · Approve</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; min-height: 100vh;
      display: grid; place-items: center; background: #f4f1ea; color: #1a1a1a; }
    main { width: min(28rem, calc(100% - 2rem)); background: #fff; border: 1px solid #ddd;
      border-radius: 1rem; padding: 1.5rem; box-shadow: 0 12px 40px rgba(0,0,0,.06); }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    p { margin: 0 0 1rem; color: #555; line-height: 1.45; font-size: .95rem; }
    button { appearance: none; border: 0; border-radius: .75rem; padding: .75rem 1rem;
      font-weight: 600; cursor: pointer; width: 100%; }
    .primary { background: #1a1a1a; color: #fff; }
    .ghost { background: transparent; color: #555; margin-top: .5rem; text-decoration: underline; }
    #err { color: #b42318; font-size: .85rem; margin-top: .75rem; display: none; }
  </style>
</head>
<body>
  <main>
    <h1>Connect wallet for Grove MCP</h1>
    <p>
      Claude will write sealed notes owned by this wallet. You endorse later in
      Grove — you should not need to paste an address into the chat.
    </p>
    <button class="primary" id="connect" type="button">Connect wallet &amp; approve</button>
    <button class="ghost" id="skip" type="button">Continue without wallet</button>
    <p id="err"></p>
  </main>
  <script>
    const params = new URLSearchParams(${qsJson});
    const err = document.getElementById("err");
    function go(owner) {
      if (owner) params.set("owner", owner);
      params.set("approved", "1");
      location.replace("/api/oauth/authorize?" + params.toString());
    }
    document.getElementById("skip").onclick = () => go();
    document.getElementById("connect").onclick = async () => {
      err.style.display = "none";
      try {
        const eth = window.ethereum;
        if (!eth) throw new Error("No browser wallet found. Install MetaMask or use Connect MCP in Grove first, then reconnect Claude.");
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        if (!accounts?.[0]) throw new Error("No account returned");
        go(accounts[0]);
      } catch (e) {
        err.textContent = e?.message || String(e);
        err.style.display = "block";
      }
    };
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
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
