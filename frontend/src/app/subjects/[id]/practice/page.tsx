"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import AraAvatar from "@/components/AraAvatar";
import {
  createPracticeDeck,
  fetchSubject,
  type Flashcard,
  type PracticeDeck,
  type Subject,
} from "@/lib/api";

type Mode = "set" | "flashcards" | "learn" | "write" | "match" | "test";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function answersClose(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // Soft match: ignore light punctuation so typing isn't too harsh.
  const strip = (s: string) => s.replace(/[.,!?;:'"()-]/g, "");
  return strip(left) === strip(right);
}

function ModeChrome({
  title,
  onExit,
  children,
}: {
  title: string;
  onExit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="text-sm font-semibold text-brand hover:underline"
        >
          ← Study set
        </button>
        <h2 className="font-display text-lg font-bold text-stone-900">{title}</h2>
        <span className="w-16" />
      </div>
      {children}
    </div>
  );
}

function FlashcardsMode({
  cards,
  onExit,
}: {
  cards: Flashcard[];
  onExit: () => void;
}) {
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[order[index]];
  const progress = ((index + 1) / order.length) * 100;

  function go(next: number) {
    setFlipped(false);
    setIndex((next + order.length) % order.length);
  }

  return (
    <ModeChrome title="Flashcards" onExit={onExit}>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-xs font-semibold text-muted">
        {index + 1} / {order.length}
      </p>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-64 w-full flex-col items-center justify-center rounded-[1.75rem] border border-border bg-white px-8 py-12 text-center shadow-[0_20px_50px_-30px_rgba(28,25,23,0.4)] transition-transform active:scale-[0.99]"
      >
        <span className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {flipped ? "Definition" : "Term"} · click to flip
        </span>
        <p className="font-display text-2xl font-bold leading-snug text-stone-900 sm:text-3xl">
          {flipped ? card.back : card.front}
        </p>
      </button>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          className="rounded-2xl border border-border px-5 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => {
            setOrder(shuffle(cards.map((_, i) => i)));
            setIndex(0);
            setFlipped(false);
          }}
          className="rounded-2xl border border-border px-5 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
        >
          Shuffle
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          className="rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          →
        </button>
      </div>
    </ModeChrome>
  );
}

