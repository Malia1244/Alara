"use client";

import { useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import {
  explainDraftNotes,
  explainLearningEntry,
  type NotesExplanation,
} from "@/lib/api";

type Props = {
  /** Saved entry id — preferred when available */
  entryId?: string;
  /** Draft / displayed notes text (used when no entryId, or as fallback) */
  content?: string;
  subjectName?: string;
  unit?: string | null;
  /** Compact button style for tight layouts */
  compact?: boolean;
};

export default function NotesExplainCard({
  entryId,
  content = "",
  subjectName,
  unit,
  compact = false,
}: Props) {
  const [explanation, setExplanation] = useState<NotesExplanation | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const canExplain = Boolean(entryId) || content.trim().length >= 8;

  async function handleExplain() {
    if (!canExplain || loading) return;
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const result = entryId
        ? await explainLearningEntry(entryId)
        : await explainDraftNotes({
            content,
            subject: subjectName,
            unit: unit ?? undefined,
          });
      setExplanation(result);
    } catch {
      setError("Ara couldn't explain that just now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleExplain}
        disabled={!canExplain || loading}
        className={
          compact
            ? "self-start rounded-lg border border-brand/30 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-50"
            : "self-start rounded-lg border border-brand/30 bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {loading
          ? "Ara is reading…"
          : explanation
            ? "Ask Ara again"
            : "Ara, explain this"}
      </button>

      {!canExplain && (
        <p className="text-xs text-muted">
          Write a little more in your log, then Ara can explain it.
        </p>
      )}

      {open && (explanation || error || loading) && (
        <div className="animate-rise rounded-2xl border border-brand/25 bg-brand-soft/40 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CharacterStage size={64} pose="sitClarify" pad="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                Ara · plain-English help
              </p>
              {loading && !explanation && (
                <p className="mt-2 text-sm text-muted">
                  Reading your notes and making a short summary…
                </p>
              )}
              {error && (
                <p className="mt-2 text-sm text-accent">{error}</p>
              )}
              {explanation && (
                <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-ink">
                  <div>
                    <p className="text-xs font-semibold text-brand-ink">
                      What you learned
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {explanation.summary}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-brand-ink">
                      How to do it
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {explanation.how_to}
                    </p>
                  </div>
                  {explanation.tip ? (
                    <div className="ara-callout px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                        Tip
                      </p>
                      <p className="mt-0.5 font-medium">{explanation.tip}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
