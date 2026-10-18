"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { tiramisu } from "@arkiv-network/sdk/chains";

const rpc =
  process.env.NEXT_PUBLIC_ARKIV_RPC_URL ??
  "https://rpc.tiramisu.db-chain.testnet.arkiv.network";

/** WalletConnect Cloud project id — set NEXT_PUBLIC_WC_PROJECT_ID in .env.local */
const projectId =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ||
  "3fbb6ab5d7a5e5b5c8b1f0e0a0c0d0e0";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Suggested",
      wallets: [rainbowWallet, walletConnectWallet, injectedWallet],
    },
  ],
  {
    appName: "Grove",
    projectId,
  },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [tiramisu],
  transports: {
    [tiramisu.id]: http(rpc),
  },
  ssr: true,
});

export { tiramisu };
