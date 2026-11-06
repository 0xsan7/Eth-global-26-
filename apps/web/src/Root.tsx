import { useState } from "react";

import App from "./App";
import LoginScreen from "@/components/LoginScreen";
import { ToolCityScene } from "@/components/toolcity/ToolCityScene";
import WorkshopBoard from "@/components/toolcity/WorkshopBoard";

type Stage = "login" | "terminal" | "city";

/**
 * Owns the three Tool City entry states: the Curator's dialogue, the workshop
 * departures board, and the translation district itself. The demo has no
 * backend session; all state lives in the mounted front end.
 */
export default function Root() {
  const [stage, setStage] = useState<Stage>("login");

  if (stage === "login") {
    return (
      <div className="root-stage">
        <div className="hud-root hud-root--login-background">
          <ToolCityScene
            selected={null}
            onSelect={() => undefined}
            workerAt="plaza"
          />
          <div aria-hidden="true" className="hud-vignette" />
          <LoginScreen
            onConnect={() => setStage("terminal")}
            onSeeDemo={() => setStage("city")}
          />
        </div>
      </div>
    );
  }

  if (stage === "terminal") {
    return (
      <div className="root-stage">
        <div className="hud-root">
          <ToolCityScene
            selected="registry"
            onSelect={() => undefined}
            workerAt="plaza"
          />
          <div aria-hidden="true" className="hud-vignette" />
          <WorkshopBoard
            mode="page"
            onBack={() => setStage("login")}
            onEnter={() => setStage("city")}
          />
        </div>
      </div>
    );
  }

  return <App onExitToTerminal={() => setStage("terminal")} />;
}
