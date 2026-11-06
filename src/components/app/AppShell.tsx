import Link from "next/link";
import WalletControls from "../wallet/WalletControls";

// App shell: slim dark HUD header + page slot. The "More" menu holds the
// legacy flows so the main nav stays on the real BriefMint journey.
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hud-shell">
      <header className="hud-header">
        <Link href="/" className="hud-wordmark">
          BriefMint
        </Link>
        <nav aria-label="Primary" className="hud-nav">
          <Link href="/">City</Link>
          <Link href="/briefs">My Briefs</Link>
          <Link href="/opportunities">Opportunities</Link>
          <details className="hud-more">
            <summary>More</summary>
            <div className="hud-more-menu" role="menu">
              <Link href="/jobs" role="menuitem">Jobs (legacy)</Link>
              <Link href="/merchant" role="menuitem">Merchant (legacy)</Link>
            </div>
          </details>
        </nav>
        <div className="hud-wallet">
          <WalletControls />
        </div>
      </header>
      <main className="hud-main">{children}</main>
    </div>
  );
}
