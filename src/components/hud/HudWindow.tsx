"use client";
// Floating HUD window over the full-screen city: title bar with accent tick,
// dotted leader, optional actions and a collapse control. Original implementation.
import { useId, useState, type ReactNode } from "react";

interface HudWindowProps {
  title: string;
  hint?: string;
  actions?: ReactNode;
  /** Stays visible when collapsed (e.g. the next-step action). */
  persistent?: ReactNode;
  footer?: ReactNode;
  fill?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function HudWindow({
  title,
  hint,
  actions,
  persistent,
  footer,
  fill = false,
  defaultExpanded = true,
  className,
  children,
}: HudWindowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyId = useId();
  return (
    <section
      className={`hud-window${fill ? " hud-window--fill" : ""}${className ? ` ${className}` : ""}`}
      data-expanded={expanded ? "true" : "false"}
      aria-label={title}
    >
      <span className="hud-window__frame" aria-hidden="true" />
      <header className="hud-window__bar">
        <span className="hud-window__tick" aria-hidden="true" />
        <h2 className="hud-window__title">{title}</h2>
        {hint && <span className="hud-window__hint">{hint}</span>}
        <span className="hud-window__leader" aria-hidden="true" />
        {actions}
        <button
          type="button"
          className="hud-icon-btn"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
          onClick={() => setExpanded((v) => !v)}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className="hud-chevron">
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </header>
      <div id={bodyId} className="hud-window__body" hidden={!expanded}>
        {children}
      </div>
      {persistent && <div className="hud-window__persistent">{persistent}</div>}
      {footer && expanded && <footer className="hud-window__footer">{footer}</footer>}
    </section>
  );
}
