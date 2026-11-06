"use client";
// State decorations drawn inside each building. Every visual is a pure function
// of CityState plus one-shot effect keys for transitions observed while open.
// Private note text is never rendered: privacy is shown with icons only.
import type { CSSProperties } from "react";
import type { CityState } from "./city-state";
import { isoGeometry } from "./iso-geometry";
import type { BuildingDef } from "./scene-config";

export interface SceneFx {
  stamp: "in" | "out" | null;
  stampKey: number;
  scanKey: number;
  boxesKey: number;
}

interface DecorProps {
  def: BuildingDef;
  city: CityState;
  fx: SceneFx;
}

const Lock = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-3.5} y={-1} width={7} height={6} rx={1} fill="#5c564a" />
    <path d="M-2 -1 v-2 a2 2 0 0 1 4 0 v2" fill="none" stroke="#5c564a" strokeWidth={1.3} />
  </g>
);

export function PlanningDecor({ def, city }: DecorProps) {
  const g = isoGeometry(def);
  const chimneyX = def.cx + def.hw * 0.28 + 6;
  const chimneyTop = g.apex.y + g.roofH * 0.25;
  return (
    <>
      <g className="tc-smoke" aria-hidden="true">
        {[0, 1, 2].map((k) => (
          <circle
            key={k}
            className="tc-puff"
            cx={chimneyX}
            cy={chimneyTop - 3}
            r={4 + k}
            fill="#e9e4da"
            style={{ "--d": `${-k * 1.4}s` } as CSSProperties}
          />
        ))}
      </g>
      {city.planning.privateParcel && (
        <g className="tc-private-parcel">
          {/* private notes parcel: icon only */}
          <rect x={g.R.x + 2} y={g.R.y + 14} width={16} height={12} rx={1.5} fill="#c9a26b" stroke="#5c3a22" strokeWidth={1.2} />
          <Lock x={g.R.x + 10} y={g.R.y + 19} />
        </g>
      )}
    </>
  );
}

