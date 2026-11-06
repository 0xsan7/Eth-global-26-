// Pure, serializable mapping from persisted BriefMint state to city visuals
// (PRD §5 worker mapping, §10 state model, BM-15 truthful city).
// No React, timers, randomness or I/O. Animation code may only READ this output.
import type {
  BriefFreshness,
  BriefView,
  ExecutionStatus,
  PublicationStatus,
  ReviewStatus,
} from "@/lib/shared/briefmint";
import type { BuildingId } from "./scene-config";

export interface CityStateInput {
  briefId: string | null;
  /** null = no saved brief. */
  execution: ExecutionStatus | null;
  review: ReviewStatus;
  /** Approval is bound to the current draft revision (edits make this false). */
  approvalCurrent: boolean;
  publication: PublicationStatus;
  /** Entity key, expiry block and an observation are all recorded. A tx hash alone is not enough. */
  publicationConfirmed: boolean;
  freshness: BriefFreshness;
  observedAt: string | null;
  /** Saved private result reopened for reading (no caller sets this yet). */
  reopened: boolean;
}

export type WorkerPose = "idle" | "working" | "waiting" | "stalled";
export type WorkerCarry = "none" | "notes" | "brief";
export type StudioVisual = "idle" | "running" | "failed" | "interrupted";
export type ReleaseVisual = "idle" | "awaiting" | "approved";
export type RegistryVisual = "none" | "pending" | "live" | "closed" | "expired" | "stale" | "unavailable";

export type QuestKind = "action" | "wait" | "warn";

export interface CityState {
  briefId: string | null;
  /** Game-style marker over the building where the next real step happens. */
  quest: { building: BuildingId; kind: QuestKind } | null;
  worker: { building: BuildingId | null; pose: WorkerPose; carry: WorkerCarry; unresolved: boolean };
  planning: { lit: boolean; privateParcel: boolean };
  studio: StudioVisual;
  release: ReleaseVisual;
  registry: RegistryVisual;
  /** Last confirmed publication status, used for stale/unavailable wording. */
  registryLastConfirmed: PublicationStatus;
  registryObservedAt: string | null;
  archive: { boxes: boolean };
  statusText: string;
}

export const NO_BRIEF_INPUT: CityStateInput = {
  briefId: null,
  execution: null,
  review: "unreviewed",
  approvalCurrent: false,
  publication: "unpublished",
  publicationConfirmed: false,
  freshness: "fresh",
  observedAt: null,
  reopened: false,
};

export function cityInputFromBrief(brief: BriefView | null, opts: { reopened?: boolean } = {}): CityStateInput {
  if (!brief) return NO_BRIEF_INPUT;
  const pub = brief.publication;
  const approved = brief.review.status === "approved" && brief.review.approval !== null;
  return {
    briefId: brief.id,
    execution: brief.executionStatus,
    review: brief.review.status,
    approvalCurrent: approved && brief.review.approval !== null && brief.review.approval.draftRevision === brief.draftRevision,
    publication: pub.status,
    publicationConfirmed: Boolean(pub.confirmed?.entityKey && pub.confirmed?.expiresAtBlock && pub.confirmed?.observedAt),
    freshness: pub.freshness,
    observedAt: pub.confirmed?.observedAt ?? null,
    reopened: opts.reopened ?? false,
  };
}

function registryVisual(i: CityStateInput): RegistryVisual {
  // "live" without reconciled entity evidence is still waiting, never live.
  const pub = i.publication === "live" && !i.publicationConfirmed ? "pending" : i.publication;
  if (pub === "unpublished") return "none";
  if (pub === "pending") return "pending";
  // A failed read never proves closure or expiry.
  if (i.freshness === "unavailable") return "unavailable";
  if (i.freshness === "stale") return "stale";
  return pub;
}

