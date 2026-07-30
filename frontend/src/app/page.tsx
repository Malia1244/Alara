"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import AraAvatar from "@/components/AraAvatar";
import { createSubject, deleteSubject, fetchSubjects, type Subject } from "@/lib/api";

// Soft purple-family tones so each subject stands out, but the page
// still feels cohesive (not a rainbow).
const ACCENTS = [
  {
    badgeBg: "bg-violet-50",
    badgeText: "text-violet-600",
    bar: "bg-violet-400",
    barTrack: "bg-violet-100",
    label: "text-violet-500",
    strip: "bg-violet-400",
    ring: "ring-violet-100",
  },
  {
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-600",
    bar: "bg-purple-400",
    barTrack: "bg-purple-100",
    label: "text-purple-500",
    strip: "bg-purple-400",
    ring: "ring-purple-100",
  },
  {
    badgeBg: "bg-fuchsia-50",
    badgeText: "text-fuchsia-600",
    bar: "bg-fuchsia-400",
    barTrack: "bg-fuchsia-100",
    label: "text-fuchsia-500",
    strip: "bg-fuchsia-400",
    ring: "ring-fuchsia-100",
  },
  {
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-600",
    bar: "bg-indigo-400",
    barTrack: "bg-indigo-100",
    label: "text-indigo-500",
    strip: "bg-indigo-400",
    ring: "ring-indigo-100",
  },
];

function accentFor(index: number) {
  return ACCENTS[index % ACCENTS.length];
}

function countdownLabel(days: number | null) {
  if (days === null) return null;
  if (days < 0) return "Test date passed";
  if (days === 0) return "Test is today!";
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
  "w-full rounded-2xl border border-border bg-white px-4 py-2.5 text-sm text-stone-700 outline-none transition-[border-color,box-shadow] placeholder:text-stone-300 focus:border-brand focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]";

export default function Home() {
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
        <header className="animate-rise flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <AraAvatar size={72} pose="wink" priority className="drop-shadow-sm" />
            <div className="pb-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                Alara
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
                Ready to learn?
              </h1>
              <p className="mt-1 max-w-md text-sm text-muted">
                Pick a subject, log what you studied, and quiz with Ara.
              </p>
            </div>
          </div>

          <div className="relative sm:w-60">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300"
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

        {upcomingTestSubject && (
          <Link
            href={`/subjects/${upcomingTestSubject.id}`}
            className="animate-rise-delay interactive-tile group flex flex-col gap-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-violet-500 to-purple-500 p-6 text-white sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <AraAvatar size={72} pose="wave" showOutfits={false} />
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100">
                  Up next
                </span>
                <p className="font-display text-xl font-bold leading-tight">
                  {upcomingTestSubject.name}
                </p>
                <p className="text-sm text-white/85">
                  {countdownLabel(upcomingTestSubject.days_until_test)} ·{" "}
                  {upcomingTestSubject.unit}
                </p>
              </div>
            </div>
            <span className="self-start rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-600 transition-colors group-hover:bg-violet-50 sm:self-center">
              Continue
            </span>
          </Link>
        )}

        {error && <p className="text-center text-sm text-rose-600">{error}</p>}

        {isLoading && (
          <p className="text-center text-sm text-muted">Loading subjects...</p>
        )}

        {!isLoading && subjects.length === 0 && !error && !isAdding && (
          <div className="flex flex-col items-center gap-2 rounded-[1.75rem] border border-dashed border-border bg-surface/70 px-6 py-12 text-center">
            <p className="font-display text-lg font-bold text-stone-800">
              No subjects yet
            </p>
            <p className="text-sm text-muted">
              Add your first one to start logging and quizzing.
            </p>
          </div>
        )}

        {!isLoading && subjects.length > 0 && visibleSubjects.length === 0 && (
          <p className="text-center text-sm text-muted">
            No subjects match &ldquo;{search}&rdquo;.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleSubjects.map((subject, index) => {
            const accent = accentFor(index);
            const countdown = countdownLabel(subject.days_until_test);
            const testDate = formatTestDate(subject.test_date);
            const progress = testProgress(subject);

            return (
              <div
                key={subject.id}
                className="interactive-tile group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <button
                  type="button"
                  onClick={() => handleDeleteSubject(subject)}
                  disabled={deletingId === subject.id}
                  aria-label={`Remove ${subject.name}`}
                  className="absolute right-3 top-4 z-10 rounded-full border border-border bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-stone-500 opacity-100 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  {deletingId === subject.id ? "…" : "Remove"}
                </button>
                <Link
                  href={`/subjects/${subject.id}`}
                  className="flex flex-col"
                >
                <div className={`h-1.5 w-full ${accent.strip}`} />
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-bold ring-4 ${accent.badgeBg} ${accent.badgeText} ${accent.ring}`}
                    >
                      {subject.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-display text-base font-bold text-stone-900">
                        {subject.name}
                      </span>
                      <span className="text-xs text-muted">Currently learning</span>
                    </div>
                  </div>

                  <span
                    className={`w-fit rounded-xl px-2.5 py-1 text-xs font-semibold ${accent.badgeBg} ${accent.badgeText}`}
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
                        className={`h-2 w-full overflow-hidden rounded-full ${accent.barTrack}`}
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
                    className="inline-flex rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                  >
                    Practice / Test →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {isAdding ? (
          <form
            onSubmit={handleAddSubject}
            className="flex flex-col gap-5 rounded-[1.75rem] border border-border bg-surface p-7 shadow-[0_16px_40px_-28px_rgba(28,25,23,0.35)]"
          >
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                New subject
              </h2>
              <p className="mt-1 text-sm text-muted">
                Tell Ara what you&apos;re studying right now.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-semibold text-stone-600">
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
              <label htmlFor="unit" className="text-sm font-semibold text-stone-600">
                What unit are you in?
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
                className="text-sm font-semibold text-stone-600"
              >
                Days until your next test{" "}
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
                className="animate-pop rounded-2xl bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Add subject"}
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="rounded-2xl border border-border px-6 py-2.5 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="animate-pop group mx-auto flex items-center gap-2 rounded-2xl bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/20 text-sm leading-none">
              +
            </span>
            Add subject
          </button>
        )}
      </main>
    </div>
  );
}
