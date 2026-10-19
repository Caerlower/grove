import { createMcpHandler } from "mcp-handler";
import { registerGroveMcpTools } from "@/lib/grove-mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Remote MCP — Streamable HTTP only at /api/mcp.
 * SSE is disabled (needs Redis on Vercel and breaks Claude after OAuth).
 * Auth is optional: Claude demo OAuth tokens and bare requests both work.
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
    verboseLogs: true,
    disableSse: true,
  },
);

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set(
    "access-control-allow-headers",
    "authorization, content-type, accept, mcp-session-id, mcp-protocol-version",
  );
  headers.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  headers.set("access-control-expose-headers", "mcp-session-id");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  try {
    // Never 401 here — Claude finishes OAuth then POSTs initialize with a
    // bearer. Rejecting that token surfaces as "authorized but error connecting".
    const res = await mcpHandler(req);
    return withCors(res);
  } catch (e) {
    console.error("[grove mcp]", e);
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: e instanceof Error ? e.message : String(e),
          },
          id: null,
        },
        { status: 500 },
      ),
    );
  }
}

export { handle as GET, handle as POST, handle as DELETE, handle as OPTIONS };
