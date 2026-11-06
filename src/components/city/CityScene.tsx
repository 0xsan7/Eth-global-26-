"use client";
// CityScene: React + SVG + CSS neighbourhood. Five buildings plus one worker.
// Every visual derives from `scene.city` (pure mapping of persisted state).
// Animation is decoration only: no callback here reads or writes brief state.
import "./city.css";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArchiveDecor, PlanningDecor, RegistryDecor, ReleaseDecor, StudioDecor, type SceneFx } from "./BuildingDecor";
import { GroundAmbient, SkyAmbient } from "./CityAmbient";
import IsoBuilding, { type BuildingTag } from "./IsoBuilding";
import Worker from "./Worker";
import { sceneFromCityState, type BriefSceneTarget } from "./brief-state-to-scene";
import { CITY_FIXTURES } from "./city-fixtures";
import { deriveCityState, type CityState } from "./city-state";
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

function tagFor(id: BuildingId, city: CityState, fixture: boolean): BuildingTag | null {
  if (id === "studio") {
    if (city.studio === "running") return { text: "compiling…", tone: "info" };
    if (city.studio === "failed") return { text: "⚠ failed — unresolved", tone: "warn" };
    if (city.studio === "interrupted") return { text: "⚠ interrupted — unresolved", tone: "warn" };
  }
  if (id === "treasury") {
    if (city.release === "awaiting") return { text: "awaiting review", tone: "info" };
    if (city.release === "approved") return { text: "✓ approved", tone: "ok" };
  }
  if (id === "registry") {
    switch (city.registry) {
      case "pending":
        return { text: "waiting for confirmation", tone: "info" };
      case "live":
        // Fixture state never carries a live-looking label.
        return fixture ? { text: "fixture — not published", tone: "muted" } : { text: "live on Arkiv", tone: "ok" };
      case "closed":
        return { text: "closed", tone: "muted" };
      case "expired":
        return { text: "expired (confirmed)", tone: "muted" };
      case "stale":
        return { text: "stale read — not expired", tone: "warn" };
      case "unavailable":
        return { text: "read unavailable", tone: "warn" };
    }
  }
  return null;
}

function stateLabelFor(id: BuildingId, city: CityState): string | undefined {
  if (id === "home") return city.planning.lit ? "draft saved" : undefined;
  if (id === "studio") return city.studio === "idle" ? undefined : city.studio;
  if (id === "treasury") return city.release === "idle" ? undefined : city.release === "awaiting" ? "awaiting review" : "current revision approved";
  if (id === "registry") return city.registry === "none" ? undefined : city.registry;
  if (id === "archive") return city.archive.boxes ? "private brief saved" : undefined;
  return undefined;
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

  // Global motion switch: off for reduced motion, paused when hidden or off-screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = true;
    const apply = () => {
      const mode = mq.matches ? "off" : document.hidden || !onScreen ? "paused" : "on";
      root.setAttribute("data-anim", mode);
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
    setParallax(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
  };

  return (
    <div className="city-scene" ref={rootRef} data-anim="on">
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
        onPointerLeave={() => setParallax(0, 0)}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
          role="group"
          aria-label="BriefMint island. Five buildings around paved streets with one document worker."
        >
          <desc>
            {`An island with a lighter shoreline on bright blue water. Registry Hall, Release Desk and AI Studio stand at the back; the Planning Desk and the Archive at the front. `}
            {statusText}
          </desc>
          {/* water */}
          <rect x={0} y={0} width={VIEWBOX.w} height={VIEWBOX.h} fill="var(--hud-water)" />
          <clipPath id="hud-island-clip">
            <ellipse cx={320} cy={230} rx={305} ry={165} />
          </clipPath>
          {/* shoreline ring */}
          <ellipse cx={320} cy={230} rx={315} ry={174} fill="var(--hud-shore)" />
          {/* island grass */}
          <ellipse cx={320} cy={230} rx={305} ry={165} fill="var(--hud-grass)" />
          {/* streets: light grey, same centrelines the worker walks, clipped to the island */}
          <g clipPath="url(#hud-island-clip)">
            <rect x={0} y={228} width={VIEWBOX.w} height={38} fill="var(--hud-road)" />
            <rect x={0} y={228} width={VIEWBOX.w} height={4} fill="#b9c2cc" />
            <rect x={0} y={262} width={VIEWBOX.w} height={4} fill="#b9c2cc" />
            <rect x={300} y={110} width={44} height={252} fill="var(--hud-road)" />
            <rect x={300} y={110} width={4} height={252} fill="#b9c2cc" />
            <rect x={340} y={110} width={4} height={252} fill="#b9c2cc" />
            <ellipse cx={320} cy={322} rx={72} ry={30} fill="var(--hud-road)" stroke="#b9c2cc" strokeWidth={3} />
          </g>
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
      </div>
        {/* Text alternative for the whole scene (the visible status lives in the HUD card). */}
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
