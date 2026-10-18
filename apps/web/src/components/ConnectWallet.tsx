"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useArkivWallet } from "@/lib/useArkivWallet";

/** RainbowKit connect — pill style for nav, filled style for page sheets. */
export function ConnectWallet({
  compact = false,
  pill = false,
}: {
  compact?: boolean;
  pill?: boolean;
}) {
  const { onTiramisu, ensureTiramisu, isConnected } = useArkivWallet();
  const inNav = compact || pill;

  return (
    <div className={inNav ? "rk-wrap rk-wrap-compact" : "rk-wrap"}>
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          mounted,
        }) => {
          const ready = mounted;
          const btn = inNav ? "nav-wallet" : "d-btn d-btn-fill";
          const cta = inNav ? "nav-wallet nav-wallet-cta" : "d-btn d-btn-fill";
          const line = inNav ? "nav-wallet" : "d-btn d-btn-line";

          if (!ready) {
            return (
              <button type="button" className={btn} disabled>
                …
              </button>
            );
          }

          if (!account) {
            return (
              <button type="button" className={cta} onClick={openConnectModal}>
                {inNav ? "Connect" : "Connect wallet"}
              </button>
            );
          }

          return (
            <div className={inNav ? "nav-wallet-row" : "sheet-actions"}>
              {chain && !chain.unsupported && !inNav && (
                <button
                  type="button"
                  className={line}
                  onClick={openChainModal}
                >
                  {chain.name}
                </button>
              )}
              <button
                type="button"
                className={inNav ? "nav-wallet" : "d-btn d-btn-line"}
                onClick={openAccountModal}
              >
                {account.displayName}
              </button>
            </div>
          );
        }}
      </ConnectButton.Custom>
      {isConnected && !onTiramisu && (
        <button
          type="button"
          className={inNav ? "nav-wallet nav-wallet-warn" : "d-btn d-btn-line"}
          onClick={() => void ensureTiramisu()}
        >
          {inNav ? "Tiramisu" : "Switch to Tiramisu"}
        </button>
      )}
    </div>
  );
}
