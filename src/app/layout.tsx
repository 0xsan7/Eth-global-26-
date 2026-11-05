import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClientProviders } from "@/components/app/ClientProviders";
import "./globals.css";

export const metadata: Metadata = { title: "Tool City", description: "Private translation workshops, paid jobs and recoverable results." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><ClientProviders>{children}</ClientProviders></body></html>;
}
