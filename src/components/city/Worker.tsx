"use client";
// Document worker: one small courier figure gliding between fixed waypoints.
// Movement is a short CSS transition on transform; it never sets server state.
interface WorkerProps {
  x: number;
  y: number;
  parcel: boolean;
  unresolved: boolean;
  note: string;
}

export default function Worker({ x, y, parcel, unresolved, note }: WorkerProps) {
  return (
    <g className="tc-worker" style={{ transform: `translate(${x}px, ${y}px)` }} role="img" aria-label={note}>
      <title>{note}</title>
      <ellipse cx={0} cy={0} rx={11} ry={4.5} fill="#00000030" />
      {/* legs */}
      <line x1={-3} y1={-10} x2={-3} y2={-1} stroke="#4a3b2c" strokeWidth={3.5} strokeLinecap="round" />
      <line x1={3} y1={-10} x2={3} y2={-1} stroke="#4a3b2c" strokeWidth={3.5} strokeLinecap="round" />
      {/* coat */}
      <rect x={-7} y={-24} width={14} height={15} rx={5} fill="#8a5a3b" stroke="#5c3a22" strokeWidth={1.5} />
      {/* carried document */}
      <rect x={8} y={-26} width={11} height={14} rx={1.5} fill="#fdfbf3" stroke="#5c564a" strokeWidth={1.5} />
      <line x1={10.5} y1={-22} x2={17} y2={-22} stroke="#9a917f" strokeWidth={1.2} />
      <line x1={10.5} y1={-18.5} x2={17} y2={-18.5} stroke="#9a917f" strokeWidth={1.2} />
      {/* head */}
      <circle cx={0} cy={-30} r={6.5} fill="#e8b98a" stroke="#8a5a3b" strokeWidth={1.5} />
      {/* delivered parcel */}
      {parcel && (
        <g>
          <rect x={-26} y={-12} width={15} height={12} fill="#a8703a" stroke="#5c3a22" strokeWidth={1.5} />
          <line x1={-18.5} y1={-12} x2={-18.5} y2={0} stroke="#e8c33a" strokeWidth={2} />
        </g>
      )}
      {/* unresolved badge */}
      {unresolved && (
        <g>
          <circle cx={13} cy={-38} r={8} fill="#e8a33a" stroke="#7a4d0e" strokeWidth={1.5} />
          <text x={13} y={-34} textAnchor="middle" fontSize={11} fontWeight={800} fill="#3d2c05">
            !
          </text>
        </g>
      )}
    </g>
  );
}
