import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/nunito";
import { ClientProviders } from "@/components/app/ClientProviders";
import "./globals.css";

export const metadata: Metadata = { title: "BriefMint", description: "Private project notes to wallet-owned public opportunities." };

// Applies the saved or system theme before first paint (no flash).
const THEME_SCRIPT = `try{var t=localStorage.getItem("bm-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
