"use client";

import { useEffect, useRef, useState } from "react";
import AraAvatar from "@/components/AraAvatar";
import {
  fetchQuizForEntry,
  generateQuiz,
  submitQuiz,
  type Quiz,
  type QuizDifficulty,
  type QuizResult,
} from "@/lib/api";
import type { AraPose } from "@/lib/araPoses";

export type QuizStatus = "none" | "in-progress" | "completed";

type Props = {
  entryId: string;
  // Kept for older call sites; generation always waits for the student
  // to pick difficulty + question count first.
  autoGenerate?: boolean;
  // Lets the parent page know whether a quiz exists yet and whether it's
  // been finished, so it can decide what else to reveal on the page.
  onStatusChange?: (status: QuizStatus) => void;
};

const QUESTION_COUNT_OPTIONS = [3, 5, 8, 10, 12, 15] as const;
const DIFFICULTY_OPTIONS: { id: QuizDifficulty; label: string; hint: string }[] =
  [
    { id: "easy", label: "Easy", hint: "Straightforward recall" },
    { id: "medium", label: "Medium", hint: "A little thinking" },
    { id: "hard", label: "Hard", hint: "Trickier application" },
  ];

const ENCOURAGEMENTS = [
  "Think carefully! You got this!",
  "Take your time, you're doing great!",
  "Trust what you learned today!",
  "Almost there, keep going!",
];

function resultFromCompletedQuiz(quiz: Quiz): QuizResult | null {
  if (!quiz.completed || !quiz.submitted_answers) return null;
  return {
    quiz_id: quiz.id,
    score: quiz.score ?? 0,
    total: quiz.total ?? quiz.questions.length,
    results: quiz.questions.map((q, i) => {
      const chosenIndex = quiz.submitted_answers![i];
      const correctIndex = q.correct_index ?? -1;
      return {
        question: q.question,
        options: q.options,
        correct_index: correctIndex,
        chosen_index: chosenIndex,
        is_correct: chosenIndex === correctIndex,
      };
    }),
    // Not returned when reloading a finished quiz — only on fresh submit.
    points_earned: 0,
    total_points: 0,
  };
}

