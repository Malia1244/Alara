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
import NotesInput from "@/components/NotesInput";

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
      <main className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col items-start gap-2">
          <Link
            href="/"
            className="text-sm font-semibold text-brand transition-colors hover:text-brand"
          >
            ← All subjects
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            {subject ? subject.name : "Loading..."}
          </h1>
          {subject && <p className="text-sm text-zinc-400">Unit: {subject.unit}</p>}
          {subject && (
            <Link
              href={`/subjects/${subjectId}/practice`}
              className="mt-2 inline-flex rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
            >
              Practice / Test
            </Link>
          )}
        </header>

        {isLoading && (
          <p className="text-sm text-zinc-500">Loading...</p>
        )}

        {error && <p className="text-sm text-rose-500">{error}</p>}

        {!isLoading && !todaysEntry && (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-5 rounded-3xl border border-zinc-100 bg-white p-7 shadow-sm"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="content"
                className="text-sm font-semibold text-zinc-600"
              >
                What did you learn today?
              </label>
              <NotesInput
                id="content"
                value={content}
                onChange={setContent}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="self-start rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSaving ? "Saving..." : "Save today's learning ✨"}
            </button>
          </form>
        )}

        {todaysEntry && (
          <section className="flex flex-col gap-4">
            <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                  Today&apos;s quiz
                </span>
                <span className="text-xs text-zinc-400">
                  {formatDate(todaysEntry.created_at)}
                </span>
              </div>
              <QuizPanel
                entryId={todaysEntry.id}
                autoGenerate
                onStatusChange={setTodaysQuizStatus}
              />
            </div>
          </section>
        )}

        {todaysQuizStatus === "completed" && pastEntries.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-500">
              Past entries
            </h2>
            <ul className="flex flex-col gap-4">
              {pastEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                      {entry.unit ?? entry.subject}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                    {entry.content}
                  </p>
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
