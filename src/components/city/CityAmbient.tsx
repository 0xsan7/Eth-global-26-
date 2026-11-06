"use client";
// Ambient scenery: decoration only, never reads brief state. All motion is CSS
// (transform/opacity) and stops when the scene root sets data-anim to paused/off.
import type { CSSProperties } from "react";
import type { Ref } from "react";

const TREES = [
  { x: 40, y: 206, s: 1, d: 0 },
  { x: 250, y: 96, s: 0.9, d: -1.3 },
  { x: 604, y: 214, s: 1.1, d: -2.1 },
  { x: 360, y: 368, s: 0.95, d: -0.7 },
  { x: 232, y: 378, s: 1, d: -2.8 },
  { x: 410, y: 384, s: 0.85, d: -1.8 },
];

const LAMPS = [
  { x: 60, y: 226, d: 0 },
  { x: 240, y: 226, d: -1.5 },
  { x: 410, y: 270, d: -2.5 },
  { x: 584, y: 226, d: -0.8 },
];

const FOUNTAIN = { x: 362, y: 328 };

/** Trees, lamps and the fountain sit on the ground, under the buildings. */
export function GroundAmbient({ layerRef }: { layerRef?: Ref<SVGGElement> }) {
  return (
    <g aria-hidden="true" className="tc-ambient">
      <g ref={layerRef} className="tc-parallax">
        {TREES.map((t) => (
          <g key={`${t.x}-${t.y}`} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
            <ellipse cx={0} cy={0} rx={13} ry={5} fill="#00000022" />
            <g className="tc-tree" style={{ "--d": `${t.d}s` } as CSSProperties}>
              <rect x={-2.5} y={-16} width={5} height={16} fill="#7a5a3a" />
              <circle cx={0} cy={-26} r={13} fill="#5f8a4e" />
              <circle cx={-6} cy={-21} r={8} fill="#6f9a5c" />
              <circle cx={5} cy={-31} r={7} fill="#7aa866" />
            </g>
          </g>
        ))}
      </g>
      {LAMPS.map((l) => (
        <g key={`${l.x}-${l.y}`} transform={`translate(${l.x} ${l.y})`}>
          <circle className="tc-lamp-glow" cx={0} cy={-24} r={9} fill="#ffe7a3" style={{ "--d": `${l.d}s` } as CSSProperties} />
          <line x1={0} y1={0} x2={0} y2={-22} stroke="#4a4438" strokeWidth={2} />
          <circle cx={0} cy={-24} r={3.2} fill="#fff4cc" stroke="#4a4438" strokeWidth={1} />
        </g>
      ))}
      <g transform={`translate(${FOUNTAIN.x} ${FOUNTAIN.y})`}>
        <ellipse className="tc-ripple" cx={0} cy={0} rx={16} ry={6} fill="none" stroke="#e8f4f7" strokeWidth={1.2} />
        <ellipse
          className="tc-ripple"
          cx={0}
          cy={0}
          rx={16}
          ry={6}
          fill="none"
          stroke="#e8f4f7"
          strokeWidth={1.2}
          style={{ "--d": "-1.3s" } as CSSProperties}
        />
        <ellipse cx={0} cy={0} rx={18} ry={7} fill="none" stroke="#a89470" strokeWidth={3} />
        <ellipse cx={0} cy={0} rx={15} ry={5.5} fill="#7fb6c4" />
        <ellipse className="tc-shimmer" cx={-4} cy={-1} rx={6} ry={1.6} fill="#d8eef3" />
        <rect className="tc-jet" x={-1.6} y={-14} width={3.2} height={14} rx={1.6} fill="#d8eef3" />
      </g>
    </g>
  );
}

/** Cloud shadows and a bird flock float above everything; never intercept pointer events. */
export function SkyAmbient({ layerRef }: { layerRef?: Ref<SVGGElement> }) {
  return (
    <g aria-hidden="true" className="tc-ambient tc-sky" pointerEvents="none">
      <g ref={layerRef} className="tc-parallax">
        <ellipse className="tc-cloud" cx={0} cy={110} rx={90} ry={34} fill="#1d2b14" style={{ "--d": "-20s", "--t": "95s" } as CSSProperties} />
        <ellipse className="tc-cloud" cx={0} cy={300} rx={120} ry={40} fill="#1d2b14" style={{ "--d": "-62s", "--t": "120s" } as CSSProperties} />
        <ellipse className="tc-cloud" cx={0} cy={210} rx={70} ry={26} fill="#1d2b14" style={{ "--d": "-5s", "--t": "80s" } as CSSProperties} />
        <g className="tc-birds">
          {[0, 1, 2].map((k) => (
            <g key={k} transform={`translate(${k * 11} ${k === 1 ? -6 : 0})`}>
              <path
                className="tc-bird"
                d="M-5 0 Q-2.5 -3 0 0 Q2.5 -3 5 0"
                fill="none"
                stroke="#3a3a32"
                strokeWidth={1.4}
                strokeLinecap="round"
                style={{ "--d": `${-k * 0.2}s` } as CSSProperties}
              />
            </g>
          ))}
        </g>
      </g>
    </g>
  );
}
