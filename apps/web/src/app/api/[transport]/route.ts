import { createMcpHandler } from "mcp-handler";
import { registerGroveMcpTools } from "@/lib/grove-mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Remote MCP (Streamable HTTP + legacy SSE).
 * Clients connect to:
 *   https://<host>/api/mcp
 * Optional: set MCP_SHARED_SECRET and send Authorization: Bearer <secret>
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

async function handle(req: Request): Promise<Response> {
  const secret = process.env.MCP_SHARED_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (token !== secret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }
  return mcpHandler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
