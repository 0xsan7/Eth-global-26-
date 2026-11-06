"use client";
// Light/dark theme switch. The pre-paint script in layout.tsx sets the initial value.
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      data-theme-state={theme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("bm-theme", next);
        } catch {
          /* storage blocked: theme still applies for this page */
        }
      }}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          <svg viewBox="0 0 24 24" className="icon-sun">
            <circle cx="12" cy="12" r="4.2" fill="currentColor" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <rect key={a} x="11" y="1.8" width="2" height="3.6" rx="1" fill="currentColor" transform={`rotate(${a} 12 12)`} />
            ))}
          </svg>
          <svg viewBox="0 0 24 24" className="icon-moon">
            <path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.9A7 7 0 0 1 15.5 3.5z" fill="currentColor" />
          </svg>
        </span>
      </span>
    </button>
  );
}
