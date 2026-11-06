"use client";
// Home: private notes intake + explicit public parameters.
// Creates an owner-bound private brief via the PROPOSED BriefMint API.
// Backend 503 renders `unavailable` honestly; fixtures are never live data.
import { useState } from "react";
import { isApiError } from "@/lib/client/briefmint-api";
import { briefmintApi } from "@/lib/client/briefmint-api";
import type { BriefCategory, PrivateBrief, PublicParameters } from "@/lib/shared/briefmint";
import {
  MAX_BRIEF_CHARS,
  MAX_BRIEF_SEGMENTS,
  MAX_BRIEF_WORDS,
  MAX_SUMMARY_CHARS,
  MAX_TITLE_BYTES,
  countWords,
  splitBriefSegments,
  validateBriefNotes,
  validatePublicParameters,
} from "@/lib/shared/briefmint-validation";

interface BriefIntakeFormProps {
  onCreated: (brief: PrivateBrief) => void;
}

const DEMO_NOTES = "Community launch notes (fixture — not live).\n\nKeep private details out of the public draft.";

export default function BriefIntakeForm({ onCreated }: BriefIntakeFormProps) {
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<BriefCategory>("writing");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [budgetOn, setBudgetOn] = useState(false);
  const [budgetCents, setBudgetCents] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const words = countWords(notes);
  const chars = notes.trim().length;
  const segments = splitBriefSegments(notes);
  const notesCheck = validateBriefNotes(notes);
  const params: PublicParameters = {
    category,
    title: title.trim(),
    summary: summary.trim(),
    budgetCentsPresent: budgetOn,
    budgetCents: budgetOn ? Number(budgetCents) : null,
    contactUrl: contactUrl.trim() ? contactUrl.trim() : null,
    deadline: deadline.trim(),
    language: "en",
  };
  const paramsCheck = validatePublicParameters({
    ...params,
    budgetCents: budgetOn ? (budgetCents.trim() === "" ? NaN : Number(budgetCents)) : null,
  } as PublicParameters);
  const tooManySegments =
    segments.length >= MAX_BRIEF_SEGMENTS &&
    notes.split(/\n\s*\n/).filter((s) => s.trim()).length > MAX_BRIEF_SEGMENTS;
  const clientError = !notesCheck.ok
    ? notesCheck.message
    : tooManySegments
      ? `Notes have more than ${MAX_BRIEF_SEGMENTS} paragraphs.`
      : !paramsCheck.ok
        ? paramsCheck.message
        : null;

  const submit = async () => {
    setError(null);
    setUnavailable(false);
    if (clientError) {
      setError(clientError);
      return;
    }
    setBusy(true);
    try {
      const brief = await briefmintApi.createBrief({ notes: notes.trim(), publicParameters: params });
      setNotes("");
      onCreated(brief);
    } catch (e) {
      if (isApiError(e) && (e.status === 503 || e.code === "SERVICE_UNAVAILABLE")) {
        setUnavailable(true);
      } else if (isApiError(e) && e.status === 401) {
        setError("Connect your wallet and sign in first, then save the brief.");
      } else {
        setError(isApiError(e) ? `${e.code}: ${e.message}` : "Could not save the brief. Retry.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>Private notes intake</h3>
      <p className="tc-muted">
        Rough notes stay private to you and the backend. Only the approved public fields below may be published.
        Compilation is funded by promotional credits — no purchase, no bounty payout.
      </p>
      <div className="form-field">
        <label htmlFor="brief-notes">Private notes (blank line = new segment)</label>
        <textarea id="brief-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
      </div>
      <div className="counts">
        <span>Words: {words}/{MAX_BRIEF_WORDS}</span>
        <span>Chars: {chars}/{MAX_BRIEF_CHARS}</span>
        <span>Segments: {segments.length}/{MAX_BRIEF_SEGMENTS}</span>
      </div>
      <div className="form-field">
        <label htmlFor="brief-category">Task category (public)</label>
        <select id="brief-category" value={category} onChange={(e) => setCategory(e.target.value as BriefCategory)} disabled={busy}>
          <option value="writing">Writing</option>
          <option value="design">Design</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="brief-title">Public title (≤ {MAX_TITLE_BYTES} UTF-8 bytes)</label>
        <input id="brief-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
      </div>
      <div className="form-field">
        <label htmlFor="brief-summary">Public summary (≤ {MAX_SUMMARY_CHARS} chars, no private details)</label>
        <textarea id="brief-summary" value={summary} onChange={(e) => setSummary(e.target.value)} disabled={busy} />
      </div>
      <div className="form-field">
        <label>
          <input type="checkbox" checked={budgetOn} onChange={(e) => setBudgetOn(e.target.checked)} disabled={busy} />{" "}
          Advertise a budget (unfunded, USD cents)
        </label>
        {budgetOn && (
          <input type="text" inputMode="numeric" value={budgetCents} onChange={(e) => setBudgetCents(e.target.value)} disabled={busy} placeholder="e.g. 5000 (= $50.00)" aria-label="Advertised budget in USD cents" />
        )}
      </div>
      <div className="form-field">
        <label htmlFor="brief-contact">Public contact URL (optional https)</label>
        <input id="brief-contact" type="text" value={contactUrl} onChange={(e) => setContactUrl(e.target.value)} disabled={busy} placeholder="https://…" />
      </div>
      <div className="form-field">
        <label htmlFor="brief-deadline">Opportunity deadline (UTC, max 7 days)</label>
        <input id="brief-deadline" type="text" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={busy} placeholder="2026-11-13T09:00:00.000Z" />
      </div>
      {clientError && notes.trim() && <p className="error" role="alert">{clientError}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {unavailable && (
        <p className="notice" role="status">
          BriefMint backend unavailable (503) — the intake service is not deployed yet. Nothing was saved; no fixture was substituted.
        </p>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy || !!clientError} onClick={submit}>
          {busy ? "Saving…" : "Save private brief"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => setNotes(DEMO_NOTES)} title="Fixture — never live evidence">
          Load demo notes (fixture)
        </button>
      </div>
    </div>
  );
}
