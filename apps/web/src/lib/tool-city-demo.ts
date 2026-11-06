// Shared city geometry and legacy component types. The mounted BriefMint app uses
// persisted API state and never imports the demo jobs below as live data.

export type BuildingId = "registry" | "home" | "treasury" | "studio" | "archive";

export interface BuildingDef {
  id: BuildingId;
  name: string;
  short: string;
  description: string;
  accent: string;
  hint: string;
  statLabel: string;
  statValue: string;
  actionLabel: string;
}

export interface WorkshopListing {
  id: string;
  code: string;
  title: string;
  owner: string;
  sourceLang: "en";
  targetLang: "hi";
  /** Display pair for the board; previews may show a different target script. */
  pairLabel: string;
  priceAtomic: string;
  priceLabel: string;
  freshness: "fresh" | "stale";
  supported: boolean;
  description: string;
  termsHash: string;
  serviceId: string;
}

export type JobStatus =
  | "awaiting_payment"
  | "paid"
  | "running"
  | "ready"
  | "failed";

export interface JobSegment {
  id: string;
  text: string;
}

export interface TranslationSegment {
  id: string;
  text: string;
}

export interface ToolJob {
  id: string;
  title: string;
  status: JobStatus;
  source: string;
  sourceSegments: JobSegment[];
  translation: TranslationSegment[] | null;
  edited: TranslationSegment[] | null;
  createdAt: string;
  updatedAt: string;
  costLabel: string;
  txHash: string | null;
  modelId: string | null;
  requestId: string | null;
  routerTeeVerified: boolean | null;
  attemptsUsed: number;
}

export const WORKSHOP: WorkshopListing = {
  id: "hindi-translation-works",
  code: "HIN",
  title: "Hindi Translation Works",
  owner: "0x7A4f…91F2",
  sourceLang: "en",
  targetLang: "hi",
  pairLabel: "EN → HI",
  priceAtomic: "1000000",
  priceLabel: "1.00 USDT",
  freshness: "fresh",
  supported: true,
  description:
    "Private English to Hindi translation for short civic notices and shop copy. Source-aligned review, editable output, two dispatch attempts.",
  termsHash: "0x9e13…6b02",
  serviceId: "0x44c1…0d7a",
};

export const TERMINAL_WORKSHOPS: WorkshopListing[] = [
  WORKSHOP,
  {
    ...WORKSHOP,
    id: "marathi-preview",
    code: "MAR",
    title: "Marathi Preview",
    targetLang: "hi",
    pairLabel: "EN → MR",
    freshness: "stale",
    supported: false,
    description: "Not published in this demo. Shown to mark the next workshop bay.",
  },
  {
    ...WORKSHOP,
    id: "tamil-preview",
    code: "TAM",
    title: "Tamil Preview",
    targetLang: "hi",
    pairLabel: "EN → TA",
    freshness: "stale",
    supported: false,
    description: "Not published in this demo. Shown to mark the next workshop bay.",
  },
];

export const BUILDINGS: BuildingDef[] = [
  {
    id: "registry",
    name: "Registry Hall",
    short: "REG",
    description: "Public Arkiv opportunity discovery and confirmed publication observation.",
    accent: "#f0b35c",
    hint: "arkiv · discovery",
    statLabel: "listing",
    statValue: "fresh",
    actionLabel: "Open workshop board",
  },
  {
    id: "home",
    name: "Creator's Home",
    short: "HOME",
    description: "Private notes and deliberate public parameters for a new opportunity.",
    accent: "#e8d6b0",
    hint: "private · input",
    statLabel: "limit",
    statValue: "250 words",
    actionLabel: "Prepare draft",
  },
  {
    id: "treasury",
    name: "Release Desk",
    short: "REL",
    description: "Review and approve the exact public revision before publishing.",
    accent: "#e58a64",
    hint: "review · approval",
    statLabel: "revision",
    statValue: "owner approved",
    actionLabel: "Review public preview",
  },
  {
    id: "studio",
    name: "AI Studio",
    short: "0G",
    description: "0G private compilation with bounded attempts and saved evidence.",
    accent: "#5fd0bd",
    hint: "0g · private",
    statLabel: "attempts",
    statValue: "0 / 2",
    actionLabel: "Start compilation",
  },
  {
    id: "archive",
    name: "Archive",
    short: "ARC",
    description: "Owner-only saved briefs, edits, private recovery and exports.",
    accent: "#8fb8d8",
    hint: "private · recovery",
    statLabel: "saved",
    statValue: "owner only",
    actionLabel: "Open saved brief",
  },
];

