"use client";
// CityScene: React + SVG + CSS neighbourhood. Five buildings plus one worker.
// Every visual derives from `scene.city` (pure mapping of persisted state).
// Animation is decoration only: no callback here reads or writes brief state.
import "./city.css";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArchiveDecor, PlanningDecor, RegistryDecor, ReleaseDecor, StudioDecor, type SceneFx } from "./BuildingDecor";
import { GroundAmbient, SkyAmbient } from "./CityAmbient";
import IsoBuilding from "./IsoBuilding";
import Worker from "./Worker";
import { sceneFromCityState, type BriefSceneTarget } from "./brief-state-to-scene";
import { CITY_FIXTURES } from "./city-fixtures";
import { deriveCityState, type CityState } from "./city-state";
import { isoGeometry } from "./iso-geometry";
import type { CityEngine, MotionMode } from "./pixi/city-engine";
import { stateLabelFor, tagFor, type BuildingTag } from "./scene-labels";
import { BUILDINGS, BUILDINGS_BACK_TO_FRONT, VIEWBOX, type BuildingDef, type BuildingId } from "./scene-config";

interface CitySceneProps {
  selected: BuildingId | null;
  onSelect: (b: BuildingId) => void;
  scene: BriefSceneTarget;
  jobStatusLabel: string | null;
}

const NO_FX: SceneFx = { stamp: null, stampKey: 0, scanKey: 0, boxesKey: 0 };
const FIXTURE_PREFIX = "DEV FIXTURE (not real data): ";

/** One-shot effects only for transitions observed on the same brief while the page is open. */
function nextFx(prev: CityState, next: CityState, fx: SceneFx): SceneFx {
  if (next.briefId === null) return NO_FX;
  if (prev.briefId !== next.briefId) {
    // A saved brief appearing slides the archive boxes in; nothing else replays.
    return { ...NO_FX, boxesKey: prev.briefId === null ? fx.boxesKey + 1 : 0 };
  }
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

/** Hit area over a building in the canvas, as viewBox percentages. */
function hitRect(def: BuildingDef) {
  const g = isoGeometry(def);
  const top = g.apex.y - 10;
  const bottom = def.cy + g.hh + 34;
  return {
    left: `${((def.cx - def.hw) / VIEWBOX.w) * 100}%`,
    top: `${(top / VIEWBOX.h) * 100}%`,
    width: `${((def.hw * 2) / VIEWBOX.w) * 100}%`,
    height: `${((bottom - top) / VIEWBOX.h) * 100}%`,
  };
}

const subscribeNoop = () => () => {};
function useFixtureEnabled(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).has("cityFixture"),
    () => false,
  );
}