function LearnMode({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) {
  const deck = useMemo(() => shuffle(cards), [cards]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const finished = index >= deck.length;
  const card = deck[index];

  const choices = useMemo(() => {
    if (!card) return [];
    const wrongs = shuffle(
      cards.filter((c) => c.back !== card.back).map((c) => c.back)
    ).slice(0, 3);
    return shuffle([card.back, ...wrongs]);
  }, [card, cards]);

  function choose(answer: string) {
    if (picked) return;
    setPicked(answer);
    if (answer === card.back) setCorrectCount((n) => n + 1);
  }

  if (finished) {
    return (
      <ModeChrome title="Learn" onExit={onExit}>
        <Results
          title="Learn round done"
          known={correctCount}
          total={deck.length}
          pose={correctCount === deck.length ? "cheer" : "proud"}
        />
      </ModeChrome>
    );
  }

  return (
    <ModeChrome title="Learn" onExit={onExit}>
      <p className="text-center text-xs font-semibold text-muted">
        {index + 1} / {deck.length} · multiple choice
      </p>
      <div className="rounded-[1.75rem] border border-border bg-white px-6 py-8 text-center shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Term
        </p>
        <p className="mt-2 font-display text-2xl font-bold text-stone-900">
          {card.front}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          let style =
            "border-border bg-white text-stone-700 hover:border-brand hover:bg-brand-soft/40";
          if (picked) {
            if (choice === card.back) {
              style = "border-teal-300 bg-teal-50 text-teal-800";
            } else if (choice === picked) {
              style = "border-rose-200 bg-rose-50 text-rose-700";
            } else {
              style = "border-border bg-stone-50 text-stone-400";
            }
          }
          return (
            <button
              key={choice}
              type="button"
              disabled={Boolean(picked)}
              onClick={() => choose(choice)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${style}`}
            >
              {choice}
            </button>
          );
        })}
      </div>
      {picked && (
        <button
          type="button"
          onClick={() => {
            setPicked(null);
            setIndex((i) => i + 1);
          }}
          className="self-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Continue →
        </button>
      )}
    </ModeChrome>
  );
}

function WriteMode({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) {
  const deck = useMemo(() => shuffle(cards), [cards]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [correctCount, setCorrectCount] = useState(0);
  const finished = index >= deck.length;
  const card = deck[index];

  function check(e: FormEvent) {
    e.preventDefault();
    if (!card || status !== "idle") return;
    const ok = answersClose(answer, card.back);
    setStatus(ok ? "correct" : "wrong");
    if (ok) setCorrectCount((n) => n + 1);
  }

  if (finished) {
    return (
      <ModeChrome title="Write" onExit={onExit}>
        <Results
          title="Write round done"
          known={correctCount}
          total={deck.length}
          pose={correctCount === deck.length ? "cheer" : "encourage"}
        />
      </ModeChrome>
    );
  }

  return (
    <ModeChrome title="Write" onExit={onExit}>
      <p className="text-center text-xs font-semibold text-muted">
        {index + 1} / {deck.length} · type the definition
      </p>
      <div className="rounded-[1.75rem] border border-border bg-white px-6 py-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Term
        </p>
        <p className="mt-2 font-display text-2xl font-bold text-stone-900">
          {card.front}
        </p>
      </div>
      <form onSubmit={check} className="flex flex-col gap-3">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={status !== "idle"}
          placeholder="Type your answer..."
          className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
          autoFocus
        />
        {status === "idle" ? (
          <button
            type="submit"
            className="self-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Check
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p
              className={`text-sm font-semibold ${
                status === "correct" ? "text-teal-700" : "text-rose-600"
              }`}
            >
              {status === "correct" ? "Correct!" : `Answer: ${card.back}`}
            </p>
            <button
              type="button"
              onClick={() => {
                setAnswer("");
                setStatus("idle");
                setIndex((i) => i + 1);
              }}
              className="rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Continue →
            </button>
          </div>
        )}
      </form>
    </ModeChrome>
  );
}

function MatchMode({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) {
  // Quizlet-style: all tiles face-up; click a term then its definition.
  const pairs = useMemo(() => shuffle(cards).slice(0, 6), [cards]);
  type Tile = { id: string; pairId: number; text: string; side: "term" | "def" };
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  useEffect(() => {
    const built: Tile[] = [];
    pairs.forEach((card, pairId) => {
      built.push({ id: `t-${pairId}`, pairId, text: card.front, side: "term" });
      built.push({ id: `d-${pairId}`, pairId, text: card.back, side: "def" });
    });
    setTiles(shuffle(built));
  }, [pairs]);

  useEffect(() => {
    if (finishedAt !== null) return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);

  useEffect(() => {
    if (pairs.length > 0 && matched.size === pairs.length && finishedAt === null) {
      setFinishedAt(Date.now());
    }
  }, [matched, pairs.length, finishedAt]);

  function onTile(tile: Tile) {
    if (matched.has(tile.pairId) || wrongIds.length) return;
    if (!selected) {
      setSelected(tile.id);
      return;
    }
    if (selected === tile.id) {
      setSelected(null);
      return;
    }
    const first = tiles.find((t) => t.id === selected)!;
    if (first.pairId === tile.pairId && first.side !== tile.side) {
      setMatched((prev) => new Set(prev).add(first.pairId));
      setSelected(null);
    } else {
      setWrongIds([first.id, tile.id]);
      setTimeout(() => {
        setWrongIds([]);
        setSelected(null);
      }, 450);
    }
  }

  const done = finishedAt !== null;
  const seconds = done
    ? Math.floor((finishedAt! - startedAt) / 1000)
    : elapsed;

  return (
    <ModeChrome title="Match" onExit={onExit}>
      <div className="flex items-center justify-between text-xs font-semibold text-muted">
        <span>{seconds}s</span>
        <span>
          {matched.size}/{pairs.length} matched
        </span>
      </div>
      {done ? (
        <Results
          title="New match time!"
          subtitle={`You cleared the board in ${seconds} seconds`}
          known={pairs.length}
          total={pairs.length}
          pose="cheer"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tiles.map((tile) => {
            const isMatched = matched.has(tile.pairId);
            const isSelected = selected === tile.id;
            const isWrong = wrongIds.includes(tile.id);
            return (
              <button
                key={tile.id}
                type="button"
                disabled={isMatched}
                onClick={() => onTile(tile)}
                className={`min-h-[4.5rem] rounded-2xl border px-3 py-3 text-left text-sm font-medium transition-colors ${
                  isMatched
                    ? "border-transparent bg-transparent text-transparent"
                    : isWrong
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : isSelected
                        ? "border-brand bg-brand-soft text-brand-ink"
                        : "border-border bg-white text-stone-800 hover:border-brand/50"
                }`}
              >
                {isMatched ? "" : tile.text}
              </button>
            );
          })}
        </div>
      )}
    </ModeChrome>
  );
}

function TestMode({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) {
  const questions = useMemo(() => {
    return shuffle(cards).slice(0, Math.min(8, cards.length)).map((card, i) => {
      const kind: "mc" | "write" = i % 2 === 0 ? "mc" : "write";
      const options =
        kind === "mc"
          ? shuffle([
              card.back,
              ...shuffle(
                cards.filter((c) => c.back !== card.back).map((c) => c.back)
              ).slice(0, 3),
            ])
          : [];
      return { card, kind, options };
    });
  }, [cards]);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [graded, setGraded] = useState(false);
  const finished = index >= questions.length;
  const current = questions[index];

  function submitMc(choice: string) {
    if (graded) return;
    setGraded(true);
    setAnswer(choice);
    if (choice === current.card.back) setScore((s) => s + 1);
  }

  function submitWrite(e: FormEvent) {
    e.preventDefault();
    if (graded) return;
    setGraded(true);
    if (answersClose(answer, current.card.back)) setScore((s) => s + 1);
  }

  if (finished) {
    return (
      <ModeChrome title="Test" onExit={onExit}>
        <Results
          title="Test score"
          known={score}
          total={questions.length}
          pose={
            score === questions.length
              ? "cheer"
              : score >= questions.length / 2
                ? "proud"
                : "encourage"
          }
        />
      </ModeChrome>
    );
  }

  return (
    <ModeChrome title="Test" onExit={onExit}>
      <p className="text-center text-xs font-semibold text-muted">
        Question {index + 1} / {questions.length}
      </p>
      <div className="rounded-[1.75rem] border border-border bg-white px-6 py-8 text-center">
        <p className="font-display text-xl font-bold text-stone-900">
          {current.card.front}
        </p>
      </div>

      {current.kind === "mc" ? (
        <div className="grid grid-cols-1 gap-2">
          {current.options.map((choice) => {
            let style = "border-border bg-white hover:border-brand";
            if (graded) {
              if (choice === current.card.back) style = "border-teal-300 bg-teal-50";
              else if (choice === answer) style = "border-rose-200 bg-rose-50";
            }
            return (
              <button
                key={choice}
                type="button"
                disabled={graded}
                onClick={() => submitMc(choice)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium ${style}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={submitWrite} className="flex flex-col gap-3">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={graded}
            placeholder="Write the definition..."
            className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
          />
          {!graded && (
            <button
              type="submit"
              className="self-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white"
            >
              Submit
            </button>
          )}
          {graded && !answersClose(answer, current.card.back) && (
            <p className="text-center text-sm text-rose-600">
              Correct: {current.card.back}
            </p>
          )}
        </form>
      )}

      {graded && (
        <button
          type="button"
          onClick={() => {
            setAnswer("");
            setGraded(false);
            setIndex((i) => i + 1);
          }}
          className="self-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Next →
        </button>
      )}
    </ModeChrome>
  );
}

function Results({
  title,
  subtitle,
  known,
  total,
  pose,
}: {
  title: string;
  subtitle?: string;
  known: number;
  total: number;
  pose: "cheer" | "proud" | "encourage";
}) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-surface px-6 py-10 text-center">
      <AraAvatar size={80} pose={pose} showOutfits={false} />
      <p className="mt-3 font-display text-xl font-bold text-stone-900">{title}</p>
      <p className="mt-1 text-sm text-muted">
        {subtitle ?? `${known} / ${total} correct`}
      </p>
    </div>
  );
}

const STUDY_MODES = [
  {
    id: "flashcards" as const,
    title: "Flashcards",
    hint: "Flip terms & definitions",
    tone: "bg-sky-50 text-sky-700",
  },
  {
    id: "learn" as const,
    title: "Learn",
    hint: "Multiple-choice practice",
    tone: "bg-violet-50 text-violet-700",
  },
  {
    id: "write" as const,
    title: "Write",
    hint: "Type the answer yourself",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    id: "match" as const,
    title: "Match",
    hint: "Race to pair them all",
    tone: "bg-rose-50 text-rose-700",
  },
  {
    id: "test" as const,
    title: "Test",
    hint: "Scored practice exam",
    tone: "bg-teal-50 text-teal-700",
  },
];

export default function PracticePage() {
  const params = useParams<{ id: string }>();
  const subjectId = params.id;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [deck, setDeck] = useState<PracticeDeck | null>(null);
  const [mode, setMode] = useState<Mode>("set");
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubject = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchSubject(subjectId);
      setSubject(data);
    } catch {
      setError("Couldn't load this subject.");
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    void loadSubject();
  }, [loadSubject]);

  async function buildDeck() {
    setIsBuilding(true);
    setError(null);
    try {
      const data = await createPracticeDeck(subjectId);
      setDeck(data);
      setMode("set");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't build this study set right now."
      );
    } finally {
      setIsBuilding(false);
    }
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
      <main className="flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link
            href={`/subjects/${subjectId}`}
            className="text-sm font-semibold text-brand hover:text-teal-700"
          >
            ← Back to subject
          </Link>
          <div className="flex items-end gap-4">
            <AraAvatar size={64} pose="think" showOutfits={false} priority />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                Study set
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-stone-900">
                {subject ? `${subject.name} · ${subject.unit}` : "Loading..."}
              </h1>
              <p className="mt-1 text-sm text-muted">
                Quizlet-style practice from your notes
              </p>
            </div>
          </div>
        </header>

        {isLoading && <p className="text-sm text-muted">Loading...</p>}
        {error && <p className="text-sm text-rose-500">{error}</p>}

        {!isLoading && !deck && (
          <div className="rounded-[1.75rem] border border-border bg-surface p-7">
            <p className="font-display text-lg font-bold text-stone-900">
              Create your study set
            </p>
            <p className="mt-1 text-sm text-muted">
              Ara turns your logged notes into terms & definitions — then you
              can study with Flashcards, Learn, Write, Match, or Test.
            </p>
            <button
              type="button"
              onClick={() => void buildDeck()}
              disabled={isBuilding}
              className="mt-5 rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {isBuilding ? "Building set..." : "Create study set"}
            </button>
          </div>
        )}

        {deck && mode === "set" && (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Study
                </h2>
                <span className="text-xs font-semibold text-muted">
                  {deck.cards.length} terms
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {STUDY_MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className="interactive-tile flex flex-col gap-2 rounded-[1.25rem] border border-border bg-surface p-4 text-left"
                  >
                    <span
                      className={`w-fit rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.tone}`}
                    >
                      Mode
                    </span>
                    <span className="font-display text-sm font-bold text-stone-900">
                      {item.title}
                    </span>
                    <span className="text-[11px] leading-snug text-muted">
                      {item.hint}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Terms in this set
                </h2>
                <button
                  type="button"
                  onClick={() => void buildDeck()}
                  disabled={isBuilding}
                  className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
                >
                  {isBuilding ? "Refreshing..." : "Rebuild from notes"}
                </button>
              </div>
              <ul className="flex flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface">
                {deck.cards.map((card, i) => (
                  <li
                    key={`${card.front}-${i}`}
                    className={`grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-2 ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Term
                      </p>
                      <p className="mt-1 text-sm font-semibold text-stone-900">
                        {card.front}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Definition
                      </p>
                      <p className="mt-1 text-sm text-stone-600">{card.back}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {deck && mode === "flashcards" && (
          <FlashcardsMode cards={deck.cards} onExit={() => setMode("set")} />
        )}
        {deck && mode === "learn" && (
          <LearnMode cards={deck.cards} onExit={() => setMode("set")} />
        )}
        {deck && mode === "write" && (
          <WriteMode cards={deck.cards} onExit={() => setMode("set")} />
        )}
        {deck && mode === "match" && (
          <MatchMode cards={deck.cards} onExit={() => setMode("set")} />
        )}
        {deck && mode === "test" && (
          <TestMode cards={deck.cards} onExit={() => setMode("set")} />
        )}
      </main>
    </div>
  );
}
