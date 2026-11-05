"use client";

import type { ToolCityPayProps } from "@/lib/shared/domain";

// Teammate owns implementation after bootstrap. This never initiates a transfer.
export function ToolCityPay({ job }: ToolCityPayProps) {
  return <section aria-label="Checkout"><p>Job {job.id}</p><button disabled>Checkout integration pending</button></section>;
}
