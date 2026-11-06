// Pure walking helpers: fixed street routes, path length, eased sampling.
// No React, timers or randomness. The worker only follows these polylines.
import type { Waypoint } from "./scene-config";

/** Street centrelines from the scene artwork. */
export const STREET_Y = 247; // horizontal street (y 228–266)
export const STREET_X = 322; // vertical street (x 300–344)
export const JUNCTION: Waypoint = { x: STREET_X, y: STREET_Y };
export const WALK_SPEED_PX_PER_S = 70;
export const MIN_WALK_MS = 400;
export const MAX_WALK_MS = 4000;

type Street = "h" | "v";

/** Nearest street entry for a point (building doors and mid-walk positions). */
export function streetEntry(p: Waypoint): { street: Street; at: Waypoint } {
  const inH = p.y >= 226 && p.y <= 268;
  const inV = p.x >= 298 && p.x <= 346;
  if (inH && (!inV || Math.abs(p.y - STREET_Y) <= Math.abs(p.x - STREET_X))) {
    return { street: "h", at: { x: p.x, y: STREET_Y } };
  }
  if (inV) return { street: "v", at: { x: STREET_X, y: p.y } };
  return Math.abs(p.y - STREET_Y) <= Math.abs(p.x - STREET_X)
    ? { street: "h", at: { x: p.x, y: STREET_Y } }
    : { street: "v", at: { x: STREET_X, y: p.y } };
}

const same = (a: Waypoint, b: Waypoint) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/** Polyline from `from` to `to` along the existing streets only. */
export function streetRoute(from: Waypoint, to: Waypoint): Waypoint[] {
  if (same(from, to)) return [{ x: from.x, y: from.y }];
  const a = streetEntry(from);
  const b = streetEntry(to);
  const raw: Waypoint[] = [from, a.at];
  if (a.street !== b.street) raw.push(JUNCTION);
  raw.push(b.at, to);
  const out: Waypoint[] = [];
  for (const p of raw) if (!out.length || !same(out[out.length - 1], p)) out.push({ x: p.x, y: p.y });
  return out;
}

export function pathLength(path: Waypoint[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return len;
}

export function walkDurationMs(length: number): number {
  if (length <= 0) return 0;
  return Math.min(MAX_WALK_MS, Math.max(MIN_WALK_MS, (length / WALK_SPEED_PX_PER_S) * 1000));
}

export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 0.5 - Math.cos(Math.PI * c) / 2;
}

/** Point at fraction `f` (0..1) of the path length, plus horizontal heading (-1, 0, 1). */
export function pointAlong(path: Waypoint[], f: number): { x: number; y: number; dx: number } {
  if (path.length === 0) return { x: 0, y: 0, dx: 0 };
  if (path.length === 1) return { x: path[0].x, y: path[0].y, dx: 0 };
  const total = pathLength(path);
  let remaining = Math.min(1, Math.max(0, f)) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg || i === path.length - 1) {
      const t = seg === 0 ? 1 : Math.min(1, remaining / seg);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: Math.sign(b.x - a.x) };
    }
    remaining -= seg;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y, dx: 0 };
}