function registryText(v: RegistryVisual, last: PublicationStatus): string {
  switch (v) {
    case "pending":
      return "Publication is waiting for confirmation at the Registry Hall. It is not live until the Arkiv record is confirmed.";
    case "live":
      return "Opportunity is live on Arkiv, confirmed at the Registry Hall.";
    case "closed":
      return "Opportunity is closed on Arkiv. The private brief remains available.";
    case "expired":
      return "Opportunity has expired on Arkiv, confirmed by query. The private brief remains available.";
    case "stale":
      return `Registry read is stale. Last confirmed status: ${last}. This is not closure or expiry.`;
    case "unavailable":
      return `Registry read is unavailable. Last confirmed status: ${last}. This is not closure or expiry.`;
    default:
      return "";
  }
}

function questFor(i: CityStateInput, registry: RegistryVisual, approved: boolean): CityState["quest"] {
  switch (i.execution) {
    case null:
      return { building: "home", kind: "action" };
    case "draft":
      return { building: "studio", kind: "action" };
    case "running":
      return null;
    case "failed":
    case "interrupted":
      return { building: "studio", kind: "warn" };
  }
  if (registry === "pending") return { building: "registry", kind: "wait" };
  if (registry === "stale" || registry === "unavailable") return { building: "registry", kind: "warn" };
  if (i.reopened) return null;
  if (!approved) return { building: "treasury", kind: "action" };
  if (registry === "none") return { building: "registry", kind: "action" };
  return null;
}

export function deriveCityState(i: CityStateInput): CityState {
  const registry = registryVisual(i);
  const approved = i.execution === "ready" && i.review === "approved" && i.approvalCurrent;
  const base = {
    briefId: i.briefId,
    quest: questFor(i, registry, approved),
    planning: { lit: i.execution === "draft", privateParcel: i.execution !== null },
    studio: (i.execution === "running" || i.execution === "failed" || i.execution === "interrupted"
      ? i.execution
      : "idle") as StudioVisual,
    release: (i.execution !== "ready" ? "idle" : approved ? "approved" : "awaiting") as ReleaseVisual,
    registry,
    registryLastConfirmed: i.publication,
    registryObservedAt: i.observedAt,
    archive: { boxes: i.execution !== null },
  };
  const w = (
    building: BuildingId | null,
    pose: WorkerPose,
    carry: WorkerCarry,
    statusText: string,
    unresolved = false,
  ): CityState => ({ ...base, worker: { building, pose, carry, unresolved }, statusText });

  switch (i.execution) {
    case null:
      return w("home", "idle", "none", "No active brief. Save private notes at the Planning Desk to start.");
    case "failed":
    case "interrupted":
      return w(
        "studio",
        "stalled",
        "none",
        `Compilation ${i.execution === "failed" ? "failed" : "was interrupted"} at the AI Studio and is unresolved. Open the AI Studio panel for the error and retry eligibility.`,
        true,
      );
    case "draft":
      return w("home", "working", "notes", "Private brief saved as a draft at the Planning Desk. Compilation has not started.");
    case "running":
      return w(
        "studio",
        "working",
        "none",
        "Compilation is running at the AI Studio. Status comes from the saved record; no time estimate is available.",
      );
    case "ready":
      break;
  }

  if (registry === "pending") return w("registry", "waiting", "brief", registryText(registry, i.publication));
  if (i.reopened) {
    return w("archive", "idle", "none", "Saved private brief reopened from the Archive. Nothing was recompiled.");
  }
  if (!approved) {
    const older =
      registry === "none"
        ? ""
        : " The previously published revision stays unchanged until you approve and sign an update.";
    return w(
      "treasury",
      "working",
      "none",
      `Compiled brief is ready. Review the public preview and approve the exact revision at the Release Desk.${older}`,
    );
  }
  if (registry !== "none") return w("registry", "idle", "none", registryText(registry, i.publication));
  return w("treasury", "idle", "brief", "The current revision is approved at the Release Desk. Nothing is published yet.");
}
