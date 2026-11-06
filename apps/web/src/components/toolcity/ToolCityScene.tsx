import { BuildingDef, BuildingId, BUILDINGS } from "@/lib/tool-city-demo";

interface ToolCitySceneProps {
  selected: BuildingId | null;
  onSelect: (id: BuildingId) => void;
  workerAt: BuildingId | "plaza";
  busy?: boolean;
}

interface Placement {
  cx: number;
  cy: number;
  hw: number;
  wallH: number;
  roof: "hip" | "flat";
  roofColor: string;
  wallLeft: string;
  wallRight: string;
  chimney?: boolean;
  detail?: "antenna" | "coin" | "dish" | "crates" | "sign";
}

const PLACEMENTS: Record<BuildingId, Placement> = {
  registry: {
    cx: 235,
    cy: 300,
    hw: 95,
    wallH: 102,
    roof: "hip",
    roofColor: "#c97845",
    wallLeft: "#e7d2b0",
    wallRight: "#cbab7d",
    detail: "antenna",
  },
  treasury: {
    cx: 500,
    cy: 264,
    hw: 82,
    wallH: 94,
    roof: "flat",
    roofColor: "#b45a3c",
    wallLeft: "#e3c49c",
    wallRight: "#c79c6e",
    detail: "coin",
  },
  studio: {
    cx: 765,
    cy: 300,
    hw: 100,
    wallH: 96,
    roof: "hip",
    roofColor: "#2f9d8f",
    wallLeft: "#d9eee7",
    wallRight: "#a9cec5",
    detail: "dish",
  },
  home: {
    cx: 235,
    cy: 560,
    hw: 82,
    wallH: 80,
    roof: "hip",
    roofColor: "#b96e4a",
    wallLeft: "#f0e2c7",
    wallRight: "#d7bd94",
    chimney: true,
    detail: "sign",
  },
  archive: {
    cx: 765,
    cy: 560,
    hw: 100,
    wallH: 86,
    roof: "flat",
    roofColor: "#6f8fa8",
    wallLeft: "#d7dfe5",
    wallRight: "#afc0cb",
    detail: "crates",
  },
};

const WORKER_POSITIONS: Record<BuildingId | "plaza", { x: number; y: number }> = {
  registry: { x: 340, y: 366 },
  treasury: { x: 500, y: 366 },
  studio: { x: 646, y: 388 },
  home: { x: 338, y: 590 },
  archive: { x: 650, y: 594 },
  plaza: { x: 500, y: 486 },
};

