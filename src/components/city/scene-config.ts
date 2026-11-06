// City scene configuration — positions, streets and waypoints.
// Original fixed geometry for the Tool City neighbourhood (SVG viewBox 640x420).
// No game engine, no pathfinding: the worker jumps between fixed waypoints.

export type BuildingId = "registry" | "home" | "treasury" | "studio" | "archive";

export interface Waypoint {
  x: number;
  y: number;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  /** Ground-center in SVG pixels. */
  cx: number;
  cy: number;
  /** Half footprint width in px (diamond half-depth is hw/2). */
  hw: number;
  /** Wall height in px. */
  wallH: number;
  roof: "hip" | "flat";
  roofColor: string;
  description: string;
  /** Street-adjacent point where the document worker stands. */
  waypoint: Waypoint;
}

export const VIEWBOX = { w: 640, h: 420 } as const;

/** Plaza waypoint used when no job is active. */
export const PLAZA: Waypoint = { x: 320, y: 322 };

export const BUILDINGS: BuildingDef[] = [
  {
    id: "registry",
    name: "Registry Hall",
    cx: 150,
    cy: 150,
    hw: 70,
    wallH: 64,
    roof: "hip",
    roofColor: "#c96f4a",
    description: "Workshop discovery from the Arkiv listing.",
    waypoint: { x: 150, y: 232 },
  },
  {
    id: "treasury",
    name: "Treasury",
    cx: 330,
    cy: 128,
    hw: 58,
    wallH: 74,
    roof: "hip",
    roofColor: "#b85c38",
    description: "Fixed checkout terms and payment receipt.",
    waypoint: { x: 330, y: 212 },
  },
  {
    id: "studio",
    name: "Translation Studio",
    cx: 498,
    cy: 158,
    hw: 64,
    wallH: 58,
    roof: "hip",
    roofColor: "#2a9d8f",
    description: "Private translation runs and reported evidence.",
    waypoint: { x: 498, y: 240 },
  },
  {
    id: "home",
    name: "Creator's Home",
    cx: 132,
    cy: 298,
    hw: 50,
    wallH: 44,
    roof: "hip",
    roofColor: "#c96f4a",
    description: "Draft preparation and delivered result review.",
    waypoint: { x: 132, y: 252 },
  },
  {
    id: "archive",
    name: "Archive",
    cx: 488,
    cy: 298,
    hw: 70,
    wallH: 50,
    roof: "flat",
    roofColor: "#c96f4a",
    description: "Saved jobs and settlement records.",
    waypoint: { x: 488, y: 250 },
  },
];

/** Back-to-front render order (painter's algorithm on ground depth). */
export const BUILDINGS_BACK_TO_FRONT: BuildingDef[] = [...BUILDINGS].sort((a, b) => a.cy - b.cy);

export const BUILDING_BY_ID: Record<BuildingId, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b]),
) as Record<BuildingId, BuildingDef>;
