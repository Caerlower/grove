import { originFromRequest, protectedResourceMetadata } from "@/lib/demo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return Response.json(protectedResourceMetadata(originFromRequest(req)), {
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
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
