// Key building geometry in game-world pixels (pure; shared by the Pixi engine
// and the HTML hit layer, so the hit layer never imports the engine).
import { isoGeometry } from "./iso-geometry";
import { KEY_PLOTS, TILE_H, TILE_W, toWorld } from "./iso-layout";
import { BUILDING_BY_ID, type BuildingDef, type BuildingId } from "./scene-config";

const WALL_SCALE = 1.25;

export function keyBuildingDef(id: BuildingId): BuildingDef {
  const base = BUILDING_BY_ID[id];
  const p = KEY_PLOTS[id];
  const c = toWorld({ gx: p.gx + p.size / 2, gy: p.gy + p.size / 2 });
  const hw = (p.size * TILE_W) / 2;
  void TILE_H;
  return { ...base, cx: c.x, cy: c.y, hw, wallH: Math.round(base.wallH * WALL_SCALE) };
}

/** Screen-space box (world px) covering the building, its quest marker and nameplate. */
export function keyBuildingBox(id: BuildingId): { left: number; top: number; width: number; height: number } {
  const def = keyBuildingDef(id);
  const g = isoGeometry(def);
  const top = g.apex.y - 34;
  const bottom = def.cy + g.hh + 30;
  return { left: def.cx - def.hw, top, width: def.hw * 2, height: bottom - top };
}
