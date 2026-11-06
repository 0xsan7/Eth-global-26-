"use client";
// CityScene: React + SVG + CSS neighbourhood. Five buildings plus one worker.
// Back-to-front render, keyboard-accessible building buttons, text alternatives.
import IsoBuilding from "./IsoBuilding";
import Worker from "./Worker";
import type { SceneTarget } from "./job-state-to-scene";
import { BUILDINGS_BACK_TO_FRONT, VIEWBOX, type BuildingId } from "./scene-config";

interface CitySceneProps {
  selected: BuildingId | null;
  onSelect: (b: BuildingId) => void;
  scene: SceneTarget;
  jobStatusLabel: string | null;
}

export default function CityScene({ selected, onSelect, scene, jobStatusLabel }: CitySceneProps) {
  return (
    <div>
      {/* Keyboard-accessible building navigation (buttons). */}
      <nav className="city-toolbar" aria-label="City buildings">
        {BUILDINGS_BACK_TO_FRONT.map((b) => (
          <button
            key={b.id}
            type="button"
            className="btn"
            aria-pressed={selected === b.id}
            onClick={() => onSelect(b.id)}
          >
            {b.name}
          </button>
        ))}
      </nav>
      <div className="city-frame">
        <svg
          viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
          role="img"
          aria-label="Tool City neighbourhood map. Five buildings around paved streets with one document worker."
        >
          <desc>
            {`Registry Hall, Treasury and Translation Studio stand at the back; Creator's Home and the Archive at the front. `}
            {scene.note}
            {jobStatusLabel ? ` Current job status: ${jobStatusLabel}.` : " No active job."}
          </desc>
          {/* terrain */}
          <rect x={0} y={0} width={VIEWBOX.w} height={VIEWBOX.h} fill="#9db38a" />
          <ellipse cx={110} cy={330} rx={120} ry={60} fill="#8aa176" />
          <ellipse cx={560} cy={90} rx={140} ry={70} fill="#8aa176" />
          {/* streets: warm paving */}
          <rect x={0} y={228} width={VIEWBOX.w} height={38} fill="#d9c39a" />
          <rect x={0} y={228} width={VIEWBOX.w} height={4} fill="#bfa171" />
          <rect x={0} y={262} width={VIEWBOX.w} height={4} fill="#bfa171" />
          <rect x={300} y={110} width={44} height={252} fill="#d9c39a" />
          <rect x={300} y={110} width={4} height={252} fill="#bfa171" />
          <rect x={340} y={110} width={4} height={252} fill="#bfa171" />
          <ellipse cx={320} cy={322} rx={72} ry={30} fill="#d9c39a" stroke="#bfa171" strokeWidth={3} />
          {/* buildings back-to-front */}
          {BUILDINGS_BACK_TO_FRONT.map((b) => (
            <IsoBuilding
              key={b.id}
              def={b}
              selected={selected === b.id}
              onSelect={() => onSelect(b.id)}
              chimney={b.id === "home"}
              finial={b.id === "treasury"}
              wallLeft={b.id === "studio" ? "#e8f1ee" : undefined}
              wallRight={b.id === "studio" ? "#cfe0da" : undefined}
            />
          ))}
          <Worker x={scene.x} y={scene.y} parcel={scene.parcel} unresolved={scene.unresolved} note={scene.note} />
        </svg>
      </div>
      <p className="city-caption" role="status">
        {scene.note}
      </p>
      {/* Text alternative for the whole scene. */}
      <ul className="sr-only">
        {BUILDINGS_BACK_TO_FRONT.map((b) => (
          <li key={b.id}>
            {b.name}: {b.description}
          </li>
        ))}
        <li>{scene.note}</li>
      </ul>
    </div>
  );
}
