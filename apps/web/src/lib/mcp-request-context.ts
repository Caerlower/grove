import { AsyncLocalStorage } from "node:async_hooks";

export type McpRequestContext = {
  /** Owner address baked into the demo OAuth access token, if any. */
  ownerFromToken?: string;
};

export const mcpRequestContext = new AsyncLocalStorage<McpRequestContext>();

export function getMcpRequestOwner(): string | undefined {
  return mcpRequestContext.getStore()?.ownerFromToken;
}
