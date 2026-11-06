import { getAddress, isAddress as viemIsAddress } from "viem";
import type { Address, Hex, SourceSegment, TranslationSegment } from "./domain";

export const MAX_WORDS = 250;
export const MAX_CHARS = 5000;
export const MAX_SEGMENTS = 20;

export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function validateJobText(text: string): { ok: true } | { ok: false; code: string; message: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, code: "BAD_INPUT", message: "Text is empty." };
  if (trimmed.length > MAX_CHARS) return { ok: false, code: "BAD_INPUT", message: `Text exceeds ${MAX_CHARS} characters.` };
  const words = countWords(trimmed);
  if (words > MAX_WORDS) return { ok: false, code: "BAD_INPUT", message: `Text exceeds ${MAX_WORDS} words.` };
  return { ok: true };
}

export function splitSegments(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SEGMENTS);
}

export function segmentIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `seg_${String(i + 1).padStart(3, "0")}`);
}

export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ValidationError"; }
}

export function isAddress(value: unknown): value is Address {
  return typeof value === "string" && viemIsAddress(value, { strict: false });
}

export function isHexString(v: unknown): v is `0x${string}` {
  return typeof v === "string" && /^0x[0-9a-fA-F]+$/.test(v);
}

export function isHex32(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function isBytes32(v: unknown): v is `0x${string}` {
  return isHex32(v);
}

export function normalizeAddress(value: unknown): Address {
  if (!isAddress(value)) throw new ValidationError("A valid wallet address is required.");
  return getAddress(value.toLowerCase());
}

export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function parseJobId(value: unknown): Hex {
  if (!isHex32(value)) throw new ValidationError("A 32-byte job ID is required.");
  return value.toLowerCase() as Hex;
}

export function validateDraft(value: unknown): SourceSegment[] {
  if (typeof value !== "string" || !value.trim()) throw new ValidationError("Enter a draft.");
  const text = value.trim();
  if (text.length > 5000 || text.split(/\s+/u).length > 250) {
    throw new ValidationError("Drafts must be at most 250 words and 5,000 characters.");
  }
  const paragraphs = text.split(/\r?\n\s*\r?\n/u).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 20) throw new ValidationError("Use at most 20 paragraphs.");
  return paragraphs.map((paragraph, index) => ({ id: `seg_${String(index + 1).padStart(3, "0")}`, text: paragraph }));
}

export function validateTranslations(value: unknown, source: SourceSegment[]): TranslationSegment[] {
  if (!Array.isArray(value) || value.length !== source.length) throw new ValidationError("Every source segment needs one translation.");
  const expected = new Set(source.map((segment) => segment.id));
  const found = new Map<string, string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !expected.has(item.id) || found.has(item.id) || typeof item.text !== "string" || !item.text.trim() || item.text.length > 10000) {
      throw new ValidationError("Translations must contain each expected segment exactly once.");
    }
    found.set(item.id, item.text);
  }
  return source.map(({ id }) => ({ id, text: found.get(id)! }));
}
