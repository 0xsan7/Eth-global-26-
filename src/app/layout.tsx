import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "@fontsource-variable/inter";
import { ClientProviders } from "@/components/app/ClientProviders";
import "./globals.css";

export const metadata: Metadata = { title: "BriefMint", description: "Private project notes to wallet-owned public opportunities." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
