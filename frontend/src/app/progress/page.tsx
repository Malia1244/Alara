"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { useAraPrefs } from "@/components/AraPrefsProvider";
import AraPrefsControls from "@/components/AraPrefsControls";
import { fetchProgress, type ProgressStats } from "@/lib/api";
import { araCoachLine } from "@/lib/araTips";

export default function ProgressPage() {
  const { prefs } = useAraPrefs();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchProgress()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Couldn't load progress. Is the FastAPI backend running on port 8000?"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accuracyLabel =
    stats?.accuracy_percent != null
      ? `${stats.accuracy_percent}%`
      : "—";
  const coachLine =
    prefs.tips && stats ? araCoachLine(stats.topics_to_review) : null;

  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
      <main className="flex w-full max-w-3xl flex-col gap-6">
        <header className="animate-rise flex flex-col gap-3">
          <div className="flex items-end gap-4">
            <CharacterStage
              size={72}
              pose={coachLine ? "encourage" : "proud"}
              priority
              pad="sm"
            />
            <div className="min-w-0 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Progress
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Your progress
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Quiz misses feed review topics — later quizzes lean on those weak
                spots automatically.
              </p>
              {coachLine && stats?.topics_to_review[0] && (
                <Link
                  href="/teach-ara"
                  className="mt-2 inline-block text-sm font-semibold text-brand hover:underline"
                >
                  Teach Ara about {stats.topics_to_review[0].topic}
                </Link>
              )}
            </div>
          </div>
          {coachLine && (
            <div className="ara-callout px-4 py-3 text-sm text-ink">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                Ara · coach note
              </p>
              <p className="mt-1 font-medium">{coachLine}</p>
            </div>
          )}
        </header>

        {isLoading && (
          <p className="text-sm text-muted">Reading your quiz patterns…</p>
        )}
        {error && <p className="text-sm text-accent">{error}</p>}

        {stats && (
          <>
            <div className="animate-rise-delay grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="interactive-tile flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
                <span className="w-fit rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Streak
                </span>
                <p className="font-display text-3xl font-semibold text-ink">
                  {stats.day_streak}
                </p>
                <p className="text-xs text-muted">
                  {stats.day_streak === 1
                    ? "day in a row with notes"
                    : "days in a row with notes"}
                </p>
              </div>

              <div className="interactive-tile flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
                <span className="w-fit rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-900">
                  Accuracy
                </span>
                <p className="font-display text-3xl font-semibold text-ink">
                  {accuracyLabel}
                </p>
                <p className="text-xs text-muted">
                  {stats.questions_correct}/{stats.questions_answered} correct
                  across {stats.quizzes_completed} quiz
                  {stats.quizzes_completed === 1 ? "" : "zes"}
                </p>
              </div>

              <div className="interactive-tile flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
                <span className="w-fit rounded-lg bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                  To review
                </span>
                <p className="font-display text-3xl font-semibold text-ink">
                  {stats.topics_to_review.length}
                </p>
                <p className="text-xs text-muted">
                  weak topic
                  {stats.topics_to_review.length === 1 ? "" : "s"} from misses
                </p>
              </div>
            </div>

            {stats.by_subject.length > 0 && (
              <section className="animate-rise flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
                <h2 className="font-display text-lg font-semibold text-ink">
                  By subject
                </h2>
                <ul className="flex flex-col gap-3">
                  {stats.by_subject.map((row) => (
                    <li key={row.subject_id ?? row.subject} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-ink">
                          {row.subject}
                        </span>
                        <span className="text-xs font-semibold text-muted">
                          {row.accuracy_percent}% · {row.correct}/{row.total}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-panel">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${Math.min(100, row.accuracy_percent)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="animate-rise flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
              <h2 className="font-display text-lg font-semibold text-ink">
                Topics to review
              </h2>
              {stats.topics_to_review.length === 0 ? (
                <p className="text-sm text-muted">
                  No weak spots yet — take a quiz and review topics will appear
                  here.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.topics_to_review.map((topic) => (
                    <li
                      key={`${topic.subject}-${topic.topic}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border bg-brand-soft/40 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {topic.topic}
                        </p>
                        <p className="text-xs text-muted">{topic.subject}</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-[11px] font-semibold text-accent">
                        {topic.miss_count} miss
                        {topic.miss_count === 1 ? "" : "es"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <AraPrefsControls className="md:hidden" />

            <section className="animate-rise flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
              <h2 className="font-display text-lg font-semibold text-ink">
                Recently missed
              </h2>
              {stats.recent_misses.length === 0 ? (
                <p className="text-sm text-muted">
                  Nothing missed lately.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.recent_misses.map((miss, index) => (
                    <li
                      key={`${miss.created_at}-${index}`}
                      className="rounded-xl border border-border px-4 py-3"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {miss.subject}
                      </p>
                      <p className="mt-1 text-sm text-ink/80">{miss.question}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
