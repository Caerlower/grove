export const publicConfig = {
  rpcUrl:
    process.env.NEXT_PUBLIC_ARKIV_RPC_URL ??
    "https://rpc.tiramisu.db-chain.testnet.arkiv.network",
  wsUrl:
    process.env.NEXT_PUBLIC_ARKIV_WS_URL ??
    "wss://rpc.tiramisu.db-chain.testnet.arkiv.network",
  apiKey: process.env.NEXT_PUBLIC_ARKIV_API_KEY ?? "",
  project: process.env.NEXT_PUBLIC_PROJECT_VALUE ?? "",
  vaultId: process.env.NEXT_PUBLIC_VAULT_ID ?? "",
  ownerAddress: process.env.NEXT_PUBLIC_OWNER_ADDRESS ?? "",
  agentAAddress: process.env.NEXT_PUBLIC_AGENT_A_ADDRESS ?? "",
  explorer: "https://tiramisu.explorer.arkiv.network",
  demoVaultKey: process.env.NEXT_PUBLIC_DEMO_VAULT_KEY ?? "",
};

export function groveCfg() {
  return {
    rpcUrl: publicConfig.rpcUrl,
    wsUrl: publicConfig.wsUrl,
    project: publicConfig.project,
    vaultId: publicConfig.vaultId,
    ownerAddress: publicConfig.ownerAddress,
  };
}
