"use client";

import { useMemo } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { createWalletClient as createArkivWalletClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { custom } from "viem";

export function useArkivWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { data: wagmiWalletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const arkiv = useMemo(() => {
    if (!wagmiWalletClient || !address) return null;
    return createArkivWalletClient({
      chain: tiramisu,
      transport: custom(wagmiWalletClient.transport),
      account: address,
    });
  }, [wagmiWalletClient, address]);

  async function ensureTiramisu() {
    if (chainId === tiramisu.id) return;
    await switchChainAsync({ chainId: tiramisu.id });
  }

  return {
    address,
    isConnected,
    chainId,
    onTiramisu: chainId === tiramisu.id,
    arkiv,
    ensureTiramisu,
  };
}
