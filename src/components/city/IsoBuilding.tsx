"use client";
// Reusable isometric building: one diamond footprint, two visible walls,
// one hip/flat roof. Original geometry rendered with React + SVG only.
import type { BuildingDef } from "./scene-config";

interface IsoBuildingProps {
  def: BuildingDef;
  selected: boolean;
  onSelect: () => void;
  wallLeft?: string;
  wallRight?: string;
  chimney?: boolean;
  finial?: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function IsoBuilding({
  def,
  selected,
  onSelect,
  wallLeft = "#f3e6cf",
  wallRight = "#e2cba4",
  chimney = false,
  finial = false,
}: IsoBuildingProps) {
  const { cx, cy, hw, wallH, roof, roofColor } = def;
  const hh = hw * 0.5;
  const roofH = roof === "flat" ? 10 : 24 + hw * 0.2;

  // Ground diamond corners
  const T = { x: cx, y: cy - hh };
  const R = { x: cx + hw, y: cy };
  const B = { x: cx, y: cy + hh };
  const L = { x: cx - hw, y: cy };
  // Wall-top corners
  const Tt = { x: T.x, y: T.y - wallH };
  const Rt = { x: R.x, y: R.y - wallH };
  const Bt = { x: B.x, y: B.y - wallH };
  const Lt = { x: L.x, y: L.y - wallH };
  const apex = { x: cx, y: cy - wallH - roofH };

  const pts = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  // Window quads on each visible wall (parallelograms following the wall slope)
  const win = (a: { x: number; y: number }, b: { x: number; y: number }, t0: number, t1: number, lift: number) => {
    const x0 = lerp(a.x, b.x, t0);
    const x1 = lerp(a.x, b.x, t1);
    const yb = lerp(a.y, b.y, (t0 + t1) / 2);
    return `${x0},${yb - lift - 12} ${x1},${lerp(a.y, b.y, t1) - lift - 12} ${x1},${lerp(a.y, b.y, t1) - lift} ${x0},${yb - lift}`;
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${def.name}: ${def.description}`}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      style={{ cursor: "pointer" }}
    >
      <title>{`${def.name} — ${def.description}`}</title>
      {/* ground shadow */}
      <ellipse cx={cx} cy={cy + hh * 0.55} rx={hw * 1.05} ry={hh * 0.6} fill="#00000022" />
      {selected && (
        <ellipse
          cx={cx}
          cy={cy + hh * 0.55}
          rx={hw * 1.18}
          ry={hh * 0.78}
          fill="none"
          stroke="#1a5fb4"
          strokeWidth={3}
          strokeDasharray="8 4"
        />
      )}
      {/* left + right walls */}
      <polygon points={pts([L, B, Bt, Lt])} fill={wallLeft} stroke="#8a7a5c" strokeWidth={1.5} />
      <polygon points={pts([R, B, Bt, Rt])} fill={wallRight} stroke="#8a7a5c" strokeWidth={1.5} />
      {/* windows */}
      <polygon points={win(L, B, 0.18, 0.38, wallH * 0.35)} fill="#3d5a6c" />
      <polygon points={win(L, B, 0.6, 0.8, wallH * 0.35)} fill="#3d5a6c" />
      <polygon points={win(R, B, 0.18, 0.38, wallH * 0.35)} fill="#3d5a6c" />
      <polygon points={win(R, B, 0.6, 0.8, wallH * 0.35)} fill="#3d5a6c" />
      {roof === "hip" ? (
        <>
          {/* visible roof slopes: left + front-right */}
          <polygon points={pts([apex, Lt, Bt])} fill={roofColor} stroke="#6e3a22" strokeWidth={1.5} />
          <polygon points={pts([apex, Bt, Rt])} fill={roofColor} stroke="#6e3a22" strokeWidth={1.5} filter="brightness(0.88)" />
          {finial && (
            <>
              <line x1={apex.x} y1={apex.y} x2={apex.x} y2={apex.y - 14} stroke="#b98a1d" strokeWidth={3} />
              <circle cx={apex.x} cy={apex.y - 17} r={5} fill="#e8c33a" stroke="#7a5c0e" strokeWidth={1.5} />
            </>
          )}
          {chimney && (
            <rect
              x={cx + hw * 0.28}
              y={apex.y + roofH * 0.25}
              width={12}
              height={26}
              fill="#8a7a5c"
              stroke="#5c564a"
              strokeWidth={1.5}
            />
          )}
        </>
      ) : (
        <>
          {/* flat slab */}
          <polygon points={pts([Lt, Rt, Bt, Tt])} fill={roofColor} stroke="#6e3a22" strokeWidth={1.5} />
          <polygon points={pts([Lt, Bt, B, L])} fill={roofColor} stroke="#6e3a22" strokeWidth={1} filter="brightness(0.85)" />
        </>
      )}
      {/* readable nameplate */}
      <text x={cx} y={cy + hh + 22} className="nameplate">
        {def.name}
      </text>
    </g>
  );
}
