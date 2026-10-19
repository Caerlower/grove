import "server-only";
import { z } from "zod";
import {
  computeTrustTier,
  createGrovePublicClient,
  fetchAllEndorsements,
  fetchAllowlist,
  fetchNotesByCreator,
  writeNoteAsAgent,
} from "@grove/core";
import { getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  requireAgentKey,
  requireDemoVaultKey,
  serverCfg,
} from "@/lib/server-grove";
import { gatedReadNote, searchNotes } from "@/lib/mcp-reader";
import { GROVE_MCP_HELP } from "@/lib/grove-mcp-help";

type ToolServer = {
  tool: (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => Promise<{
      content: Array<{ type: "text"; text: string }>;
    }>,
  ) => void;
};

function mcpEnv() {
  return {
    cfg: serverCfg(),
    vaultKeyRaw: requireDemoVaultKey(),
    agentPrivateKey: requireAgentKey() as Hex,
    strict:
      process.env.GROVE_STRICT === "1" || process.env.GROVE_STRICT === "true",
  };
}

/** Register Grove tools on an MCP server (HTTP via mcp-handler). */
export function registerGroveMcpTools(server: ToolServer) {
  // Do not call mcpEnv() at register time — initialize must succeed even if
  // secrets are briefly unavailable; tool calls load env lazily.

  server.tool(
    "grove_help",
    "List every Grove MCP tool with a one-line explanation.",
    {},
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(GROVE_MCP_HELP, null, 2),
        },
      ],
    }),
  );

  server.tool(
    "grove_write_note",
    "Write a sealed draft note into the Grove vault. Ownership is handed to ownerAddress (or the default vault owner). Content stays pending until that wallet endorses.",
    {
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(20_000),
      tags: z.array(z.string()).max(10).optional(),
      links: z.array(z.string()).max(20).optional(),
      ownerAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .optional()
        .describe(
          "Human vault owner who will endorse. Use the user's connected wallet from the Grove Live UI when demoing.",
        ),
    },
    async ({ title, body, tags, links, ownerAddress }) => {
      const env = mcpEnv();
      const cfg = {
        ...env.cfg,
        ownerAddress: ownerAddress
          ? getAddress(ownerAddress)
          : env.cfg.ownerAddress,
      };
      const result = await writeNoteAsAgent({
        rpcUrl: cfg.rpcUrl,
        agentPrivateKey: env.agentPrivateKey,
        cfg,
        vaultKeyRaw: env.vaultKeyRaw,
        content: {
          title,
          body,
          tags: tags ?? [],
          links: links ?? [],
        },
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                nid: result.nid,
                entityKey: result.entityKey,
                status: result.status,
                txHashes: result.txHashes,
                payloadSha256: result.payloadSha256,
                ownerAddress: cfg.ownerAddress,
                endorsePath: `/app/mcp`,
                next: `Tell the user to open Grove → Connect MCP → Approve. The draft appears automatically for ownerAddress ${cfg.ownerAddress} — no nid paste.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "grove_read_note",
    "Read a note by nid through the Grove trust gate. On allow, returns content wrapped in <untrusted_note> tags. On deny, returns only {allow:false, reason} with no body.",
    {
      nid: z.string().min(8).max(32),
    },
    async ({ nid }) => {
      const env = mcpEnv();
      const result = await gatedReadNote({
        cfg: env.cfg,
        vaultKeyRaw: env.vaultKeyRaw,
        strict: env.strict,
        nid,
      });
      if (!result.allow) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ allow: false, reason: result.reason }),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                allow: true,
                wrapped: result.wrapped,
                creator: result.creator,
                owner: result.owner,
                label: result.label,
                expiresAt: result.expiresAt,
                warnings: result.warnings,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "grove_search",
    "Search allowed notes. tag matches decrypted tags; text is a client-side substring over decrypted allowed notes only.",
    {
      tag: z.string().optional(),
      text: z.string().optional(),
    },
    async ({ tag, text }) => {
      const env = mcpEnv();
      const results = await searchNotes({
        cfg: env.cfg,
        vaultKeyRaw: env.vaultKeyRaw,
        strict: env.strict,
        tag,
        text,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ results }, null, 2) }],
      };
    },
  );

  server.tool(
    "grove_my_status",
    "This agent's notes with review state, trust tier and stats.",
    {},
    async () => {
      const env = mcpEnv();
      const account = privateKeyToAccount(env.agentPrivateKey);
      const publicClient = createGrovePublicClient(env.cfg.rpcUrl);
      const notes = await fetchNotesByCreator(
        publicClient,
        env.cfg,
        account.address,
      );
      const endorsements = await fetchAllEndorsements(publicClient, env.cfg);
      const stats = computeTrustTier(account.address, endorsements);
      const mine = notes.map((n) => {
        const related = endorsements.filter((e) => e.nid === n.nid);
        const rejected = related.some((e) => e.decision === "reject");
        const approved = related.some((e) => e.decision === "approve");
        return {
          nid: n.nid,
          key: n.key,
          owner: n.owner,
          handoffComplete:
            getAddress(n.owner) === getAddress(env.cfg.ownerAddress),
          review: rejected ? "rejected" : approved ? "approved" : "pending",
        };
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                agent: account.address,
                trust: stats,
                notes: mine,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "grove_trust_report",
    "Per-agent trust tier and stats for everyone on the allowlist.",
    {},
    async () => {
      const env = mcpEnv();
      const publicClient = createGrovePublicClient(env.cfg.rpcUrl);
      const allow = await fetchAllowlist(publicClient, env.cfg);
      const endorsements = await fetchAllEndorsements(publicClient, env.cfg);
      const report = allow.map((a) => ({
        addr: a.addr,
        label: a.label,
        ...computeTrustTier(a.addr, endorsements),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ report }, null, 2) }],
      };
    },
  );
}
