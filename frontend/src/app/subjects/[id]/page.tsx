"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  createLearningEntry,
  deleteSubject,
  fetchLearningEntries,
  fetchSubject,
  apiUnreachableMessage,
  type LearningEntry,
  type Subject,
} from "@/lib/api";
import {
  NO_NEW_LEARNING_CONTENT,
  displayLearningContent,
  hasStudyNotes,
  isNoNewLearning,
} from "@/lib/learning";
import QuizPanel from "@/components/QuizPanel";
import NotesExplainCard from "@/components/NotesExplainCard";
import NotesInput from "@/components/NotesInput";
import NoticeBanner from "@/components/NoticeBanner";
import TestCheckInModal from "@/components/TestCheckInModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayTitle(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const label = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  return sameDay ? `Today · ${label}` : label;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function previewText(content: string) {
  const text = displayLearningContent(content).replace(/\s+/g, " ").trim();
  if (!text) return "Check-in";
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

export default function SubjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const subjectId = params.id;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prizeMessage, setPrizeMessage] = useState<string | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  async function loadData() {
    try {
      setError(null);
      const [subjectData, entriesData] = await Promise.all([
        fetchSubject(subjectId),
        fetchLearningEntries(subjectId),
      ]);
      setSubject(subjectData);
      setEntries(entriesData);
      setOpenEntryId((current) => {
        if (current && entriesData.some((e) => e.id === current)) return current;
        const today = entriesData.find((e) => isToday(e.created_at));
        return today?.id ?? entriesData[0]?.id ?? null;
      });
    } catch {
      setError(apiUnreachableMessage());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadData();
  }, [subjectId]);

  const todaysEntry = entries.find((e) => isToday(e.created_at)) ?? null;
  const hasPastStudyNotes = entries.some((e) => hasStudyNotes(e.content));
  const needsTestCheckIn =
    subject != null &&
    subject.test_date != null &&
    subject.days_until_test != null &&
    subject.days_until_test <= 0;

  async function saveEntry(notes: string, reviewingPast: boolean) {
    setIsSaving(true);
    setError(null);
    try {
      const saved = await createLearningEntry({
        subject_id: subjectId,
        content: notes,
      });
      setContent("");
      if (saved.points_earned && saved.points_earned > 0) {
        setPrizeMessage(
          reviewingPast
            ? `Nice! +${saved.points_earned} shop points — today's quiz will review past notes.`
            : `Nice! +${saved.points_earned} shop points for logging what you learned.`
        );
      }
      await loadData();
    } catch {
      setError("Couldn't save your entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    await saveEntry(content, false);
  }

  async function handleNoNewLearning() {
    if (!hasPastStudyNotes) {
      setError(
        "No past notes to review yet. Log what you learned first, then you can check in without new material."
      );
      return;
    }
    await saveEntry(NO_NEW_LEARNING_CONTENT, true);
  }

  async function handleRemoveSubject() {
    if (!subject) return;
    const ok = window.confirm(
      `Remove “${subject.name}”? Its notes and quizzes will be deleted too.`
    );
    if (!ok) return;

    setIsDeleting(true);
    setError(null);
    try {
      await deleteSubject(subject.id);
      router.push("/");
    } catch {
      setError("Couldn't remove that subject. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:py-16">
      <NoticeBanner
        message={prizeMessage}
        onClose={() => setPrizeMessage(null)}
      />
      {needsTestCheckIn && subject && (
        <TestCheckInModal
          subject={subject}
          onComplete={(updated) => setSubject(updated)}
        />
      )}
      <main className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col items-start gap-2">
          <Link
            href="/"
            className="text-sm font-semibold text-brand transition-colors hover:text-brand-ink"
          >
            ← All subjects
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {subject ? subject.name : "Loading…"}
          </h1>
          {subject && (
            <p className="text-sm text-muted">Unit: {subject.unit}</p>
          )}
          {subject?.test_date && subject.days_until_test != null && (
            <p className="text-sm font-medium text-brand">
              {subject.days_until_test === 0
                ? "Test is today"
                : subject.days_until_test > 0
                  ? `Next test in ${subject.days_until_test} day${
                      subject.days_until_test === 1 ? "" : "s"
                    }`
                  : "Test date passed — tell Ara how it went"}
            </p>
          )}
          {subject && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                href={`/subjects/${subjectId}/practice`}
                className="inline-flex rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
              >
                Practice / Test
              </Link>
              <button
                type="button"
                onClick={handleRemoveSubject}
                disabled={isDeleting}
                className="inline-flex rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Removing…" : "Remove subject"}
              </button>
            </div>
          )}
        </header>

        {isLoading && (
          <p className="text-sm text-muted">Loading…</p>
        )}

        {error && <p className="text-sm text-accent">{error}</p>}

        {!isLoading && !todaysEntry && (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-7"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="content"
                className="text-sm font-semibold text-ink/70"
              >
                What did you learn today?
              </label>
              <NotesInput
                id="content"
                value={content}
                onChange={setContent}
                subject={subject?.name}
                unit={subject?.unit}
                required
              />
              <p className="mt-2 text-xs text-muted">
                Notes feeling fuzzy? Ask Ara for a short plain-English summary
                before you save. First log today earns{" "}
                <span className="font-semibold text-brand-ink">+25 shop points</span>
                .
              </p>
            </div>

            <NotesExplainCard
              content={content}
              subjectName={subject?.name}
              unit={subject?.unit}
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save today's learning"}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleNoNewLearning}
                className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-ink/80 transition-colors hover:border-brand/40 hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                We didn&apos;t learn anything
              </button>
            </div>
            <p className="text-xs text-muted">
              Nothing new? Check in anyway — today&apos;s quiz will review past
              notes for this subject
              {!hasPastStudyNotes ? " (add notes on another day first)" : ""}.
            </p>
          </form>
        )}

        {entries.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-sm font-semibold text-muted">Study log</h2>
              <p className="text-[11px] text-muted">
                Tap a day to see the notes and quiz
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => {
                const open = openEntryId === entry.id;
                const today = isToday(entry.created_at);
                return (
                  <li
                    key={entry.id}
                    className={`overflow-hidden rounded-2xl border bg-surface transition-colors ${
                      open
                        ? "border-brand/40"
                        : "border-border hover:border-brand/30"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenEntryId((current) =>
                          current === entry.id ? null : entry.id
                        )
                      }
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                      aria-expanded={open}
                    >
                      <span
                        className={`mt-0.5 text-sm text-muted transition ${
                          open ? "rotate-90" : ""
                        }`}
                        aria-hidden
                      >
                        ▸
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-base font-semibold text-ink">
                            {formatDayTitle(entry.created_at)}
                          </span>
                          {today && (
                            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                              Today
                            </span>
                          )}
                          <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold text-muted">
                            {isNoNewLearning(entry.content)
                              ? "Check-in"
                              : "Learning + quiz"}
                          </span>
                        </span>
                        {!open && (
                          <span className="mt-1 block truncate text-sm text-muted">
                            {previewText(entry.content)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 pt-0.5 text-[11px] text-muted">
                        {formatDate(entry.created_at)}
                      </span>
                    </button>

                    {open && (
                      <div className="flex flex-col gap-3 border-t border-border px-4 pb-4 pt-3">
                        <div className="rounded-2xl border border-border bg-panel/60 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                              {isNoNewLearning(entry.content)
                                ? today
                                  ? "Today's check-in"
                                  : "Check-in"
                                : today
                                  ? "Today's learning"
                                  : "Learning log"}
                            </span>
                            <span className="text-xs text-muted">
                              {formatDate(entry.created_at)}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
                            {displayLearningContent(entry.content)}
                          </p>
                          {hasStudyNotes(entry.content) && (
                            <div className="mt-4">
                              <NotesExplainCard
                                entryId={entry.id}
                                content={entry.content}
                                subjectName={entry.subject}
                                unit={entry.unit}
                                compact
                              />
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-border bg-panel/60 p-4">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                              {today ? "Today's quiz" : "Quiz"}
                            </span>
                            <span className="text-xs text-muted">
                              {formatDate(entry.created_at)}
                            </span>
                          </div>
                          <QuizPanel entryId={entry.id} />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