export default function CityScene({ selected, onSelect, scene: realScene, jobStatusLabel }: CitySceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<SVGGElement>(null);
  const skyRef = useRef<SVGGElement>(null);
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

  const isFixture = Boolean(fixture);
  // Identity changes only when the derived state content changes.
  const stableCity = prev.city;
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CityEngine | null>(null);
  const modeRef = useRef<MotionMode>("on");
  const [engineReady, setEngineReady] = useState(false);

  // Game renderer (PixiJS) loads client-side only; on any failure the SVG scene stays.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let engine: CityEngine | null = null;
    import("./pixi/city-engine")
      .then(({ CityEngine }) => CityEngine.create(host))
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

  // Push the derived state to the renderer. The renderer never writes state back.
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

  // Subtle pointer parallax on scenery layers only (mouse, motion on). Writes DOM transforms.
  const parallaxRaf = useRef<number | null>(null);
  const setParallax = (dx: number, dy: number) => {
    if (parallaxRaf.current !== null) cancelAnimationFrame(parallaxRaf.current);
    parallaxRaf.current = requestAnimationFrame(() => {
      parallaxRaf.current = null;
      groundRef.current?.setAttribute("transform", `translate(${dx * 2} ${dy * 1.5})`);
      skyRef.current?.setAttribute("transform", `translate(${dx * 5} ${dy * 3})`);
    });
  };
  useEffect(
    () => () => {
      if (parallaxRaf.current !== null) cancelAnimationFrame(parallaxRaf.current);
    },
    [],
  );
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || rootRef.current?.getAttribute("data-anim") !== "on") return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const dy = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (engineRef.current) engineRef.current.setParallax(dx, dy);
    else setParallax(dx, dy);
  };

  return (
    <div className="city-scene" ref={rootRef} data-anim="on" data-engine={engineReady ? "ready" : "svg"}>
      {/* Keyboard-accessible building navigation (buttons). */}
      <nav className="city-toolbar" aria-label="City buildings">
        {BUILDINGS_BACK_TO_FRONT.map((b) => (
          <button
            key={b.id}
            type="button"
            className="btn"
            aria-pressed={selected === b.id}
            onClick={() => onSelect(b.id)}
          >
            {b.name}
          </button>
        ))}
      </nav>
      {fixtureEnabled && (
        <div className="city-fixture" role="group" aria-label="Development fixture preview — not real data">
          <strong>DEV FIXTURE — not real data:</strong>{" "}
          <select
            value={fixtureId ?? ""}
            onChange={(e) => setFixtureId(e.target.value || null)}
            aria-label="Preview a fixture scene state"
          >
            <option value="">off (real state)</option>
            {CITY_FIXTURES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div
        className="city-frame"
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          setParallax(0, 0);
          engineRef.current?.setParallax(0, 0);
        }}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
          role="group"
          aria-label="Tool City neighbourhood map. Five buildings around paved streets with one document worker."
        >
          <desc>
            {`Registry Hall, Release Desk and AI Studio stand at the back; the Planning Desk and the Archive at the front. `}
            {statusText}
          </desc>
          {/* terrain */}
          <rect x={0} y={0} width={VIEWBOX.w} height={VIEWBOX.h} fill="#9db38a" />
          <ellipse cx={110} cy={330} rx={120} ry={60} fill="#8aa176" />
          <ellipse cx={560} cy={90} rx={140} ry={70} fill="#8aa176" />
          {/* streets: warm paving */}
          <rect x={0} y={228} width={VIEWBOX.w} height={38} fill="#d9c39a" />
          <rect x={0} y={228} width={VIEWBOX.w} height={4} fill="#bfa171" />
          <rect x={0} y={262} width={VIEWBOX.w} height={4} fill="#bfa171" />
          <rect x={300} y={110} width={44} height={252} fill="#d9c39a" />
          <rect x={300} y={110} width={4} height={252} fill="#bfa171" />
          <rect x={340} y={110} width={4} height={252} fill="#bfa171" />
          <ellipse cx={320} cy={322} rx={72} ry={30} fill="#d9c39a" stroke="#bfa171" strokeWidth={3} />
          <GroundAmbient layerRef={groundRef} />
          {/* buildings back-to-front */}
          {BUILDINGS_BACK_TO_FRONT.map((b) => (
            <IsoBuilding
              key={b.id}
              def={b}
              index={BUILDINGS.indexOf(b)}
              selected={selected === b.id}
              onSelect={() => onSelect(b.id)}
              stateLabel={stateLabelFor(b.id, city)}
              tag={tagFor(b.id, city, Boolean(fixture))}
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
          <SkyAmbient layerRef={skyRef} />
        </svg>
        <div className="city-canvas" ref={hostRef} />
        {engineReady &&
          BUILDINGS_BACK_TO_FRONT.map((b) => {
            const s = stateLabelFor(b.id, city);
            return (
              <button
                key={b.id}
                type="button"
                className="city-hit"
                style={hitRect(b)}
                aria-label={`${b.name}: ${b.description}${s ? ` Current state: ${s}.` : ""}`}
                aria-pressed={selected === b.id}
                onClick={() => {
                  onSelect(b.id);
                  engineRef.current?.ping(b.id);
                }}
                onPointerEnter={() => engineRef.current?.setHover(b.id)}
                onPointerLeave={() => engineRef.current?.setHover(null)}
                onFocus={() => engineRef.current?.setHover(b.id)}
                onBlur={() => engineRef.current?.setHover(null)}
              />
            );
          })}
      </div>
      <div className={`city-status${city.worker.unresolved ? " city-status-warn" : ""}`}>
        <p className="city-caption" role="status" aria-live="polite">
          {statusText}
        </p>
        <p className="city-terms">
          Compilation uses promotional credits. Any advertised budget is unfunded: BriefMint does not
          hold or move any funds.
        </p>
      </div>
      {/* Text alternative for the whole scene. */}
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
        {jobStatusLabel ? null : <li>No active brief.</li>}
      </ul>
    </div>
  );
}
