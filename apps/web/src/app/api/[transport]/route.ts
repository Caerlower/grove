import { createMcpHandler } from "mcp-handler";
import { registerGroveMcpTools } from "@/lib/grove-mcp-tools";
import { isDemoAccessToken, originFromRequest } from "@/lib/demo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Remote MCP (Streamable HTTP + legacy SSE).
 * URL: https://<host>/api/mcp
 *
 * Claude.ai may run a demo OAuth (DCR) flow against /api/oauth/* —
 * we accept those bearer tokens. Cursor and other clients can call
 * without Authorization (public demo).
 */
const mcpHandler = createMcpHandler(
  (server) => {
    registerGroveMcpTools(server as never);
  },
  {
    serverInfo: {
      name: "grove",
      version: "0.1.0",
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

function bearer(req: Request): string | undefined {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return undefined;
  return auth.slice(7).trim() || undefined;
}

async function handle(req: Request): Promise<Response> {
  const token = bearer(req);
  const secret = process.env.MCP_SHARED_SECRET?.trim();

  // Optional shared secret still works when provided; never 401 without
  // WWW-Authenticate (that breaks Claude into a failed OAuth attempt).
  if (secret && token === secret) {
    return mcpHandler(req);
  }
  if (token && isDemoAccessToken(token)) {
    return mcpHandler(req);
  }
  if (!token) {
    // Authless path for Cursor + Claude's "no auth" probe
    return mcpHandler(req);
  }

  // Unknown bearer — challenge with PRM so Claude can complete demo OAuth
  const origin = originFromRequest(req);
  return new Response(JSON.stringify({ error: "invalid_token" }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${origin}/.well-known/oauth-protected-resource/api/mcp"`,
      "access-control-allow-origin": "*",
    },
  });
}

export { handle as GET, handle as POST, handle as DELETE };
