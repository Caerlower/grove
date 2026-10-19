"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "@/components/ConnectWallet";

const links = [
  { href: "/app/live", label: "Live" },
  { href: "/app/mcp", label: "MCP" },
  { href: "/app", label: "Vault", exact: true, hash: "#constellation" },
  { href: "/app/pending", label: "Pending" },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/verify", label: "Verify" },
  { href: "/app/attack", label: "Attacks" },
];

export function AppNav() {
  const path = usePathname();
  return (
    <header className="app-top">
      <div className="app-bar">
        <Link href="/" className="app-logo">
          grove<span>.</span>
        </Link>

        <nav className="app-bar-links" aria-label="App">
          {links.map((l) => {
            const href = "hash" in l && l.hash ? `${l.href}${l.hash}` : l.href;
            const active = l.exact
              ? path === l.href
              : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="focus-ring"
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-bar-wallet">
          <ConnectWallet compact pill />
        </div>
      </div>
    </header>
  );
}
