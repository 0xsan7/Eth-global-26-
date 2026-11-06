import "@/components/ui/8bit/styles/retro.css";

export interface LoginScreenProps {
  onConnect: () => void;
  onSeeDemo: () => void;
}

/**
 * The floating entry gate over the mounted demo city. It keeps the reference
 * NPC-dialogue shape but speaks for Tool City: the Curator offers the workshop
 * terminal or a walk through the demo translation district.
 */
export default function LoginScreen({ onConnect, onSeeDemo }: LoginScreenProps) {
  return (
    <div className="login-screen">
      <div className="login-city-overlay" aria-hidden="true" />
      <div className="hud-scanline pointer-events-none absolute inset-0 z-[1]" />

      <div className="login-screen__stage relative z-10 flex w-full max-w-2xl items-end gap-3">
        <svg
          viewBox="0 0 96 128"
          role="img"
          aria-label="The Curator, a pixel-art Tool City workshop keeper holding a rolled document."
          className="login-screen__speaker"
        >
          <ellipse cx="48" cy="119" rx="27" ry="6" fill="#00000066" />
          <rect x="30" y="98" width="10" height="20" fill="#3b2c21" />
          <rect x="56" y="98" width="10" height="20" fill="#3b2c21" />
          <rect x="22" y="58" width="52" height="46" fill="#2f6b55" stroke="#0a141a" strokeWidth="3" />
          <rect x="30" y="66" width="36" height="26" fill="#e8d6b0" opacity="0.16" />
          <rect x="33" y="32" width="30" height="28" fill="#d9a06b" stroke="#0a141a" strokeWidth="3" />
          <rect x="28" y="26" width="40" height="10" fill="#b96e4a" stroke="#0a141a" strokeWidth="3" />
          <rect x="37" y="42" width="6" height="5" fill="#0a141a" />
          <rect x="53" y="42" width="6" height="5" fill="#0a141a" />
          <rect x="43" y="52" width="10" height="3" fill="#0a141a" />
          <rect x="18" y="64" width="8" height="28" fill="#d9a06b" stroke="#0a141a" strokeWidth="3" />
          <rect x="70" y="64" width="8" height="28" fill="#d9a06b" stroke="#0a141a" strokeWidth="3" />
          <rect x="71" y="50" width="16" height="26" fill="#f7f1df" stroke="#0a141a" strokeWidth="3" />
          <line x1="75" y1="57" x2="83" y2="57" stroke="#5a6f77" strokeWidth="2" />
          <line x1="75" y1="63" x2="82" y2="63" stroke="#5a6f77" strokeWidth="2" />
          <rect x="22" y="58" width="52" height="6" fill="#f0b35c" stroke="#0a141a" strokeWidth="2" />
          <rect x="44" y="10" width="8" height="16" fill="#0a141a" />
          <circle cx="48" cy="8" r="4" fill="#f0b35c" className="tc-blink" />
        </svg>

        <div className="login-screen__dialogue">
          <span className="login-screen__nameplate retro">THE CURATOR</span>

          <div className="login-screen__dialogue-frame">
            <div className="login-screen__dialogue-corners" aria-hidden="true" />
            <p className="login-screen__dialogue-title retro">Welcome to Tool City.</p>
            <p className="login-screen__dialogue-text retro">
              This district runs one private English → Hindi translation
              workshop. Browse the Arkiv listing, pay one test USDT on
              Whitechain, and review the saved translation at the Archive.
            </p>

            <div className="login-screen__choices">
              <button
                type="button"
                className="login-screen__choice login-screen__choice--primary"
                onClick={onConnect}
              >
                <span className="login-screen__choice-cursor" aria-hidden="true">
                  &gt;
                </span>
                Open the workshop terminal
              </button>

              <button
                type="button"
                className="login-screen__choice"
                onClick={onSeeDemo}
              >
                <span className="login-screen__choice-cursor" aria-hidden="true">
                  &gt;
                </span>
                Walk the demo city
              </button>
            </div>

            <p className="login-screen__dialogue-footnote retro">
              Demo mode uses labelled test USDT and a sample draft. No wallet,
              real funds or private text leave this browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
