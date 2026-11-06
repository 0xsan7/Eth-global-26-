// Pure isometric grid layout for the game renderer: island tiles, road grid,
// building plots and street-only walking routes. No React, timers or randomness.
import type { BuildingId } from "./scene-config";

export interface GridPt {
  gx: number;
  gy: number;
}

export const GRID_N = 30;
export const TILE_W = 40;
export const TILE_H = 20;
/** Road tile indices; roads run the full width in both grid directions. */
export const ROAD_LINES = [4, 11, 18, 25] as const;
export const ROAD_MIN = 2;
export const ROAD_MAX = GRID_N - 2; // exclusive
/** Road centrelines in continuous grid units. */
export const ROAD_CENTRES = ROAD_LINES.map((r) => r + 0.5);
export const BLOCK_SIZE = 6;
export const SAND_RING = 2;

export interface Plot {
  gx: number;
  gy: number;
  size: number;
}

/** First tile of block (bx, by); blocks sit between consecutive road lines. */
export function blockOrigin(bx: number, by: number): GridPt {
  return { gx: ROAD_LINES[bx] + 1, gy: ROAD_LINES[by] + 1 };
}

// Back row (small gx+gy) to front row; screen x grows with gx - gy.
export const KEY_BLOCKS: Record<BuildingId, { bx: number; by: number }> = {
  treasury: { bx: 0, by: 0 },
  registry: { bx: 0, by: 1 },
  studio: { bx: 1, by: 0 },
  home: { bx: 0, by: 2 },
  archive: { bx: 2, by: 0 },
};
export const PLAZA_BLOCK = { bx: 1, by: 1 };
export const KEY_PLOT_SIZE = 4;

export const KEY_PLOTS: Record<BuildingId, Plot> = Object.fromEntries(
  Object.entries(KEY_BLOCKS).map(([id, b]) => {
    const o = blockOrigin(b.bx, b.by);
    return [id, { gx: o.gx + 1, gy: o.gy + 1, size: KEY_PLOT_SIZE }];
  }),
) as Record<BuildingId, Plot>;

export function isRoadCell(gx: number, gy: number): boolean {
  const inRange = (v: number) => v >= ROAD_MIN && v < ROAD_MAX;
  const onLine = (v: number) => (ROAD_LINES as readonly number[]).includes(v);
  return (onLine(gx) && inRange(gy)) || (onLine(gy) && inRange(gx));
}

export function isSandCell(gx: number, gy: number): boolean {
  return gx < SAND_RING || gy < SAND_RING || gx >= GRID_N - SAND_RING || gy >= GRID_N - SAND_RING;
}

/** The worker's standing point: on the road along the plot's front-right (max gx) side. */
export function doorFor(id: BuildingId): GridPt {
  const p = KEY_PLOTS[id];
  const roadCol = ROAD_LINES[KEY_BLOCKS[id].bx + 1];
  return { gx: roadCol + 0.5, gy: p.gy + p.size / 2 };
}

/** Grid → world pixels (diamond projection, origin at grid (0,0)). */
export function toWorld(p: GridPt): { x: number; y: number } {
  return { x: (p.gx - p.gy) * (TILE_W / 2), y: (p.gx + p.gy) * (TILE_H / 2) };
}

const EPS = 0.01;
const roadAt = (v: number) => ROAD_CENTRES.find((c) => Math.abs(c - v) < EPS);

function nearestRoad(a: number, b: number): number {
  let best: number = ROAD_CENTRES[0];
  let cost = Infinity;
  for (const c of ROAD_CENTRES) {
    const k = Math.abs(a - c) + Math.abs(b - c);
    if (k < cost - EPS) {
      cost = k;
      best = c;
    }
  }
  return best;
}

const samePt = (a: GridPt, b: GridPt) => Math.abs(a.gx - b.gx) < EPS && Math.abs(a.gy - b.gy) < EPS;

/**
 * Street-only route from a point on a road to a door (which is on a column road).
 * Fixed rule, not a search: along the current road, turn at most twice.
 */
export function isoRoute(from: GridPt, to: GridPt): GridPt[] {
  if (samePt(from, to)) return [{ ...from }];
  const toCol = roadAt(to.gx);
  if (toCol === undefined) throw new Error("isoRoute: destination must be on a column road");
  const fromCol = roadAt(from.gx);
  const fromRow = roadAt(from.gy);
  const pts: GridPt[] = [{ ...from }];
  if (fromCol !== undefined) {
    if (Math.abs(fromCol - toCol) < EPS) {
      pts.push({ gx: toCol, gy: to.gy });
    } else {
      const row = fromRow ?? nearestRoad(from.gy, to.gy);
      pts.push({ gx: fromCol, gy: row }, { gx: toCol, gy: row }, { gx: toCol, gy: to.gy });
    }
  } else if (fromRow !== undefined) {
    pts.push({ gx: toCol, gy: fromRow }, { gx: toCol, gy: to.gy });
  } else {
    throw new Error("isoRoute: start must be on a road");
  }
  const out: GridPt[] = [];
  for (const p of pts) if (!out.length || !samePt(out[out.length - 1], p)) out.push(p);
  return out;
}
