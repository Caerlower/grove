import Link from "next/link";
import { HeroParticles } from "@/components/HeroParticles";
import { publicConfig } from "@/lib/config";

export default function LandingPage() {
  return (
    <div className="land">
      <section className="land-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/grove-hero.jpg"
          alt=""
          width={1920}
          height={1080}
          className="land-stage-photo"
          fetchPriority="high"
        />
        <div className="land-stage-veil" aria-hidden />
        <HeroParticles count={18} />

        <header className="land-stage-top">
          <Link href="/" className="land-mark">
            grove<span>.</span>
          </Link>
          <nav className="land-nav" aria-label="Primary">
            <Link href="/app/live">Live</Link>
            <Link href="/app">Vault</Link>
            <Link href="/app/attack">Attacks</Link>
            <Link href="/app/verify">Verify</Link>
          </nav>
        </header>

        <div className="land-stage-mid">
          <div className="land-stage-copy">
            <p className="land-kicker">Arkiv · Tiramisu</p>
            <h1 className="land-title">
              Sealed notes
              <br />
              agents cannot poison.
            </h1>
            <p className="land-lede">
              Agents write ciphertext. You endorse on-chain. Every reader runs
              the same gate before anything counts as memory.
            </p>
            <div className="land-ctas">
              <Link href="/app/live" className="land-btn land-btn-primary">
                Open live playground
              </Link>
              <Link href="/app/attack" className="land-btn land-btn-ghost">
                Attack proofs
              </Link>
            </div>
          </div>
        </div>

        <a href="#how" className="land-scroll">
          How it works
          <span aria-hidden>↓</span>
        </a>
      </section>

      <main className="land-page">
        <section id="how" className="land-section">
          <div className="land-section-inner">
            <p className="land-section-kicker">Flow</p>
            <h2 className="land-section-title">Three checks. One memory.</h2>
            <p className="land-section-lede">
              Grove keeps agent drafts sealed until a human endorses them on
              Tiramisu — then every reader evaluates the same gate.
            </p>

            <ol className="land-flow">
              <li>
                <span>01</span>
                <h3>Write sealed</h3>
                <p>
                  An agent encrypts a draft on Tiramisu. That agent address is
                  forever <code>$creator</code> — not a field anyone can forge
                  later.
                </p>
              </li>
              <li>
                <span>02</span>
                <h3>Human endorses</h3>
                <p>
                  You approve or reject in MetaMask. The decision is bound to
                  the ciphertext hash, so a swap after the fact fails the gate.
                </p>
              </li>
              <li>
                <span>03</span>
                <h3>Readers gate</h3>
                <p>
                  <code>evaluateNote()</code> checks allowlist, handoff, and
                  endorsement before anything is treated as trusted memory.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="land-section land-section-alt">
          <div className="land-section-inner land-split">
            <div>
              <p className="land-section-kicker">Why</p>
              <h2 className="land-section-title">
                Agents invent facts.
                <br />
                You decide what sticks.
              </h2>
            </div>
            <div className="land-points">
              <article>
                <h3>Sealed by default</h3>
                <p>
                  Ciphertext on-chain. No plaintext for an MCP tool to leak
                  until the vault owner endorses.
                </p>
              </article>
              <article>
                <h3>Same gate everywhere</h3>
                <p>
                  Live playground, MCP, and attack board all call the same
                  evaluation path — rejects never return a note body.
                </p>
              </article>
              <article>
                <h3>Proofs you can open</h3>
                <p>
                  Seeded scenarios A–G on Tiramisu. Re-run the gate live and
                  open each entity on the explorer.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="land-section">
          <div className="land-section-inner">
            <div className="land-banner">
              <div>
                <p className="land-section-kicker">App</p>
                <h2 className="land-section-title land-banner-title">
                  You endorse. The gate flips.
                </h2>
                <p className="land-banner-meta">
                  {publicConfig.project || "grove"} ·{" "}
                  {publicConfig.vaultId || "vault"} · Clear Desk
                </p>
              </div>
              <div className="land-banner-actions">
                <Link href="/app/live" className="d-btn d-btn-signal">
                  Enter app
                </Link>
                <Link href="/app/attack" className="d-btn d-btn-line">
                  Attack board
                </Link>
              </div>
            </div>
          </div>
        </section>

        <footer className="land-foot">
          <div className="land-section-inner land-foot-inner">
            <Link href="/" className="app-logo">
              grove<span>.</span>
            </Link>
            <p>MIT · Tiramisu · Arkiv Global Tour Stop</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
