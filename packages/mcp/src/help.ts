/** One-line catalog for grove_help (stdio + remote MCP). */
export const GROVE_MCP_HELP = {
  overview:
    "Grove: agents write sealed notes on Arkiv; a human wallet endorses; readers run evaluateNote() before trusting content.",
  tools: [
    {
      name: "grove_help",
      line: "List every Grove MCP tool with a one-line explanation.",
    },
    {
      name: "grove_write_note",
      line: "Seal + create a note, hand ownership to ownerAddress (or default vault owner); stays pending until endorsed.",
    },
    {
      name: "grove_read_note",
      line: "Read by nid through the trust gate; on allow returns <untrusted_note> wrapped content, else {allow:false, reason}.",
    },
    {
      name: "grove_search",
      line: "Search allowed notes by tag and/or text substring (decrypts only notes that pass the gate).",
    },
    {
      name: "grove_my_status",
      line: "This agent’s notes plus trust tier and pending/approved/rejected review state.",
    },
    {
      name: "grove_trust_report",
      line: "Trust tier and endorsement stats for every allowlisted agent in the vault.",
    },
  ],
  write_tip:
    "Omit ownerAddress — server uses the wallet bound in Grove Connect MCP / OAuth consent. Approve under Connect MCP → Approve.",
  clients:
    "Remote URL: https://<host>/api/mcp — Claude.ai connectors, Cursor, Claude Desktop (mcp-remote), ChatGPT where MCP is enabled.",
} as const;
