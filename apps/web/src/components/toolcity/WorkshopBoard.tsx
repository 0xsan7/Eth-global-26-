import {
  ArrowRight,
  Check,
  Command,
  Languages,
  Plane,
  Radio,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import HudButton from "@/components/hud/HudButton";
import "@/components/ui/8bit/styles/retro.css";
import { cn } from "@/lib/utils";
import { TERMINAL_WORKSHOPS, WORKSHOP, type WorkshopListing } from "@/lib/tool-city-demo";

export interface WorkshopBoardProps {
  mode: "page" | "dialog";
  onEnter: (workshop: WorkshopListing) => void;
  onBack?: () => void;
  onClose?: () => void;
}

function WorkshopRow({
  workshop,
  onEnter,
}: {
  workshop: WorkshopListing;
  onEnter: () => void;
}) {
  const disabled = !workshop.supported;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onEnter}
      className={cn(
        "airport-destination group relative grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 overflow-hidden border border-white/10 bg-white/[0.035] px-3 py-2 text-left",
        disabled && "opacity-45",
      )}
    >
      <span className="airport-destination-code retro" aria-hidden="true">
        {workshop.code}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="retro truncate text-[10px] text-white">
            {workshop.title}
          </span>
          <Languages className="size-3 shrink-0 text-sky-200/65" aria-hidden="true" />
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[9px] text-slate-400">
          <span>{workshop.pairLabel}</span>
          <span aria-hidden="true">•</span>
          <span>{workshop.priceLabel}</span>
          <span aria-hidden="true">•</span>
          <span className={workshop.freshness === "fresh" ? "text-emerald-300/80" : "text-amber-300/70"}>
            Arkiv {workshop.freshness}
          </span>
        </span>
      </span>
      <span className="flex min-w-[6.4rem] items-center justify-end gap-2">
        {disabled ? (
          <span className="retro text-[8px] text-slate-500">BAY CLOSED</span>
        ) : (
          <>
            <span className="retro text-right text-[8px] leading-4 text-amber-100">
              OPEN<br />WORKSHOP
            </span>
            <ArrowRight
              className="size-3 text-white/35 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </>
        )}
      </span>
    </button>
  );
}