function pts(points: { x: number; y: number }[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function windowQuad(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t0: number,
  t1: number,
  lift: number,
): string {
  const x0 = lerp(a.x, b.x, t0);
  const x1 = lerp(a.x, b.x, t1);
  const yb = lerp(a.y, b.y, (t0 + t1) / 2);
  return `${x0},${yb - lift - 13} ${x1},${lerp(a.y, b.y, t1) - lift - 13} ${x1},${lerp(a.y, b.y, t1) - lift} ${x0},${yb - lift}`;
}

function IsoBuilding({
  def,
  placement,
  selected,
  onSelect,
}: {
  def: BuildingDef;
  placement: Placement;
  selected: boolean;
  onSelect: () => void;
}) {
  const { cx, cy, hw, wallH, roof, roofColor, wallLeft, wallRight } = placement;
  const hh = hw * 0.5;
  const roofH = roof === "flat" ? 12 : 24 + hw * 0.2;
  const T = { x: cx, y: cy - hh };
  const R = { x: cx + hw, y: cy };
  const B = { x: cx, y: cy + hh };
  const L = { x: cx - hw, y: cy };
  const Tt = { x: T.x, y: T.y - wallH };
  const Rt = { x: R.x, y: R.y - wallH };
  const Bt = { x: B.x, y: B.y - wallH };
  const Lt = { x: L.x, y: L.y - wallH };
  const apex = { x: cx, y: cy - wallH - roofH };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${def.name}: ${def.description}`}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className="tc-building"
      data-selected={selected}
    >
      <title>{`${def.name} — ${def.description}`}</title>

      {selected ? (
        <>
          <ellipse
            cx={cx}
            cy={cy + hh * 0.55}
            rx={hw * 1.34}
            ry={hh * 0.88}
            fill="none"
            stroke={def.accent}
            strokeWidth={3}
            strokeDasharray="10 6"
            className="tc-selection-ring"
          />
          <ellipse
            cx={cx}
            cy={cy + hh * 0.55}
            rx={hw * 1.2}
            ry={hh * 0.72}
            fill={def.accent}
            opacity={0.08}
          />
        </>
      ) : null}

      <ellipse cx={cx} cy={cy + hh * 0.55} rx={hw * 1.05} ry={hh * 0.6} fill="#00000055" />

      <polygon points={pts([L, B, Bt, Lt])} fill={wallLeft} stroke="#0a141a" strokeWidth={2} />
      <polygon points={pts([R, B, Bt, Rt])} fill={wallRight} stroke="#0a141a" strokeWidth={2} />

      {/* Lit windows follow the wall slope. */}
      <polygon points={windowQuad(L, B, 0.16, 0.34, wallH * 0.36)} fill="#f6c76b" opacity={0.92} />
      <polygon points={windowQuad(L, B, 0.58, 0.76, wallH * 0.36)} fill="#f6c76b" opacity={0.55} />
      <polygon points={windowQuad(R, B, 0.16, 0.34, wallH * 0.36)} fill="#f6c76b" opacity={0.82} />
      <polygon points={windowQuad(R, B, 0.58, 0.76, wallH * 0.36)} fill="#f6c76b" opacity={0.72} />

      {/* Door */}
      <polygon
        points={pts([
          { x: cx - 10, y: cy + hh * 0.2 },
          { x: cx + 10, y: cy + hh * 0.08 },
          { x: cx + 10, y: cy + hh * 0.08 - 26 },
          { x: cx - 10, y: cy + hh * 0.2 - 26 },
        ])}
        fill="#2b1d16"
        stroke="#0a141a"
        strokeWidth={1.5}
      />

      {roof === "hip" ? (
        <>
          <polygon points={pts([apex, Lt, Bt])} fill={roofColor} stroke="#0a141a" strokeWidth={2} />
          <polygon
            points={pts([apex, Bt, Rt])}
            fill={roofColor}
            stroke="#0a141a"
            strokeWidth={2}
            opacity={0.78}
          />
          {placement.chimney ? (
            <rect
              x={cx + hw * 0.3}
              y={apex.y + roofH * 0.22}
              width={13}
              height={30}
              fill="#8a7a5c"
              stroke="#0a141a"
              strokeWidth={2}
            />
          ) : null}
        </>
      ) : (
        <>
          <polygon points={pts([Lt, Rt, Bt, Tt])} fill={roofColor} stroke="#0a141a" strokeWidth={2} />
          <polygon
            points={pts([Lt, Bt, B, L])}
            fill={roofColor}
            stroke="#0a141a"
            strokeWidth={1.5}
            opacity={0.72}
          />
        </>
      )}

      {placement.detail === "antenna" ? (
        <>
          <line x1={cx + 28} y1={apex.y + roofH * 0.4} x2={cx + 28} y2={apex.y - 26} stroke="#0a141a" strokeWidth={3} />
          <circle cx={cx + 28} cy={apex.y - 30} r={6} fill="#ffd479" className="tc-blink" />
        </>
      ) : null}
      {placement.detail === "coin" ? (
        <g>
          <ellipse cx={cx} cy={Lt.y - 16} rx={26} ry={10} fill="#f0b35c" stroke="#0a141a" strokeWidth={2} />
          <rect x={cx - 26} y={Lt.y - 0} width={52} height={12} fill="#c78a36" stroke="#0a141a" strokeWidth={2} />
          <text x={cx} y={Lt.y + 2} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize={11} fill="#0a141a">
            USDT
          </text>
        </g>
      ) : null}
      {placement.detail === "dish" ? (
        <g>
          <line x1={cx - 25} y1={apex.y + 18} x2={cx - 25} y2={apex.y - 14} stroke="#0a141a" strokeWidth={3} />
          <ellipse cx={cx - 25} cy={apex.y - 18} rx={17} ry={9} fill="#d9eee7" stroke="#0a141a" strokeWidth={2} />
          <circle cx={cx - 25} cy={apex.y - 18} r={3} fill="#f0b35c" />
        </g>
      ) : null}
      {placement.detail === "crates" ? (
        <g>
          <rect x={cx - 42} y={Lt.y - 20} width={28} height={20} fill="#b98b55" stroke="#0a141a" strokeWidth={2} />
          <rect x={cx - 10} y={Lt.y - 28} width={24} height={28} fill="#c9a06c" stroke="#0a141a" strokeWidth={2} />
        </g>
      ) : null}
      {placement.detail === "sign" ? (
        <g>
          <line x1={cx + hw + 6} y1={cy - 6} x2={cx + hw + 6} y2={cy - 54} stroke="#0a141a" strokeWidth={3} />
          <rect x={cx + hw - 14} y={cy - 54} width={40} height={22} fill="#f0b35c" stroke="#0a141a" strokeWidth={2} />
          <text x={cx + hw + 6} y={cy - 39} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize={9} fill="#0a141a">
            OPEN
          </text>
        </g>
      ) : null}

      <g className="tc-scene-label" transform={`translate(${cx}, ${cy + hh + 25})`}>
        <rect x={-58} y={-11} width={116} height={20} fill="#07151e" opacity={0.82} stroke={selected ? def.accent : "#27424f"} strokeWidth={1} />
        <text x={0} y={3} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize={9} letterSpacing={1.4} fill={selected ? def.accent : "#d8e4ea"}>
          {def.short}
        </text>
      </g>
    </g>
  );
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={-4} y={-18} width={8} height={18} fill="#5a4630" stroke="#0a141a" strokeWidth={1.5} />
      <rect x={-14} y={-38} width={28} height={22} fill="#2f6b55" stroke="#0a141a" strokeWidth={1.5} />
      <rect x={-9} y={-48} width={18} height={14} fill="#3d8366" stroke="#0a141a" strokeWidth={1.5} />
    </g>
  );
}

function Lamp({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-2} y={-34} width={4} height={34} fill="#38515c" />
      <rect x={-7} y={-40} width={14} height={7} fill="#f0b35c" stroke="#0a141a" strokeWidth={1.5} className="tc-blink" />
      <ellipse cx={0} cy={-36} rx={18} ry={8} fill="#f0b35c" opacity={0.1} />
    </g>
  );
}

export function ToolCityScene({ selected, onSelect, workerAt, busy = false }: ToolCitySceneProps) {
  const worker = WORKER_POSITIONS[workerAt];

  return (
    <div className="game-canvas tc-scene" aria-label="Isometric Tool City translation district">
      <svg
        viewBox="0 0 1000 700"
        role="img"
        aria-label="Tool City neighbourhood: Registry Hall, Treasury and Translation Studio behind a plaza, with Creator's Home and the Archive in front."
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="tc-sky" cx="50%" cy="34%" r="78%">
            <stop offset="0%" stopColor="#1b3f4d" />
            <stop offset="52%" stopColor="#0d2531" />
            <stop offset="100%" stopColor="#06131b" />
          </radialGradient>
          <linearGradient id="tc-horizon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d7180" stopOpacity="0" />
            <stop offset="100%" stopColor="#2d7180" stopOpacity="0.26" />
          </linearGradient>
          <pattern id="tc-grid" width="64" height="32" patternUnits="userSpaceOnUse">
            <path d="M0 16 L32 0 L64 16 L32 32 Z" fill="none" stroke="#2f6270" strokeWidth="1" opacity="0.55" />
          </pattern>
          <pattern id="tc-road" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
            <rect width="26" height="26" fill="#1a303a" />
            <rect y="11" width="26" height="4" fill="#233f4b" />
          </pattern>
          <linearGradient id="tc-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0b35c" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#f0b35c" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="1000" height="700" fill="url(#tc-sky)" />
        <ellipse cx="500" cy="330" rx="500" ry="300" fill="url(#tc-horizon)" />

        {/* Stars and a distant skyline keep the empty sky from reading flat. */}
        <g fill="#cfe7ef">
          {[
            [92, 92, 1.6],
            [188, 56, 1.1],
            [296, 108, 1.3],
            [432, 48, 1],
            [604, 74, 1.4],
            [718, 44, 1.1],
            [836, 102, 1.6],
            [918, 62, 1.2],
            [372, 132, 0.9],
            [660, 132, 1],
          ].map(([x, y, r], index) => (
            <circle key={index} cx={x} cy={y} r={r} opacity={0.65} className="tc-star" style={{ animationDelay: `${index * 240}ms` }} />
          ))}
        </g>

        {/* Distant blocks. */}
        <g opacity="0.5" fill="#0d222c" stroke="#173642" strokeWidth="1">
          <rect x="20" y="282" width="58" height="86" />
          <rect x="88" y="304" width="38" height="64" />
          <rect x="890" y="270" width="64" height="98" />
          <rect x="844" y="304" width="40" height="64" />
        </g>

        {/* Ground and isometric grid. */}
        <rect x="0" y="360" width="1000" height="340" fill="#0c2028" />
        <rect x="0" y="360" width="1000" height="340" fill="url(#tc-grid)" opacity="0.26" />
        <ellipse cx="500" cy="470" rx="420" ry="170" fill="#12323a" opacity="0.65" />

        {/* Streets. */}
        <polygon points="0,492 1000,414 1000,478 0,558" fill="url(#tc-road)" stroke="#0a141a" strokeWidth="2" />
        <polygon points="430,150 486,150 566,700 504,700" fill="url(#tc-road)" stroke="#0a141a" strokeWidth="2" />
        <polygon points="0,492 1000,414 1000,420 0,498" fill="#355b63" opacity="0.6" />
        <polygon points="430,150 436,150 516,700 510,700" fill="#355b63" opacity="0.5" />
        <g stroke="#e9c987" strokeWidth="3" strokeDasharray="12 14" opacity="0.4">
          <line x1="0" y1="526" x2="1000" y2="448" />
          <line x1="466" y1="150" x2="536" y2="700" />
        </g>

        {/* Plaza with a small fountain. */}
        <ellipse cx="500" cy="462" rx="132" ry="58" fill="#17353f" stroke="#355b63" strokeWidth="3" />
        <ellipse cx="500" cy="458" rx="104" ry="43" fill="#102a33" stroke="#2b5059" strokeWidth="2" />
        <ellipse cx="500" cy="456" rx="42" ry="17" fill="#1d5663" stroke="#5fd0bd" strokeWidth="2" />
        <rect x="496" y="424" width="8" height="30" fill="#5fd0bd" opacity="0.8" />
        <circle cx="500" cy="420" r="5" fill="#9ef0e2" className="tc-blink" />
        <g stroke="#5fd0bd" strokeWidth="1.5" opacity="0.55">
          <line x1="466" y1="446" x2="534" y2="446" />
          <line x1="474" y1="454" x2="526" y2="454" />
        </g>

        <Tree x={70} y={470} scale={1.1} />
        <Tree x={930} y={500} scale={1.2} />
        <Tree x={352} y={188} scale={0.8} />
        <Tree x={650} y={196} scale={0.85} />
        <Lamp x={398} y={476} />
        <Lamp x={602} y={454} />
        <Lamp x={160} y={614} />
        <Lamp x={846} y={618} />

        {/* Brand sign above the Treasury tower. Kept inside the central safe
            band so 16:9 slice cropping does not clip it. */}
        <g transform="translate(500, 100)" opacity="0.94">
          <rect x={-166} y={-24} width={332} height={48} fill="#07151e" stroke="#2f6270" strokeWidth={2} />
          <rect x={-160} y={-19} width={320} height={38} fill="none" stroke="#f0b35c" strokeWidth={1} opacity="0.35" />
          <text
            x={0}
            y={-1}
            textAnchor="middle"
            fontFamily="Space Mono, monospace"
            fontSize={22}
            fontWeight="700"
            letterSpacing={8}
            fill="#f0b35c"
          >
            TOOL CITY
          </text>
          <text
            x={0}
            y={14}
            textAnchor="middle"
            fontFamily="Space Mono, monospace"
            fontSize={7}
            letterSpacing={4}
            fill="#8fb8c8"
          >
            TRANSLATION DISTRICT · BLOCK 01
          </text>
        </g>

        {/* Back-to-front building order. */}
        {[...BUILDINGS]
          .sort((a, b) => PLACEMENTS[a.id].cy - PLACEMENTS[b.id].cy)
          .map((def) => (
            <IsoBuilding
              key={def.id}
              def={def}
              placement={PLACEMENTS[def.id]}
              selected={selected === def.id}
              onSelect={() => onSelect(def.id)}
            />
          ))}

        {/* The document worker. */}
        <g
          transform={`translate(${worker.x} ${worker.y})`}
          className={`tc-worker${busy ? " tc-worker--busy" : ""}`}
          role="img"
          aria-label={
            busy
              ? "Document worker carrying a translation between city buildings."
              : "Document worker waiting in the plaza."
          }
        >
          <ellipse cx={0} cy={0} rx={14} ry={5} fill="#00000066" />
          <rect x={-4} y={-8} width={3.5} height={9} fill="#3b2c21" />
          <rect x={1} y={-8} width={3.5} height={9} fill="#3b2c21" />
          <rect x={-7} y={-24} width={14} height={17} fill="#e8d6b0" stroke="#0a141a" strokeWidth={1.5} />
          <rect x={-5.5} y={-36} width={11} height={11} fill="#f0b35c" stroke="#0a141a" strokeWidth={1.5} />
          <rect x={-7.5} y={-38} width={15} height={4} fill="#b96e4a" stroke="#0a141a" strokeWidth={1.5} />
          <rect x={8} y={-33} width={10} height={13} fill="#f7f1df" stroke="#0a141a" strokeWidth={1.5} />
          <line x1={9.5} y1={-29} x2={16.5} y2={-29} stroke="#5a6f77" strokeWidth={1} />
          <line x1={9.5} y1={-26} x2={15} y2={-26} stroke="#5a6f77" strokeWidth={1} />
          {busy ? <circle cx={0} cy={-48} r={7} fill="#5fd0bd" opacity={0.18} className="tc-pulse" /> : null}
        </g>
      </svg>
    </div>
  );
}

export default ToolCityScene;
