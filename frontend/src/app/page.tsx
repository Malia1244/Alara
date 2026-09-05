"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import CharacterStage from "@/components/CharacterStage";
import { useAraPrefs } from "@/components/AraPrefsProvider";
import AraPrefsControls from "@/components/AraPrefsControls";
import {
  createSubject,
  deleteSubject,
  fetchProgress,
  fetchSubjects,
  type Subject,
} from "@/lib/api";
import { araCoachLine } from "@/lib/araTips";
import type { AraPose } from "@/lib/araPoses";

const ACCENTS = [
  {
    badgeBg: "bg-brand-soft",
    badgeText: "text-brand-ink",
    bar: "bg-brand",
    barTrack: "bg-brand-soft",
    label: "text-brand",
    strip: "bg-brand",
  },
  {
    badgeBg: "bg-sky-100",
    badgeText: "text-sky",
    bar: "bg-sky",
    barTrack: "bg-sky-100",
    label: "text-sky",
    strip: "bg-sky",
  },
  {
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    bar: "bg-amber",
    barTrack: "bg-amber-100",
    label: "text-amber",
    strip: "bg-amber",
  },
  {
    badgeBg: "bg-accent-soft",
    badgeText: "text-accent",
    bar: "bg-accent",
    barTrack: "bg-accent-soft",
    label: "text-accent",
    strip: "bg-accent",
  },
];

function accentFor(index: number) {
  return ACCENTS[index % ACCENTS.length];
}

function countdownLabel(days: number | null) {
  if (days === null) return null;
  if (days < 0) return "Test date passed";
  if (days === 0) return "Test is today";
  if (days === 1) return "Test in 1 day";
  return `Test in ${days} days`;
}

function formatTestDate(isoDate: string | null) {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function testProgress(subject: Subject): number | null {
  if (!subject.test_date) return null;
  const created = new Date(subject.created_at);
  const startOfCreatedDay = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate()
  );
  const test = new Date(subject.test_date);
  const totalMs = test.getTime() - startOfCreatedDay.getTime();
  if (totalMs <= 0) return 1;
  const elapsedMs = Date.now() - startOfCreatedDay.getTime();
  return Math.min(1, Math.max(0, elapsedMs / totalMs));
}

const inputClass =
  "w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-stone-400 focus:border-brand focus:shadow-[0_0_0_3px_rgba(15,107,92,0.12)]";

