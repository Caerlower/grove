import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ownerFromAccessToken } from "@/lib/demo-oauth";
import { registerGroveMcpTools } from "@/lib/grove-mcp-tools";
import { mcpRequestContext } from "@/lib/mcp-request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Remote MCP at /api/mcp — Streamable HTTP, stateless JSON responses.
 *
 * Uses the Web-standard transport directly. mcp-handler 1.x's Node
 * ServerResponse adapter rejects Buffer chunks on Vercel ("Buffer not
 * supported") and returns empty 500s after Claude OAuth succeeds.
 */

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, content-type, accept, mcp-session-id, mcp-protocol-version",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-expose-headers": "mcp-session-id",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function jsonRpc(
  status: number,
  body: Record<string, unknown>,
): Response {
  return withCors(
    Response.json(body, {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

/** Claude may probe server/discover before initialize; echo id so the client can proceed. */
function handleDiscover(id: unknown, params: unknown): Response {
  const supported = [
    "2025-03-26",
    "2025-06-18",
    "2024-11-05",
  ];
  const requested =
    params &&
    typeof params === "object" &&
    Array.isArray(
      (params as { supportedProtocolVersions?: unknown })
        .supportedProtocolVersions,
    )
      ? (
          params as { supportedProtocolVersions: unknown[] }
        ).supportedProtocolVersions.filter(
          (v): v is string => typeof v === "string",
        )
      : [];

  const protocolVersion =
    requested.find((v) => supported.includes(v)) ?? supported[0];

  return jsonRpc(200, {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "grove", version: "0.1.0" },
    },
  });
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (req.method === "GET" || req.method === "DELETE") {
    return jsonRpc(405, {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "Method not allowed. Grove MCP is stateless Streamable HTTP (POST only).",
      },
      id: null,
    });
  }

  if (req.method !== "POST") {
    return jsonRpc(405, {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpc(400, {
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error" },
      id: null,
    });
  }

  if (
    body &&
    typeof body === "object" &&
    "method" in body &&
    (body as { method: unknown }).method === "server/discover"
  ) {
    const msg = body as { id?: unknown; params?: unknown };
    return handleDiscover(msg.id, msg.params);
  }

  // Ensure Accept satisfies the transport even if a proxy stripped it.
  const headers = new Headers(req.headers);
  const accept = headers.get("accept") ?? "";
  if (
    !accept.includes("application/json") ||
    !accept.includes("text/event-stream")
  ) {
    headers.set("accept", "application/json, text/event-stream");
  }

  const auth = headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : undefined;
  const ownerFromToken = ownerFromAccessToken(bearer) ?? undefined;

  const server = new McpServer({ name: "grove", version: "0.1.0" });
  await registerGroveMcpTools(server as never);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    return await mcpRequestContext.run({ ownerFromToken }, async () => {
      await server.connect(transport);
      const res = await transport.handleRequest(
        new Request(req.url, { method: "POST", headers }),
        { parsedBody: body },
      );
      return withCors(res);
    });
  } catch (e) {
    console.error("[grove mcp]", e);
    return jsonRpc(500, {
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: e instanceof Error ? e.message : String(e),
      },
      id:
        body && typeof body === "object" && "id" in body
          ? (body as { id: unknown }).id ?? null
          : null,
    });
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

export { handle as GET, handle as POST, handle as DELETE, handle as OPTIONS };
