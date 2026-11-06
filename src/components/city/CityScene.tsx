"use client";
// Full-screen city "emulator": the PixiJS island fills the viewport and HUD windows
// float over it. Every visual derives from `scene.city` (pure mapping of persisted
// state); no animation or camera callback reads or writes brief state.
import "./city.css";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { workbenchInset } from "./city-viewport";
import HudWindow from "@/components/hud/HudWindow";
import { ArchiveDecor, PlanningDecor, RegistryDecor, ReleaseDecor, StudioDecor, type SceneFx } from "./BuildingDecor";
import { GroundAmbient, SkyAmbient } from "./CityAmbient";
import IsoBuilding from "./IsoBuilding";
import Worker from "./Worker";
import { sceneFromCityState, type BriefSceneTarget } from "./brief-state-to-scene";
import { CITY_FIXTURES } from "./city-fixtures";
import { deriveCityState, type CityState } from "./city-state";
import { keyBuildingBox } from "./iso-buildings";
import type { CameraState, CityEngine, MotionMode } from "./pixi/city-engine";
import { stateLabelFor, tagFor, type BuildingTag } from "./scene-labels";
import { BUILDINGS, BUILDINGS_BACK_TO_FRONT, VIEWBOX, type BuildingDef, type BuildingId } from "./scene-config";

export interface ScanStats {
  opportunities: number;
  open: number;
  loading: boolean;
  stale: boolean;
  error: boolean;
}

interface CitySceneProps {
  selected: BuildingId | null;
  onSelect: (b: BuildingId) => void;
  scene: BriefSceneTarget;
  scan: ScanStats;
  /** Next real action (existing handlers only). */
  action: { label: string; run: () => void; busy?: boolean } | null;
  idleHint: string;
  notice?: ReactNode;
  /** Wallet + navigation shown at the top of the console window. */
  consoleTop?: ReactNode;
  /** The selected building's panel. */
  children: ReactNode;
}

const NO_FX: SceneFx = { stamp: null, stampKey: 0, scanKey: 0, boxesKey: 0 };
const FIXTURE_PREFIX = "DEV FIXTURE (not real data): ";

/** One-shot effects only for transitions observed on the same brief while the page is open. */
function nextFx(prev: CityState, next: CityState, fx: SceneFx): SceneFx {
  if (next.briefId === null) return NO_FX;
  if (prev.briefId !== next.briefId) return { ...NO_FX, boxesKey: prev.briefId === null ? fx.boxesKey + 1 : 0 };
  let out = fx;
  if (prev.release !== "approved" && next.release === "approved") out = { ...out, stamp: "in", stampKey: out.stampKey + 1 };
  if (prev.release === "approved" && next.release !== "approved") out = { ...out, stamp: "out", stampKey: out.stampKey + 1 };
  if (
    prev.registry === "live" &&
    next.registry === "live" &&
    next.registryObservedAt !== null &&
    prev.registryObservedAt !== next.registryObservedAt
  ) {
    out = { ...out, scanKey: out.scanKey + 1 };
  }
  return out;
}

function decorFor(def: BuildingDef, city: CityState, fx: SceneFx): ReactNode {
  const p = { def, city, fx };
  switch (def.id) {
    case "home":
      return <PlanningDecor {...p} />;
    case "studio":
      return <StudioDecor {...p} />;
    case "treasury":
      return <ReleaseDecor {...p} />;
    case "registry":
      return <RegistryDecor {...p} />;
    case "archive":
      return <ArchiveDecor {...p} />;
  }
}

