"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  createLearningEntry,
  fetchLearningEntries,
  fetchSubject,
  type LearningEntry,
  type Subject,
} from "@/lib/api";
import QuizPanel, { type QuizStatus } from "@/components/QuizPanel";
import NotesExplainCard from "@/components/NotesExplainCard";
import NotesInput from "@/components/NotesInput";
import TestCheckInModal from "@/components/TestCheckInModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

export default function SubjectPage() {
  const params = useParams<{ id: string }>();
  const subjectId = params.id;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks today's quiz so we know when to reveal the rest of the page.
  const [todaysQuizStatus, setTodaysQuizStatus] = useState<QuizStatus | null>(
    null
  );

  async function loadData() {
    try {
      setError(null);
      const [subjectData, entriesData] = await Promise.all([
        fetchSubject(subjectId),
        fetchLearningEntries(subjectId),
      ]);
      setSubject(subjectData);
      setEntries(entriesData);
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
    loadData();
  }, [subjectId]);

  const todaysEntry = entries.find((e) => isToday(e.created_at)) ?? null;
  const pastEntries = entries.filter((e) => e.id !== todaysEntry?.id);
  const needsTestCheckIn =
    subject != null &&
    subject.test_date != null &&
    subject.days_until_test != null &&
    subject.days_until_test <= 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await createLearningEntry({ subject_id: subjectId, content });
      setContent("");
      await loadData();
    } catch {
      setError("Couldn't save your entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:py-16">
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
            <Link
              href={`/subjects/${subjectId}/practice`}
              className="mt-2 inline-flex rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
            >
              Practice / Test
            </Link>
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
                before you save.
              </p>
            </div>

            <NotesExplainCard
              content={content}
              subjectName={subject?.name}
              unit={subject?.unit}
            />

            <button
              type="submit"
              disabled={isSaving}
              className="self-start rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save today's learning"}
            </button>
          </form>
        )}

        {todaysEntry && (
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                  Today&apos;s learning
                </span>
                <span className="text-xs text-muted">
                  {formatDate(todaysEntry.created_at)}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
                {todaysEntry.content}
              </p>
              <div className="mt-4">
                <NotesExplainCard
                  entryId={todaysEntry.id}
                  content={todaysEntry.content}
                  subjectName={todaysEntry.subject}
                  unit={todaysEntry.unit}
                  compact
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                  Today&apos;s quiz
                </span>
                <span className="text-xs text-muted">
                  {formatDate(todaysEntry.created_at)}
                </span>
              </div>
              <QuizPanel
                entryId={todaysEntry.id}
                onStatusChange={setTodaysQuizStatus}
              />
            </div>
          </section>
        )}

        {todaysQuizStatus === "completed" && pastEntries.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-muted">
              Past entries
            </h2>
            <ul className="flex flex-col gap-4">
              {pastEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-brand/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                      {entry.unit ?? entry.subject}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink/75">
                    {entry.content}
                  </p>
                  <div className="mt-3">
                    <NotesExplainCard
                      entryId={entry.id}
                      content={entry.content}
                      subjectName={entry.subject}
                      unit={entry.unit}
                      compact
                    />
                  </div>
                  <QuizPanel entryId={entry.id} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