export function StudioDecor({ def, city }: DecorProps) {
  const g = isoGeometry(def);
  const dishX = g.apex.x + 20;
  const dishY = g.apex.y + 14;
  return (
    <>
      <g transform={`translate(${dishX} ${dishY})`}>
        <line x1={0} y1={0} x2={0} y2={-9} stroke="#4a4438" strokeWidth={2} />
        <g className="tc-dish">
          <ellipse cx={0} cy={-12} rx={8} ry={4.5} fill="#e8f1ee" stroke="#4a4438" strokeWidth={1.4} />
          <circle cx={0} cy={-12} r={1.4} fill="#4a4438" />
        </g>
      </g>
      {city.studio === "running" && (
        <g className="tc-data" aria-hidden="true">
          {[0, 1, 2, 3].map((k) => (
            <rect
              key={k}
              className="tc-data-dot"
              x={g.apex.x - 9 + k * 6}
              y={g.apex.y - 4}
              width={k % 2 ? 4 : 2.5}
              height={2}
              rx={1}
              fill="#1f7a70"
              style={{ "--d": `${-k * 0.55}s` } as CSSProperties}
            />
          ))}
        </g>
      )}
      {(city.studio === "failed" || city.studio === "interrupted") && (
        <g className="tc-stalled">
          <ellipse className="tc-amber-pulse" cx={def.cx} cy={def.cy + g.hh * 0.55} rx={def.hw * 1.1} ry={g.hh * 0.7} fill="#e8a33a" />
          <g transform={`translate(${g.apex.x - 22} ${g.apex.y + 10})`}>
            <path d="M0 -10 L9 6 L-9 6 Z" fill="#e8a33a" stroke="#7a4d0e" strokeWidth={1.5} strokeLinejoin="round" />
            <text x={0} y={4.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#3d2c05">
              !
            </text>
          </g>
        </g>
      )}
    </>
  );
}

export function ReleaseDecor({ def, city, fx }: DecorProps) {
  // Neutral approval emblem: a document outline with a check mark on a post.
  const x = def.cx + 14;
  const y = 30;
  return (
    <>
      <line x1={x + 8} y1={y + 20} x2={x + 8} y2={y + 26} stroke="#6e3a22" strokeWidth={2} />
      <g className={city.release === "awaiting" ? "tc-emblem tc-bob" : "tc-emblem"}>
        <rect x={x} y={y} width={16} height={20} rx={2} fill="#fdfbf3" stroke="#5c564a" strokeWidth={1.5} />
        <line x1={x + 3} y1={y + 5} x2={x + 13} y2={y + 5} stroke="#9a917f" strokeWidth={1.2} />
        <path d={`M${x + 4} ${y + 12} l3 3 l5 -6`} fill="none" stroke="#5c564a" strokeWidth={1.6} strokeLinecap="round" />
      </g>
      {city.release === "approved" && (
        <g key={`in-${fx.stampKey}`} className={fx.stamp === "in" ? "tc-approved tc-stamp-in" : "tc-approved"}>
          <circle cx={x + 18} cy={y + 2} r={7.5} fill="#2f8a57" stroke="#1d5a38" strokeWidth={1.5} />
          <path d={`M${x + 14.5} ${y + 2} l2.5 2.5 l4.5 -5`} fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )}
      {city.release !== "approved" && fx.stamp === "out" && (
        <g key={`out-${fx.stampKey}`} className="tc-stamp-out" aria-hidden="true">
          <circle cx={x + 18} cy={y + 2} r={7.5} fill="#8a8a80" />
        </g>
      )}
    </>
  );
}

export function RegistryDecor({ def, city, fx }: DecorProps) {
  const g = isoGeometry(def);
  const ax = g.apex.x;
  const top = g.apex.y - 24;
  const r = city.registry;
  const g2 = isoGeometry(def);
  return (
    <>
      {r === "expired" && (
        <polygon
          className="tc-grey"
          points={`${g2.L.x},${g2.L.y} ${g2.B.x},${g2.B.y} ${g2.R.x},${g2.R.y} ${g2.Rt.x},${g2.Rt.y} ${g2.apex.x},${g2.apex.y} ${g2.Lt.x},${g2.Lt.y}`}
          fill="#7d7d76"
        />
      )}
      {r === "unavailable" && (
        <polygon
          className="tc-muted-outline"
          points={`${g2.L.x},${g2.L.y} ${g2.B.x},${g2.B.y} ${g2.R.x},${g2.R.y} ${g2.Rt.x},${g2.Rt.y} ${g2.apex.x},${g2.apex.y} ${g2.Lt.x},${g2.Lt.y}`}
          fill="#f3efe6"
          stroke="#6b665c"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      )}
      <line x1={ax} y1={g.apex.y} x2={ax} y2={top + 4} stroke="#4a4438" strokeWidth={2.5} />
      {r === "pending" && (
        <g className="tc-orbit" aria-hidden="true">
          <circle cx={ax} cy={top} r={10} fill="none" stroke="#1a5fb4" strokeWidth={2} strokeDasharray="10 6" pathLength={64} />
        </g>
      )}
      {(r === "live" || r === "stale") && (
        <g className={r === "stale" ? "tc-beacon tc-beacon-dim" : "tc-beacon"}>
          <circle cx={ax} cy={top} r={9} fill="#7fd6c4" opacity={0.45} />
          <circle cx={ax} cy={top} r={5} fill={r === "stale" ? "#9a9a90" : "#1f9d7a"} stroke="#145c48" strokeWidth={1.2} />
        </g>
      )}
      {r === "live" && fx.scanKey > 0 && (
        <circle key={fx.scanKey} className="tc-scan" cx={ax} cy={top} r={10} fill="none" stroke="#1f9d7a" strokeWidth={2} />
      )}
      {r === "unavailable" && (
        <circle cx={ax} cy={top} r={5} fill="none" stroke="#6b665c" strokeWidth={1.5} strokeDasharray="2 2" />
      )}
      {r === "expired" && <circle cx={ax} cy={top} r={5} fill="#9a9a90" stroke="#5c5a52" strokeWidth={1.2} />}
      {r === "closed" && (
        <g className="tc-flag-lowered">
          {/* flag lowered to the bottom of the mast */}
          <path d={`M${ax + 1} ${g.apex.y - 12} l14 3 l-14 5 Z`} fill="#c96f4a" stroke="#6e3a22" strokeWidth={1} />
          <circle cx={ax} cy={top + 3} r={2.5} fill="#4a4438" />
        </g>
      )}
    </>
  );
}

export function ArchiveDecor({ def, city, fx }: DecorProps) {
  if (!city.archive.boxes) return null;
  const g = isoGeometry(def);
  const x = g.R.x + 6;
  const y = g.R.y + 26;
  const box = (bx: number, by: number) => (
    <g transform={`translate(${bx} ${by})`}>
      <polygon points="0,0 8,-4 16,0 8,4" fill="#d8b98a" stroke="#6e5a3a" strokeWidth={1} />
      <polygon points="0,0 8,4 8,12 0,8" fill="#c39c66" stroke="#6e5a3a" strokeWidth={1} />
      <polygon points="16,0 8,4 8,12 16,8" fill="#a8824f" stroke="#6e5a3a" strokeWidth={1} />
    </g>
  );
  return (
    <g key={fx.boxesKey} className={fx.boxesKey > 0 ? "tc-boxes tc-boxes-in" : "tc-boxes"}>
      {box(x, y)}
      {box(x + 14, y + 6)}
      {box(x + 6, y - 8)}
    </g>
  );
}
