// Pure mapper from persisted BriefMint state to city scene targets.
// Never performs network I/O, never sets server state, has no timers.
// Preserves the five-building geometry; only the building roles change:
// Home = private intake, Studio = compilation, Treasury/Release Desk = approval,
// Registry = publication, Archive = private recovery.
import type { PrivateBrief } from "@/lib/shared/briefmint";
import type { BuildingId } from "./scene-config";
import { BUILDING_BY_ID, PLAZA } from "./scene-config";

export interface BriefSceneTarget {
  building: BuildingId | null;
  x: number;
  y: number;
  parcel: boolean;
  unresolved: boolean;
  note: string;
}

export function briefStateToScene(brief: PrivateBrief | null): BriefSceneTarget {
  if (!brief) {
    return {
      building: null,
      x: PLAZA.x,
      y: PLAZA.y,
      parcel: false,
      unresolved: false,
      note: "No active brief. Enter private notes at the Creator's Home.",
    };
  }
  const at = (id: BuildingId) => ({ x: BUILDING_BY_ID[id].waypoint.x, y: BUILDING_BY_ID[id].waypoint.y });
  // Failed work stays visibly unresolved; never auto-cleared by animation.
  if (brief.executionStatus === "failed" || brief.executionStatus === "interrupted") {
    return {
      building: "studio",
      ...at("studio"),
      parcel: false,
      unresolved: true,
      note: "Brief compilation visibly unresolved at the AI Studio — check retry eligibility.",
    };
  }
  if (brief.executionStatus === "draft" || brief.executionStatus === "running") {
    return brief.executionStatus === "draft"
      ? {
          building: "home",
          ...at("home"),
          parcel: false,
          unresolved: false,
          note: "Editable private input at the Creator's Home.",
        }
      : {
          building: "studio",
          ...at("studio"),
          parcel: false,
          unresolved: false,
          note: "Compilation running at the AI Studio — worker waits, status polls the saved record.",
        };
  }
  // ready
  if (brief.reviewStatus !== "approved") {
    return {
      building: "treasury",
      ...at("treasury"),
      parcel: false,
      unresolved: false,
      note: "Compiled brief ready — review the exact public preview at the Release Desk.",
    };
  }
  const pub = brief.publication.lastObservedStatus;
  if (pub === "pending") {
    return {
      building: "registry",
      ...at("registry"),
      parcel: false,
      unresolved: false,
      note: "Publication submitted — the worker waits at the Registry while confirmation is reconciled.",
    };
  }
  if (pub === "live") {
    return {
      building: "registry",
      ...at("registry"),
      parcel: false,
      unresolved: false,
      note: "Opportunity live on Arkiv — confirmed at the Registry.",
    };
  }
  if (pub === "closed" || pub === "expired") {
    return {
      building: "registry",
      ...at("registry"),
      parcel: false,
      unresolved: false,
      note: `Opportunity ${pub} — record remains readable until native expiry.`,
    };
  }
  // approved but unpublished
  return {
    building: "archive",
    ...at("archive"),
    parcel: true,
    unresolved: false,
    note: "Approved private brief saved — reopen it from the Archive.",
  };
}