export default function Home() {
  const { prefs } = useAraPrefs();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [daysUntilTest, setDaysUntilTest] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [coachLine, setCoachLine] = useState<string | null>(null);
  const showTip = prefs.tips && Boolean(coachLine);
  const araPose: AraPose = showTip ? "encourage" : "wave";

  async function loadSubjects() {
    try {
      setError(null);
      const data = await fetchSubjects();
      setSubjects(data);
    } catch {
      setError(
        "Couldn't reach the server. Is the FastAPI backend running on port 8000?"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadSubjects();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchProgress()
      .then((stats) => {
        if (cancelled) return;
        setCoachLine(araCoachLine(stats.topics_to_review));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddSubject(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await createSubject({
        name: name.trim(),
        unit: unit.trim(),
        days_until_test: daysUntilTest.trim() ? Number(daysUntilTest) : null,
      });
      setName("");
      setUnit("");
      setDaysUntilTest("");
      setIsAdding(false);
      await loadSubjects();
    } catch {
      setError("Couldn't save your subject. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSubject(subject: Subject) {
    const ok = window.confirm(
      `Remove “${subject.name}”? Its notes and quizzes will be deleted too.`
    );
    if (!ok) return;

    setDeletingId(subject.id);
    setError(null);
    try {
      await deleteSubject(subject.id);
      setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
    } catch {
      setError("Couldn't remove that subject. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const upcomingTestSubject = subjects.find(
    (s) =>
      s.days_until_test !== null &&
      s.days_until_test >= 0 &&
      s.days_until_test <= 7
  );

  const visibleSubjects = subjects.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
      <main className="flex w-full max-w-4xl flex-col gap-8">
        <header className="animate-rise flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-end">
            <CharacterStage
              size={88}
              pose={araPose}
              priority
              pad="md"
            />
            <div className="min-w-0 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                Alara
              </p>
              <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                Study workspace
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                {showTip
                  ? "Quiz patterns suggest a review focus. Open a subject to practice."
                  : "Track subjects, log what you studied, and quiz with Ara."}
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              fill="none"
              aria-hidden
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects"
              className={`${inputClass} pl-10`}
            />
          </div>
        </header>

        {showTip && coachLine && (
          <div className="ara-callout ara-speech-bubble px-4 py-3 text-sm text-ink">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              Ara · coach note
            </p>
            <p className="mt-1 font-medium">{coachLine}</p>
          </div>
        )}

        <Link
          href="/timed-study"
          className="interactive-tile flex items-center justify-between gap-4 rounded-2xl border border-brand/25 bg-brand-soft/70 px-5 py-4"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
              Focus mode
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-ink">
              Timed study session
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Set a timer and goals — Ara keeps you on track.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            Start
          </span>
        </Link>

        {upcomingTestSubject && (
          <Link
            href={`/subjects/${upcomingTestSubject.id}`}
            className="animate-rise-delay interactive-tile group flex flex-col gap-4 overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand to-sky p-6 text-white sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <CharacterStage
                size={72}
                pose="wave"
                pad="sm"
                className="border-white/25 bg-white/15"
              />
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  Upcoming test
                </span>
                <p className="font-display text-2xl font-semibold leading-tight">
                  {upcomingTestSubject.name}
                </p>
                <p className="text-sm text-white/90">
                  {countdownLabel(upcomingTestSubject.days_until_test)} ·{" "}
                  {upcomingTestSubject.unit}
                </p>
              </div>
            </div>
            <span className="self-start rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-ink transition-colors group-hover:bg-brand-soft sm:self-center">
              Open subject
            </span>
          </Link>
        )}

        {error && <p className="text-center text-sm text-accent">{error}</p>}

        {isLoading && (
          <p className="text-center text-sm text-muted">Loading subjects…</p>
        )}

        {!isLoading && subjects.length === 0 && !error && !isAdding && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
            <p className="font-display text-xl font-semibold text-ink">
              No subjects yet
            </p>
            <p className="text-sm text-muted">
              Add your first subject to start logging and quizzing.
            </p>
          </div>
        )}

        {!isLoading && subjects.length > 0 && visibleSubjects.length === 0 && (
          <p className="text-center text-sm text-muted">
            No subjects match &ldquo;{search}&rdquo;.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleSubjects.map((subject, index) => {
            const accent = accentFor(index);
            const countdown = countdownLabel(subject.days_until_test);
            const testDate = formatTestDate(subject.test_date);
            const progress = testProgress(subject);

            return (
              <div
                key={subject.id}
                className="interactive-tile group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <button
                  type="button"
                  onClick={() => handleDeleteSubject(subject)}
                  disabled={deletingId === subject.id}
                  aria-label={`Remove ${subject.name}`}
                  className="absolute right-3 top-3 z-10 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent disabled:opacity-50"
                >
                  {deletingId === subject.id ? "…" : "Remove"}
                </button>
                <Link href={`/subjects/${subject.id}`} className="flex flex-col">
                  <div className={`h-1 w-full ${accent.strip}`} />
                  <div className="flex flex-col gap-3 p-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${accent.badgeBg} ${accent.badgeText}`}
                      >
                        {subject.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-display text-lg font-semibold text-ink">
                          {subject.name}
                        </span>
                        <span className="text-xs text-muted">Active subject</span>
                      </div>
                    </div>

                    <span
                      className={`w-fit rounded-md px-2 py-1 text-xs font-semibold ${accent.badgeBg} ${accent.badgeText}`}
                    >
                      {subject.unit}
                    </span>

                    {progress !== null && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${accent.label}`}>
                            {Math.round(progress * 100)}% to test
                          </span>
                        </div>
                        <div
                          className={`h-1.5 w-full overflow-hidden rounded-full ${accent.barTrack}`}
                        >
                          <div
                            className={`h-full rounded-full ${accent.bar} transition-all`}
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {countdown && (
                      <p className="text-xs text-muted">
                        {countdown}
                        {testDate ? ` · ${testDate}` : ""}
                      </p>
                    )}
                  </div>
                </Link>
                <div className="px-5 pb-5">
                  <Link
                    href={`/subjects/${subject.id}/practice`}
                    className="inline-flex rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-ink"
                  >
                    Practice
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {isAdding ? (
          <form
            onSubmit={handleAddSubject}
            className="flex flex-col gap-5 rounded-2xl border border-brand/20 bg-surface p-7"
          >
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">
                New subject
              </h2>
              <p className="mt-1 text-sm text-muted">
                Set up what you&apos;re studying right now.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-semibold text-ink">
                Subject name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Biology"
                className={inputClass}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="unit" className="text-sm font-semibold text-ink">
                Current unit
              </label>
              <input
                id="unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. Cell Biology"
                className={inputClass}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="daysUntilTest"
                className="text-sm font-semibold text-ink"
              >
                Days until next test{" "}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="daysUntilTest"
                type="number"
                min={0}
                value={daysUntilTest}
                onChange={(e) => setDaysUntilTest(e.target.value)}
                placeholder="e.g. 7"
                className={inputClass}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="animate-pop rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Add subject"}
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-panel hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="animate-pop mx-auto flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
          >
            <span className="text-base leading-none">+</span>
            Add subject
          </button>
        )}

        <AraPrefsControls className="mx-auto w-full max-w-sm md:hidden" />
      </main>
    </div>
  );
}