/** Mirrors the camera onto the HTML hit layer (DOM write only, no React state per frame). */
function applyHitTransform(el: HTMLElement | null, c: CameraState) {
  if (el) el.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.z})`;
}

const subscribeNoop = () => () => {};
function useFixtureEnabled(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).has("cityFixture"),
    () => false,
  );
}

const DIM_LABELS: Array<{ key: string; label: string; value: (c: CityState) => string; tone: (c: CityState) => string }> = [
  {
    key: "exec",
    label: "Compile",
    value: (c) => (c.briefId === null ? "none" : c.studio === "idle" ? (c.planning.lit ? "draft" : "done") : c.studio),
    tone: (c) => (c.worker.unresolved ? "warn" : c.studio === "running" ? "info" : "plain"),
  },
  {
    key: "review",
    label: "Review",
    value: (c) => (c.release === "idle" ? "—" : c.release),
    tone: (c) => (c.release === "approved" ? "ok" : c.release === "awaiting" ? "info" : "plain"),
  },
  {
    key: "pub",
    label: "Publish",
    value: (c) => (c.registry === "none" ? "—" : c.registry),
    tone: (c) =>
      c.registry === "live" ? "ok" : c.registry === "stale" || c.registry === "unavailable" ? "warn" : c.registry === "pending" ? "info" : "plain",
  },
];

export default function CityScene({
  selected,
  onSelect,
  scene: realScene,
  scan,
  action,
  idleHint,
  notice,
  consoleTop,
  children,
}: CitySceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const [workbenchExpanded, setWorkbenchExpanded] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const hitsRef = useRef<HTMLDivElement | null>(null);
  const fixtureEnabled = useFixtureEnabled();
  const [fixtureId, setFixtureId] = useState<string | null>(null);
  const fixture = fixtureEnabled && fixtureId ? CITY_FIXTURES.find((f) => f.id === fixtureId) ?? null : null;
  const scene = fixture ? sceneFromCityState(deriveCityState(fixture.input)) : realScene;
  const city = scene.city;
  const statusText = fixture ? `${FIXTURE_PREFIX}${city.statusText}` : city.statusText;

  // Derive one-shot fx from observed state changes (React "adjust state on prop change" pattern).
  const cityKey = JSON.stringify(city);
  const [prev, setPrev] = useState<{ key: string; city: CityState; fx: SceneFx }>({ key: cityKey, city, fx: NO_FX });
  let fx = prev.fx;
  if (prev.key !== cityKey) {
    fx = nextFx(prev.city, city, prev.fx);
    setPrev({ key: cityKey, city, fx });
  }
  // Identity changes only when the derived state content changes.
  const stableCity = prev.city;
  const isFixture = Boolean(fixture);

  const engineRef = useRef<CityEngine | null>(null);
  const modeRef = useRef<MotionMode>("on");
  const [engineReady, setEngineReady] = useState(false);

  // Game renderer loads client-side only; on any failure the SVG scene stays.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let engine: CityEngine | null = null;
    const onCamera = (c: CameraState) => applyHitTransform(hitsRef.current, c);
    import("./pixi/city-engine")
      .then(({ CityEngine }) => CityEngine.create(host, { onCamera, reservedWidth: () => workbenchInset(host.getBoundingClientRect(), workbenchRef.current?.getBoundingClientRect() ?? null) }))
      .then((e) => {
        if (cancelled) {
          e.destroy();
          return;
        }
        engine = e;
        e.setMotion(modeRef.current);
        engineRef.current = e;
        setEngineReady(true);
      })
      .catch(() => {
        /* WebGL/canvas unavailable: keep the SVG scene */
      });
    return () => {
      cancelled = true;
      engine?.destroy();
      engineRef.current = null;
    };
  }, []);

  // Follow actual panel geometry, including expansion and stacked mobile layout.
  useEffect(() => {
    const host = hostRef.current;
    const panel = workbenchRef.current;
    if (!host || !panel) return;
    let previousInset: number | null = null;
    const resize = () => {
      const inset = workbenchInset(host.getBoundingClientRect(), panel.getBoundingClientRect());
      host.style.setProperty("--map-right-inset", `${inset}px`);
      // Content height changes on the stacked workspace must not reset map pan/zoom.
      if (inset !== previousInset) engineRef.current?.fit();
      previousInset = inset;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(panel);
    observer.observe(host);
    resize();
    return () => observer.disconnect();
  }, [engineReady]);

  // Push derived state to the renderer. The renderer never writes state back.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engineReady || !engine) return;
    const tags = Object.fromEntries(BUILDINGS.map((b) => [b.id, tagFor(b.id, stableCity, isFixture)])) as Record<
      BuildingId,
      BuildingTag | null
    >;
    engine.setState(stableCity, tags);
  }, [engineReady, stableCity, isFixture]);

  useEffect(() => {
    if (engineReady) engineRef.current?.setSelected(selected);
  }, [engineReady, selected]);

  // Global motion switch: off for reduced motion, paused when hidden or off-screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = true;
    const apply = () => {
      const mode: MotionMode = mq.matches ? "off" : document.hidden || !onScreen ? "paused" : "on";
      root.setAttribute("data-anim", mode);
      modeRef.current = mode;
      engineRef.current?.setMotion(mode);
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            onScreen = entries.some((e) => e.isIntersecting);
            apply();
          })
        : null;
    io?.observe(root);
    mq.addEventListener("change", apply);
    document.addEventListener("visibilitychange", apply);
    apply();
    return () => {
      io?.disconnect();
      mq.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", apply);
    };
  }, []);

  const select = (id: BuildingId) => {
    if (engineRef.current?.consumeDrag()) return;
    onSelect(id);
    engineRef.current?.ping(id);
  };

  const fixtureWindow = fixtureEnabled ? (
    <HudWindow title="Dev fixture" hint="not real data" className="hud-window--danger">
      <label className="hud-field">
        <span className="hud-label">Preview a scene state</span>
        <select value={fixtureId ?? ""} onChange={(e) => setFixtureId(e.target.value || null)}>
          <option value="">off (real state)</option>
          {CITY_FIXTURES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
    </HudWindow>
  ) : null;

  return (
    <div className="game" data-workbench={workbenchExpanded ? "expanded" : "standard"} ref={rootRef} data-anim="on" data-engine={engineReady ? "ready" : "svg"}>
      <div className="hud-layer">
        <div className="hud-col hud-col--right" ref={workbenchRef}>
          <HudWindow title="Workbench" fill actions={
            <button type="button" className="workbench-toggle" aria-pressed={workbenchExpanded} onClick={() => setWorkbenchExpanded(v => !v)}>
              {workbenchExpanded ? "Compact view" : "Expand workspace"}
            </button>
          } footer={<><span>Arkiv · Rabdi</span><span>5 buildings</span></>}>
            {consoleTop}
            <nav className="building-tabs" aria-label="Brief workflow">
              {(["home", "studio", "treasury", "registry", "archive"] as BuildingId[]).map((id, index) => {
                const b = BUILDINGS.find(b => b.id === id)!;
                const stepNames = ["Plan", "Generate", "Review", "Publish", "Archive"];
                return <button key={b.id} type="button" className="building-tab" aria-pressed={selected === b.id} title={b.name} onClick={() => onSelect(b.id)}>
                  {index < 4 && <span className="workflow-step" aria-hidden="true">{index + 1}</span>}
                  {stepNames[index]}
                </button>;
              })}
            </nav>
            <div className="console-body">{children}</div>
          </HudWindow>
        </div>
        <div className="hud-col hud-col--left">
          <HudWindow title="City scan" hint={scan.loading ? "syncing" : scan.error || scan.stale ? "stale" : "live"}>
            <div className="scan-row">
              <span className="scan-big">{scan.loading ? "…" : scan.open}</span>
              <span className="hud-label">open opportunities</span>
              <span className="hud-label scan-right">{scan.opportunities} indexed</span>
            </div>
            <div className="chip-row">
              {DIM_LABELS.map((d) => (
                // Fixture previews never get success/live colouring.
                <span key={d.key} className={`chip chip--${isFixture ? "plain" : d.tone(city)}`}>
                  <span className="chip-k">{d.label}</span> {d.value(city)}
                </span>
              ))}
              {fixture && <span className="chip chip--danger">fixture</span>}
            </div>
          </HudWindow>
          {fixtureWindow}
          <div className="hud-col-spacer" />
          <div className="hud-hint">
            <span>Drag to pan · Scroll to zoom · Click a building</span>
            <span className="hud-hint-btns">
              <button type="button" className="hud-icon-btn" aria-label="Zoom in" onClick={() => engineRef.current?.zoomBy(1.25)} disabled={!engineReady}>
                +
              </button>
              <button type="button" className="hud-icon-btn" aria-label="Zoom out" onClick={() => engineRef.current?.zoomBy(0.8)} disabled={!engineReady}>
                −
              </button>
              <button type="button" className="hud-icon-btn" aria-label="Reset view" onClick={() => engineRef.current?.fit()} disabled={!engineReady}>
                ⌂
              </button>
            </span>
          </div>
          <HudWindow
            title="Next step"
            className={city.worker.unresolved ? "hud-window--warn" : undefined}
            persistent={
              <div className="order-bar">
                <span className="order-prompt" aria-hidden="true">
                  ›
                </span>
                {!action && <span className="order-text">{idleHint}</span>}
                {action && (
                  <button type="button" className="btn btn-primary" disabled={action.busy} onClick={action.run}>
                    {action.busy ? "Working…" : action.label}
                  </button>
                )}
              </div>
            }
          >
            <p className="order-status" role="status" aria-live="polite">
              {statusText}
            </p>
            {notice}
            <p className="hud-fine">
              Compilation uses promotional credits. Any advertised budget is unfunded: BriefMint never holds or moves funds.
            </p>
          </HudWindow>
        </div>

      </div>

      <div className="game-world" ref={hostRef}>
        <svg
          className="game-fallback"
          viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Tool City map. Five buildings around paved streets with one document worker."
        >
          <desc>{statusText}</desc>
          <rect x={0} y={0} width={VIEWBOX.w} height={VIEWBOX.h} fill="#9db38a" />
          <rect x={0} y={228} width={VIEWBOX.w} height={38} fill="#d9c39a" />
          <rect x={300} y={110} width={44} height={252} fill="#d9c39a" />
          <ellipse cx={320} cy={322} rx={72} ry={30} fill="#d9c39a" stroke="#bfa171" strokeWidth={3} />
          <GroundAmbient />
          {BUILDINGS_BACK_TO_FRONT.map((b) => (
            <IsoBuilding
              key={b.id}
              def={b}
              index={BUILDINGS.indexOf(b)}
              selected={selected === b.id}
              onSelect={() => onSelect(b.id)}
              stateLabel={stateLabelFor(b.id, city)}
              tag={tagFor(b.id, city, isFixture)}
              dataState={{
                lit: String(b.id === "home" ? city.planning.lit : b.id === "studio" ? city.studio === "running" : false),
                studio: b.id === "studio" ? city.studio : "",
                registry: b.id === "registry" ? city.registry : "",
              }}
              chimney={b.id === "home"}
              wallLeft={b.id === "studio" ? "#e8f1ee" : undefined}
              wallRight={b.id === "studio" ? "#cfe0da" : undefined}
            >
              {decorFor(b, city, fx)}
            </IsoBuilding>
          ))}
          <Worker
            x={scene.x}
            y={scene.y}
            pose={city.worker.pose}
            carry={city.worker.carry}
            unresolved={city.worker.unresolved}
            briefId={city.briefId}
            building={city.worker.building}
          />
          <SkyAmbient />
        </svg>
        {engineReady && (
          <div
            className="game-hits"
            ref={(el) => {
              hitsRef.current = el;
              const engine = engineRef.current;
              if (el && engine) applyHitTransform(el, engine.camera());
            }}
          >
            {BUILDINGS_BACK_TO_FRONT.map((b) => {
              const s = stateLabelFor(b.id, city);
              const box = keyBuildingBox(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  className="game-hit"
                  style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                  aria-label={`${b.name}: ${b.description}${s ? ` Current state: ${s}.` : ""}`}
                  aria-pressed={selected === b.id}
                  onClick={() => select(b.id)}
                  onPointerEnter={() => engineRef.current?.setHover(b.id)}
                  onPointerLeave={() => engineRef.current?.setHover(null)}
                  onFocus={() => engineRef.current?.setHover(b.id)}
                  onBlur={() => engineRef.current?.setHover(null)}
                />
              );
            })}
          </div>
        )}
      </div>

      <ul className="sr-only">
        {BUILDINGS_BACK_TO_FRONT.map((b) => {
          const s = stateLabelFor(b.id, city);
          return (
            <li key={b.id}>
              {b.name}: {b.description}
              {s ? ` Current state: ${s}.` : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