export const BUILDING_BY_ID: Record<BuildingId, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((building) => [building.id, building]),
) as Record<BuildingId, BuildingDef>;

export const DEMO_SOURCE = `Every Friday evening, the old bookshop on Lantern Lane keeps its lights on a little longer. Neighbours bring chairs, tea, and whatever they are reading, and the shop becomes a small, warm room full of quiet conversation.

The owner, Mrs. Deshpande, writes a short welcome note for the window each week. She wants the same note in Hindi, so families who have just moved to the neighbourhood can feel invited too.

The note is simple: welcome, stay a while, take a book, and tell us what you are looking for. Nothing is for sale tonight. The only thing on offer is a place to sit.`;

export const DEMO_TRANSLATION = `हर शुक्रवार की शाम, लालटेन गली की पुरानी किताबों की दुकान अपनी बत्तियाँ थोड़ी देर और जलाए रखती है। पड़ोसी कुर्सियाँ, चाय और अपनी पढ़ी हुई किताबें लेकर आते हैं, और दुकान धीमी बातों से भरा एक छोटा, गर्म कमरा बन जाती है।

दुकान की मालकिन श्रीमती देशपांडे हर हफ्ते खिड़की के लिए एक छोटा स्वागत-संदेश लिखती हैं। वे वही संदेश हिंदी में भी चाहती हैं, ताकि जो परिवार अभी-अभी पड़ोस में आए हैं, वे भी अपने आप को आमंत्रित महसूस करें।

संदेश सरल है: स्वागत है, थोड़ी देर रुकिए, एक किताब लीजिए, और हमें बताइए कि आप क्या ढूँढ रहे हैं। आज रात कुछ भी बिक्री पर नहीं है। यहाँ सिर्फ़ बैठने की जगह है।`;

export const DEMO_SOURCE_SEGMENTS: JobSegment[] = splitSegments(DEMO_SOURCE);
export const DEMO_TRANSLATION_SEGMENTS: TranslationSegment[] = splitSegments(DEMO_TRANSLATION);

export const ARCHIVED_JOB: ToolJob = {
  id: "0x7a4f19c28e0b6d31a0f4c5e7b8d90123c4e5f60718293a4b5c6d7e8f90123456",
  title: "Lantern Lane welcome note",
  status: "ready",
  source: DEMO_SOURCE,
  sourceSegments: DEMO_SOURCE_SEGMENTS,
  translation: DEMO_TRANSLATION_SEGMENTS,
  edited: null,
  createdAt: "2026-11-06T09:42:00.000Z",
  updatedAt: "2026-11-06T09:47:00.000Z",
  costLabel: "$1.00",
  txHash: "0x3b1f9d84c7a2e6504f18bc9d3a7e2156b8c4d0f9a1e2c3b4d5f60718293a4b5c",
  modelId: "0g-private-translate-v1",
  requestId: "req_0g_7f21ac04",
  routerTeeVerified: true,
  attemptsUsed: 1,
};

export function splitSegments(text: string): JobSegment[] {
  return text
    .split(/\n\s*\n/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((segment, index) => ({
      id: `seg_${String(index + 1).padStart(3, "0")}`,
      text: segment,
    }));
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function isSourceValid(text: string): boolean {
  const words = countWords(text);
  return words >= 1 && words <= 250 && text.length <= 5000;
}

export function shortJobId(id: string): string {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function jobTitle(text: string): string {
  const first = text.trim().split(/\s+/).slice(0, 6).join(" ");
  return first.length > 0 ? `${first}…` : "Untitled draft";
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
