"use client";

import { useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { updateSubject, type Subject } from "@/lib/api";

type Props = {
  subject: Subject;
  onComplete: (updated: Subject) => void;
};

function formatTestDay(iso: string | null) {
  if (!iso) return "your test";
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

const inputClass =
  "w-full resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-brand/30 focus:ring-2";

export default function TestCheckInModal({ subject, onComplete }: Props) {
  const [step, setStep] = useState<"ask" | "next">("ask");
  const [reflection, setReflection] = useState("");
  const [daysUntil, setDaysUntil] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const whenLabel =
    subject.days_until_test === 0
      ? "today"
      : subject.days_until_test !== null && subject.days_until_test < 0
        ? formatTestDay(subject.test_date)
        : formatTestDay(subject.test_date);

  async function saveNextTest() {
    const days = daysUntil.trim() ? Number(daysUntil) : NaN;
    const hasDays = Number.isFinite(days) && days >= 0;
    const hasDate = Boolean(nextDate.trim());

    if (!hasDays && !hasDate) {
      setError("Pick a date or enter days until the next test.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateSubject(
        subject.id,
        hasDate
          ? { test_date: nextDate.trim() }
          : { days_until_test: days }
      );
      onComplete(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save the next test date."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-checkin-title"
    >
      <div className="animate-rise flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_80px_-40px_rgba(12,18,34,0.55)]">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <CharacterStage size={64} pose="encourage" priority pad="sm" />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              After the test
            </p>
            <p
              id="test-checkin-title"
              className="mt-1 font-display text-lg font-semibold text-ink"
            >
              {subject.name}
            </p>
            <p className="mt-1 text-xs text-muted">
              Test was {whenLabel}
              {subject.unit ? ` · ${subject.unit}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          {step === "ask" ? (
            <>
              <div className="ara-callout px-4 py-3 text-sm text-ink">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Ara · note
                </p>
                <p className="mt-1 font-medium leading-snug">
                  How did the test go? A short reflection helps set the next
                  study plan.
                </p>
              </div>
              <label htmlFor="test-reflection" className="sr-only">
                How was the test?
              </label>
              <textarea
                id="test-reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={4}
                placeholder="It went okay… / The essay was hard… / I feel solid about it."
                className={inputClass}
              />
              <button
                type="button"
                disabled={!reflection.trim()}
                onClick={() => setStep("next")}
                className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <div className="ara-callout px-4 py-3 text-sm text-ink">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Ara · note
                </p>
                <p className="mt-1 font-medium leading-snug">
                  Thanks for the update
                  {reflection.trim()
                    ? ` — “${reflection.trim().slice(0, 80)}${
                        reflection.trim().length > 80 ? "…" : ""
                      }”`
                    : ""}
                  . When is your <span className="font-semibold">next</span>{" "}
                  test for {subject.name}?
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label
                    htmlFor="next-test-days"
                    className="text-xs font-semibold text-ink/70"
                  >
                    Days until next test
                  </label>
                  <input
                    id="next-test-days"
                    type="number"
                    min={0}
                    value={daysUntil}
                    onChange={(e) => {
                      setDaysUntil(e.target.value);
                      if (e.target.value) setNextDate("");
                    }}
                    placeholder="e.g. 14"
                    className={`${inputClass} mt-1 resize-y`}
                  />
                </div>
                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                  or pick a date
                </p>
                <div>
                  <label htmlFor="next-test-date" className="sr-only">
                    Next test date
                  </label>
                  <input
                    id="next-test-date"
                    type="date"
                    value={nextDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => {
                      setNextDate(e.target.value);
                      if (e.target.value) setDaysUntil("");
                    }}
                    className={inputClass}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-accent">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("ask")}
                  className="rounded-lg border border-border px-4 py-3 text-sm font-semibold text-ink/70 hover:bg-panel"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveNextTest()}
                  className="flex-1 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save next test"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
