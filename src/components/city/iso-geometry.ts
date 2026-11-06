// Pure isometric geometry for a building footprint (shared by building + decor).
import type { BuildingDef } from "./scene-config";

export interface Pt {
  x: number;
  y: number;
}

export interface IsoGeometry {
  hh: number;
  roofH: number;
  T: Pt;
  R: Pt;
  B: Pt;
  L: Pt;
  Tt: Pt;
  Rt: Pt;
  Bt: Pt;
  Lt: Pt;
  apex: Pt;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const pts = (ps: Pt[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

export function isoGeometry(def: BuildingDef): IsoGeometry {
  const { cx, cy, hw, wallH, roof } = def;
  const hh = hw * 0.5;
  const roofH = roof === "flat" ? 10 : 24 + hw * 0.2;
  const T = { x: cx, y: cy - hh };
  const R = { x: cx + hw, y: cy };
  const B = { x: cx, y: cy + hh };
  const L = { x: cx - hw, y: cy };
  return {
    hh,
    roofH,
    T,
    R,
    B,
    L,
    Tt: { x: T.x, y: T.y - wallH },
    Rt: { x: R.x, y: R.y - wallH },
    Bt: { x: B.x, y: B.y - wallH },
    Lt: { x: L.x, y: L.y - wallH },
    apex: { x: cx, y: cy - wallH - roofH },
  };
}

/** Window parallelogram on a wall from `a` to `b` (fractions t0..t1, lifted above ground). */
export function windowQuad(a: Pt, b: Pt, t0: number, t1: number, lift: number): string {
  const x0 = lerp(a.x, b.x, t0);
  const x1 = lerp(a.x, b.x, t1);
  const yb = lerp(a.y, b.y, (t0 + t1) / 2);
  const y1 = lerp(a.y, b.y, t1);
  return `${x0},${yb - lift - 12} ${x1},${y1 - lift - 12} ${x1},${y1 - lift} ${x0},${yb - lift}`;
}

/** Door quad on the front-right wall (B → R), standing on the ground line. */
export function doorQuad(g: IsoGeometry, wallH: number): string {
  const h = Math.min(18, wallH * 0.32);
  const p0 = { x: lerp(g.B.x, g.R.x, 0.42), y: lerp(g.B.y, g.R.y, 0.42) };
  const p1 = { x: lerp(g.B.x, g.R.x, 0.56), y: lerp(g.B.y, g.R.y, 0.56) };
  return pts([p0, p1, { x: p1.x, y: p1.y - h }, { x: p0.x, y: p0.y - h }]);
}
