/** MetaMask Blockaid cannot be suppressed by the dapp — set expectations. */
export function WalletTxHint() {
  return (
    <aside className="wallet-tx-hint" role="note">
      <p className="wallet-tx-hint-title">MetaMask may show “High-risk request”</p>
      <p className="wallet-tx-hint-copy">
        Grove writes go to Arkiv’s protocol address{" "}
        <code className="font-mono">0x4400…0044</code> on Tiramisu. MetaMask’s
        scanner often flags unknown protocol contracts — that is expected, not a
        drain. Check the acknowledge box, then Confirm. Value stays 0.
      </p>
    </aside>
  );
}
