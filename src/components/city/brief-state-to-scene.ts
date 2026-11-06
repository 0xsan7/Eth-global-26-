// Adapter from a persisted PrivateBrief to the city scene target.
// All decisions live in the pure `deriveCityState`; this only resolves positions.
import type { PrivateBrief } from "@/lib/shared/briefmint";
import { cityInputFromBrief, deriveCityState, type CityState } from "./city-state";
import type { BuildingId } from "./scene-config";
import { BUILDING_BY_ID, PLAZA } from "./scene-config";

export interface BriefSceneTarget {
  building: BuildingId | null;
  x: number;
  y: number;
  parcel: boolean;
  unresolved: boolean;
  note: string;
  city: CityState;
}

export function sceneFromCityState(city: CityState): BriefSceneTarget {
  const at = city.worker.building ? BUILDING_BY_ID[city.worker.building].waypoint : PLAZA;
  return {
    building: city.worker.building,
    x: at.x,
    y: at.y,
    parcel: city.worker.carry !== "none",
    unresolved: city.worker.unresolved,
    note: city.statusText,
    city,
  };
}

export function briefStateToScene(brief: PrivateBrief | null): BriefSceneTarget {
  return sceneFromCityState(deriveCityState(cityInputFromBrief(brief)));
}