function Board({
  mode,
  onEnter,
  onBack,
  onClose,
}: WorkshopBoardProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return TERMINAL_WORKSHOPS;
    return TERMINAL_WORKSHOPS.filter(
      (workshop) =>
        workshop.title.toLowerCase().includes(needle) ||
        workshop.description.toLowerCase().includes(needle) ||
        workshop.code.toLowerCase().includes(needle),
    );
  }, [query]);

  return (
    <div className="airport-board flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden border border-sky-100/20 bg-[#081923] p-0 text-white shadow-2xl">
      <div className="airport-board-header relative shrink-0 overflow-hidden border-b border-white/10 px-5 pb-4 pt-5 sm:px-6">
        <div className="relative z-10 flex items-start justify-between gap-5 pr-8">
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <span className="airport-terminal-code retro">TCX</span>
              <span className="retro text-[8px] tracking-[0.24em] text-sky-100/55">
                TERMINAL 01 · WORKSHOP TRANSIT
              </span>
            </div>
            <h2 className="flex items-center gap-2.5 text-left">
              <span className="airport-icon-grid">
                <Languages className="size-5" aria-hidden="true" />
              </span>
              <span className="retro text-sm text-amber-200 sm:text-base">
                Choose a workshop
              </span>
            </h2>
            <p className="max-w-xl text-xs leading-5 text-sky-100/55">
              One fixed private-translation listing is live in this demo:
              English → Hindi, one test USDT, source-aligned review and an
              editable saved result.
            </p>
          </div>
          <span className="hidden items-center gap-2 border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-2 sm:flex">
            <Radio className="size-3.5 text-emerald-300" aria-hidden="true" />
            <span className="retro text-[7px] leading-3 text-emerald-200">
              ARKIV<br />FRESH
            </span>
          </span>
          {mode === "dialog" ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close workshop terminal"
              title="Close"
              className="absolute right-0 top-0 grid size-7 place-items-center border border-white/10 text-sky-100/70 transition-colors hover:border-amber-300/50 hover:text-amber-200"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border border-white/10 bg-black/20 px-3 py-2.5">
          <div className="min-w-0">
            <span className="retro block text-[7px] text-sky-200/45">CURRENT CITY</span>
            <span className="retro mt-1 block truncate text-[9px] text-white">
              DEMO CITY
            </span>
          </div>
          <div className="airport-route-line flex items-center gap-2 text-amber-300" aria-hidden="true">
            <span />
            <Plane className="size-4" />
            <span />
          </div>
          <div className="min-w-0 text-right">
            <span className="retro block text-[7px] text-sky-200/45">DESTINATION</span>
            <span className="retro mt-1 block text-[9px] text-amber-200">
              SELECT WORKSHOP
            </span>
          </div>
        </div>
      </div>

      <div className="airport-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 pr-3 sm:p-5 sm:pr-4">
        <label className="airport-search relative block min-w-0 shrink-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sky-200/55"
            aria-hidden="true"
          />
          <span className="sr-only">Search workshops</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="SEARCH WORKSHOPS OR LANGUAGES"
            className="retro w-full border border-white/10 bg-black/20 py-3 pl-10 pr-3 text-[9px] text-white outline-none placeholder:text-slate-500 focus:border-amber-300/60"
          />
        </label>

        <div className="flex flex-col gap-2">
          {filtered.length > 0 ? (
            filtered.map((workshop) => (
              <WorkshopRow
                key={workshop.id}
                workshop={workshop}
                onEnter={() => onEnter(workshop)}
              />
            ))
          ) : (
            <p className="retro border border-white/10 p-5 text-center text-[9px] text-sky-100/55">
              No workshop matches “{query}”.
            </p>
          )}
        </div>

        <div className="grid gap-2 border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center border border-emerald-300/25 bg-emerald-300/10 text-emerald-300">
              <Check className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="retro text-[8px] text-white">FIXED TERMS</p>
              <p className="mt-1 text-[10px] leading-4 text-sky-100/55">
                1.00 test USDT · 250 words max · 2 dispatch attempts. Terms hash
                is frozen before purchase.
              </p>
            </div>
          </div>
          <div className="grid gap-1.5 border-t border-white/10 pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <span className="retro text-[7px] text-sky-200/45">STACK</span>
            <span className="retro text-[9px] text-sky-100/80">
              ARKIV · listing + discovery
            </span>
            <span className="retro text-[9px] text-sky-100/80">
              WHITECHAIN · test-USDT checkout
            </span>
            <span className="retro text-[9px] text-sky-100/80">
              0G · private inference
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <span className="retro text-[8px] text-sky-200/55">
            {WORKSHOP.owner} · listing {WORKSHOP.freshness}
          </span>
          <div className="flex gap-2">
            {mode === "page" && onBack ? (
              <HudButton type="button" variant="outline" size="sm" onClick={onBack}>
                Back
              </HudButton>
            ) : null}
            {mode === "dialog" && onClose ? (
              <HudButton type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </HudButton>
            ) : null}
            <HudButton
              type="button"
              size="sm"
              sound={false}
              onClick={() => onEnter(WORKSHOP)}
            >
              <Command className="mr-1 size-3" aria-hidden="true" />
              Enter the city
            </HudButton>
          </div>
        </div>
      </div>

      <div className="airport-runway-bar shrink-0" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export default function WorkshopBoard(props: WorkshopBoardProps) {
  if (props.mode === "dialog") {
    return (
      <div className="tc-board-overlay" role="presentation" onMouseDown={props.onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Workshop terminal"
          className="w-full max-w-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Board {...props} />
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-city-overlay" aria-hidden="true" />
      <div className="hud-scanline pointer-events-none absolute inset-0 z-[1]" />
      <div className="relative z-10 w-full max-w-2xl">
        <Board {...props} />
      </div>
    </div>
  );
}
