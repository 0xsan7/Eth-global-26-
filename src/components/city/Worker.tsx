"use client";
// Document worker. Position is animated with requestAnimationFrame writing the
// SVG transform attribute directly (no per-frame React state). The walk is
// cosmetic: it starts from a state change and never reports back or sets state.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WorkerCarry, WorkerPose } from "./city-state";
import type { BuildingId } from "./scene-config";
import { easeInOut, pathLength, pointAlong, streetRoute, walkDurationMs } from "./walk-path";

interface WorkerProps {
  x: number;
  y: number;
  pose: WorkerPose;
  carry: WorkerCarry;
  unresolved: boolean;
  /** Same brief id as the previous render = a transition observed while open. */
  briefId: string | null;
  building: BuildingId | null;
}

const DOOR_MS = 900;

function motionAllowed(el: Element | null): boolean {
  const root = el?.closest(".city-scene");
  if (root?.getAttribute("data-anim") === "off") return false;
  return !(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

export default function Worker({ x, y, pose, carry, unresolved, briefId, building }: WorkerProps) {
  const posRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  // Initial transform only; afterwards the layout effect owns the attribute.
  const [initial] = useState(() => `translate(${x} ${y})`);
  const cur = useRef({ x, y });
  const lastBrief = useRef<string | null>(briefId);
  const mounted = useRef(false);
  const raf = useRef<number | null>(null);
  const doorTimer = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = posRef.current;
    if (!el) return;
    const place = (px: number, py: number) => {
      cur.current = { x: px, y: py };
      el.setAttribute("transform", `translate(${px} ${py})`);
    };
    const stop = () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
      el.removeAttribute("data-walking");
    };
    const sameBrief = briefId !== null && briefId === lastBrief.current;
    lastBrief.current = briefId;
    // First render, a different brief (load/reopen/wallet change) or reduced motion: jump, no travel.
    if (!mounted.current || !sameBrief || !motionAllowed(el)) {
      mounted.current = true;
      stop();
      place(x, y);
      return;
    }
    const path = streetRoute(cur.current, { x, y });
    const dur = walkDurationMs(pathLength(path));
    if (dur === 0) return;
    stop();
    el.setAttribute("data-walking", "true");
    const start = performance.now();
    const step = (now: number) => {
      const p = pointAlong(path, easeInOut((now - start) / dur));
      place(p.x, p.y);
      if (p.dx !== 0) faceRef.current?.setAttribute("transform", p.dx < 0 ? "scale(-1 1)" : "scale(1 1)");
      if (now - start < dur) {
        raf.current = requestAnimationFrame(step);
        return;
      }
      raf.current = null;
      el.removeAttribute("data-walking");
      // Cosmetic door open/close at the destination; never blocks UI or state.
      const root = el.closest(".city-scene");
      if (root && building) {
        root.setAttribute("data-door", building);
        if (doorTimer.current !== null) window.clearTimeout(doorTimer.current);
        doorTimer.current = window.setTimeout(() => root.removeAttribute("data-door"), DOOR_MS);
      }
    };
    raf.current = requestAnimationFrame(step);
  }, [x, y, briefId, building]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      if (doorTimer.current !== null) window.clearTimeout(doorTimer.current);
    },
    [],
  );

  return (
    <g ref={posRef} className="tc-worker" data-pose={pose} transform={initial} aria-hidden="true">
      <ellipse className="tc-worker-shadow" cx={0} cy={0} rx={11} ry={4.5} fill="#00000030" />
      <g ref={faceRef}>
        <g className="tc-worker-body">
          <line className="tc-leg tc-leg-l" x1={-3} y1={-10} x2={-3} y2={-1} stroke="#4a3b2c" strokeWidth={3.5} strokeLinecap="round" />
          <line className="tc-leg tc-leg-r" x1={3} y1={-10} x2={3} y2={-1} stroke="#4a3b2c" strokeWidth={3.5} strokeLinecap="round" />
          <g className="tc-worker-torso">
            <rect x={-7} y={-24} width={14} height={15} rx={5} fill="#8a5a3b" stroke="#5c3a22" strokeWidth={1.5} />
            {carry === "notes" && (
              <g>
                {/* private notes: blank sheet + lock icon, never any note text */}
                <rect x={8} y={-26} width={11} height={14} rx={1.5} fill="#fdfbf3" stroke="#5c564a" strokeWidth={1.5} />
                <rect x={10.5} y={-19} width={6} height={5} rx={1} fill="#5c564a" />
                <path d="M11.8 -19 v-1.8 a1.7 1.7 0 0 1 3.4 0 v1.8" fill="none" stroke="#5c564a" strokeWidth={1.2} />
              </g>
            )}
            {carry === "brief" && (
              <g>
                <rect x={8} y={-26} width={11} height={14} rx={1.5} fill="#fdfbf3" stroke="#5c564a" strokeWidth={1.5} />
                <path d="M10.5 -19 l2.5 2.5 l4 -5" fill="none" stroke="#1f7a4d" strokeWidth={1.6} strokeLinecap="round" />
              </g>
            )}
            <circle className="tc-worker-head" cx={0} cy={-30} r={6.5} fill="#e8b98a" stroke="#8a5a3b" strokeWidth={1.5} />
          </g>
        </g>
      </g>
      {unresolved && (
        <g className="tc-worker-alert">
          <circle cx={13} cy={-38} r={8} fill="#e8a33a" stroke="#7a4d0e" strokeWidth={1.5} />
          <text x={13} y={-34} textAnchor="middle" fontSize={11} fontWeight={800} fill="#3d2c05">
            !
          </text>
        </g>
      )}
    </g>
  );
}
