import Link from "next/link";
import WalletControls from "../wallet/WalletControls";
import NavLinks from "./NavLinks";
import ThemeToggle from "./ThemeToggle";

// App shell: header, primary nav, wallet controls, theme toggle and footer.
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand" aria-label="BriefMint home">
            <BrandMark />
            <span className="brand-name">
              Brief<span>Mint</span>
            </span>
          </Link>
          <NavLinks />
          <div className="header-actions">
            <WalletControls />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="site-main">
        {children}
      </main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-brand">
            <span className="brand-name">
              Brief<span>Mint</span>
            </span>
            <p>Private notes in, approved public opportunities out. Built at ETHGlobal Mumbai.</p>
          </div>
          <nav aria-label="Footer" className="footer-links">
            <div>
              <h2>Product</h2>
              <Link href="/">City</Link>
              <Link href="/briefs">My briefs</Link>
              <Link href="/opportunities">Opportunities</Link>
            </div>
            <div>
              <h2>Legacy</h2>
              <Link href="/jobs">Jobs</Link>
              <Link href="/merchant">Merchant</Link>
            </div>
          </nav>
          <div className="footer-facts">
            <h2>How it stays honest</h2>
            <ul>
              <li>Compilation uses promotional credits via 0G private inference.</li>
              <li>Advertised budgets are unfunded. BriefMint never holds funds.</li>
              <li>Only fields you approve are published to Arkiv, signed by your wallet.</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="9" fill="var(--brand)" />
      <path d="M10 8h9l4 4v12H10z" fill="#fff" />
      <path d="M19 8v4h4" fill="none" stroke="var(--brand-dark)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13 18.5l2.5 2.5 4.5-5" fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