export default function QuizPanel({
  entryId,
  onStatusChange,
}: Props) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState(8);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  // Lets you tuck the finished quiz away once you're done looking at it,
  // while keeping the score visible.
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Whether the full "taking the quiz" popup is open. Closing it with the
  // X keeps your progress but tucks the quiz away.
  const [isTakingOpen, setIsTakingOpen] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [encouragement] = useState(
    () => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
  );

  // Keeps the callback fresh without needing it in the effect's dependency
  // array (it's a new function every render on the parent's side).
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  async function handleGenerate() {
    setIsLoading(true);
    setError(null);
    try {
      const newQuiz = await generateQuiz(entryId, {
        num_questions: numQuestions,
        difficulty,
      });
      setQuiz(newQuiz);
      setAnswers(new Array(newQuiz.questions.length).fill(null));
      setCurrentQuestionIndex(0);
      setIsTakingOpen(true);
      onStatusChangeRef.current?.("in-progress");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't make a quiz right now. Try again in a bit!"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function loadExistingQuiz() {
      try {
        const existing = await fetchQuizForEntry(entryId);
        if (existing) {
          setQuiz(existing);
          setAnswers(
            existing.submitted_answers ??
              new Array(existing.questions.length).fill(null)
          );
          setResult(resultFromCompletedQuiz(existing));
          setIsChecking(false);
          onStatusChangeRef.current?.(
            existing.completed ? "completed" : "in-progress"
          );
          return;
        }
        setIsChecking(false);
        onStatusChangeRef.current?.("none");
      } catch {
        // If this fails, we just fall back to the "take a quiz" button —
        // not worth showing an error for a background check.
        setIsChecking(false);
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadExistingQuiz();
  }, [entryId]);

  function selectAnswer(questionIndex: number, optionIndex: number) {
    if (result) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  }

  async function handleSubmit() {
    if (!quiz || answers.some((a) => a === null)) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await submitQuiz(quiz.id, answers as number[]);
      setResult(res);
      setIsTakingOpen(false);
      onStatusChangeRef.current?.("completed");
    } catch {
      setError("Couldn't grade your quiz. Try submitting again!");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRetake() {
    setResult(null);
    setIsCollapsed(false);
    setQuiz(null);
    setAnswers([]);
    setIsTakingOpen(false);
    setError(null);
    onStatusChangeRef.current?.("none");
  }

  function goToNext() {
    if (!quiz) return;
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      handleSubmit();
    }
  }

  if (isChecking) {
    return null;
  }

  if (!quiz) {
    return (
      <div className="mt-4 rounded-3xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <AraAvatar size={44} pose="think" className="shrink-0" />
          <div>
            <p className="font-display text-base font-bold text-stone-900">
              Quiz setup
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Pick how hard it should be and how many questions, then generate.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Difficulty
            </p>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_OPTIONS.map((option) => {
                const selected = difficulty === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDifficulty(option.id)}
                    disabled={isLoading}
                    className={`rounded-2xl border px-3 py-2 text-left transition ${
                      selected
                        ? "border-brand bg-brand-soft text-brand-ink shadow-sm"
                        : "border-border bg-white text-stone-700 hover:border-brand/40"
                    } disabled:opacity-60`}
                  >
                    <span className="block text-sm font-semibold">
                      {option.label}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Number of questions
            </p>
            <div className="flex flex-wrap gap-2">
              {QUESTION_COUNT_OPTIONS.map((count) => {
                const selected = numQuestions === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setNumQuestions(count)}
                    disabled={isLoading}
                    className={`min-w-11 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      selected
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-white text-stone-700 hover:border-brand/40"
                    } disabled:opacity-60`}
                  >
                    {count}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={() => void handleGenerate()}
          disabled={isLoading}
          className="mt-5 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading
            ? "Making your quiz…"
            : `Generate ${numQuestions}-question ${difficulty} quiz`}
        </button>
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
      </div>
    );
  }

  const totalQuestions = quiz.questions.length;
  const answeredCount = answers.filter((a) => a !== null).length;

  // The in-progress "continue quiz" prompt, shown once the popup is closed
  // (or before it's been opened) while the quiz still isn't finished.
  if (!result && !isTakingOpen) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-brand-soft/60 px-4 py-3">
        <p className="text-sm font-medium text-brand">
          Quiz ready — {answeredCount}/{totalQuestions} answered
        </p>
        <button
          onClick={() => setIsTakingOpen(true)}
          className="shrink-0 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-ink"
        >
          Continue quiz →
        </button>
      </div>
    );
  }

  return (
    <>
      {isTakingOpen && !result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          onClick={() => setIsTakingOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-5 rounded-3xl border border-border bg-surface p-6 shadow-xl"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-brand">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </span>
                <button
                  type="button"
                  onClick={() => setIsTakingOpen(false)}
                  aria-label="Close quiz"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-brand-soft">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{
                    width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                  }}
                />
              </div>
            </div>

            <p className="text-lg font-bold leading-snug text-zinc-800">
              {quiz.questions[currentQuestionIndex].question}
            </p>

            <div className="flex flex-col gap-2">
              {quiz.questions[currentQuestionIndex].options.map(
                (option, oIndex) => {
                  const isSelected =
                    answers[currentQuestionIndex] === oIndex;
                  return (
                    <button
                      key={oIndex}
                      type="button"
                      onClick={() => selectAnswer(currentQuestionIndex, oIndex)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                        isSelected
                          ? "border-brand bg-brand-soft text-brand-ink shadow-sm"
                          : "border-border bg-surface text-zinc-700 hover:border-brand/40 hover:bg-brand-soft/60"
                      }`}
                    >
                      {option}
                    </button>
                  );
                }
              )}
            </div>

            <button
              type="button"
              onClick={goToNext}
              disabled={
                answers[currentQuestionIndex] === null || isSubmitting
              }
              className="rounded-full bg-gradient-to-r from-brand to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSubmitting
                ? "Checking..."
                : currentQuestionIndex < totalQuestions - 1
                  ? "Next question →"
                  : "Submit quiz"}
            </button>

            {error && <p className="text-sm text-rose-500">{error}</p>}

            <div className="flex items-center gap-2.5 rounded-2xl bg-brand-soft px-3 py-2.5">
              <AraAvatar size={32} pose="think" className="shrink-0" />
              <p className="text-xs font-semibold text-brand">
                {encouragement}
              </p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5 flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-white p-4 text-center shadow-sm">
            <AraAvatar
              size={72}
              pose={
                (result.score === result.total
                  ? "cheer"
                  : result.score > 0
                    ? "proud"
                    : "encourage") as AraPose
              }
            />
            <p className="text-xl font-bold text-brand">
              {result.score} / {result.total} correct
            </p>
            {result.points_earned > 0 && (
              <p className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                +{result.points_earned} points ({result.total_points} total)
              </p>
            )}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="text-xs font-semibold text-brand underline-offset-2 hover:text-brand hover:underline"
              >
                {isCollapsed ? "Show quiz again" : "Close quiz"}
              </button>
              <button
                type="button"
                onClick={handleRetake}
                disabled={isLoading}
                className="text-xs font-semibold text-brand underline-offset-2 hover:text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                🔄 Retake — pick settings again
              </button>
            </div>
          </div>

          {!isCollapsed &&
            quiz.questions.map((q, qIndex) => {
              const resultItem = result.results[qIndex];
              return (
                <div key={qIndex} className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-zinc-700">
                    {qIndex + 1}. {q.question}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((option, oIndex) => {
                      const isSelected = answers[qIndex] === oIndex;
                      const isCorrectOption =
                        oIndex === resultItem.correct_index;
                      const isChosenWrong =
                        isSelected && !resultItem.is_correct;
                      let style = "border-zinc-100 bg-white/60 text-zinc-400";
                      if (isCorrectOption) {
                        style = "border-emerald-200 bg-emerald-50 text-emerald-600";
                      } else if (isChosenWrong) {
                        style = "border-rose-200 bg-rose-50 text-rose-600";
                      }

                      return (
                        <div
                          key={oIndex}
                          className={`rounded-xl border px-4 py-2.5 text-left text-sm ${style}`}
                        >
                          {option}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}
