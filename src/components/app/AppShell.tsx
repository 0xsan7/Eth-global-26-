import Link from "next/link";
import WalletControls from "../wallet/WalletControls";

// App shell: header + nav + wallet controls — Agent B owned.
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid #ddd",
        }}
      >
        <Link href="/" style={{ fontWeight: 700, textDecoration: "none" }}>
          BriefMint
        </Link>
        <nav aria-label="Primary" style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/">City</Link>
          <Link href="/briefs">My Briefs</Link>
          <Link href="/opportunities">Opportunities</Link>
          <Link href="/jobs">Jobs (legacy)</Link>
          <Link href="/merchant">Merchant (legacy)</Link>
        </nav>
        <div style={{ marginLeft: "auto" }}>
          <WalletControls />
        </div>
      </header>
      <main style={{ padding: "1rem", maxWidth: "60rem", margin: "0 auto" }}>{children}</main>
    </div>
  );
}
