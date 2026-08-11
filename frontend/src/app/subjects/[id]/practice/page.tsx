"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import AraAvatar from "@/components/AraAvatar";
import { IconTeach } from "@/components/nav-icons";
import {
  createPracticeDeck,
  fetchSubject,
  type Flashcard,
  type Subject,
} from "@/lib/api";

type Mode = "hub" | "flashcards" | "learn" | "write" | "match" | "test";

const BATCH_SIZE = 5;
const MAX_CARDS = 25;

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
          ← Practice
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
  onNeedMore,
  canLoadMore,
  loadingMore,
}: {
  cards: Flashcard[];
  onExit: () => void;
  onNeedMore: () => void;
  canLoadMore: boolean;
  loadingMore: boolean;
}) {
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[order[index]];
  const progress = cards.length ? ((index + 1) / order.length) * 100 : 0;

  useEffect(() => {
    setOrder(cards.map((_, i) => i));
  }, [cards.length]);

  function go(next: number) {
    if (next >= order.length) {
      if (canLoadMore) {
        onNeedMore();
        return;
      }
      setFlipped(false);
      setIndex(0);
      return;
    }
    setFlipped(false);
    setIndex((next + order.length) % order.length);
  }

  if (!card) {
    return (
      <ModeChrome title="Flashcards" onExit={onExit}>
        <p className="text-sm text-muted">Generating cards…</p>
      </ModeChrome>
    );
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
        {canLoadMore ? " · more unlock as you go" : ""}
      </p>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-64 w-full flex-col items-center justify-center rounded-[1.75rem] border border-border bg-surface px-8 py-12 text-center shadow-[0_20px_50px_-30px_rgba(28,25,23,0.4)] transition-transform active:scale-[0.99]"
      >
        <span className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {flipped ? "Answer" : "Prompt"} · click to flip
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
          disabled={loadingMore}
          className="rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loadingMore ? "…" : "→"}
        </button>
      </div>
    </ModeChrome>
  );
}

function LearnMode({
  cards,
  onExit,
  onNeedMore,
  canLoadMore,
  loadingMore,
}: {
  cards: Flashcard[];
  onExit: () => void;
  onNeedMore: () => void;
  canLoadMore: boolean;
  loadingMore: boolean;
}) {
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
        {canLoadMore && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => {
              setIndex(0);
              setPicked(null);
              setCorrectCount(0);
              onNeedMore();
            }}
            className="self-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loadingMore ? "Making more…" : "Keep going · new batch"}
          </button>
        )}
      </ModeChrome>
    );
  }

  return (
    <ModeChrome title="Learn" onExit={onExit}>
      <p className="text-center text-xs font-semibold text-muted">
        {index + 1} / {deck.length} · multiple choice
      </p>
      <div className="rounded-[1.75rem] border border-border bg-surface px-6 py-8 text-center shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Prompt
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

function WriteMode({
  cards,
  onExit,
  onNeedMore,
  canLoadMore,
  loadingMore,
}: {
  cards: Flashcard[];
  onExit: () => void;
  onNeedMore: () => void;
  canLoadMore: boolean;
  loadingMore: boolean;
}) {
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
        {canLoadMore && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => {
              setIndex(0);
              setAnswer("");
              setStatus("idle");
              setCorrectCount(0);
              onNeedMore();
            }}
            className="self-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loadingMore ? "Making more…" : "Keep going · new batch"}
          </button>
        )}
      </ModeChrome>
    );
  }

  return (
    <ModeChrome title="Write" onExit={onExit}>
      <p className="text-center text-xs font-semibold text-muted">
        {index + 1} / {deck.length} · type the answer
      </p>
      <div className="rounded-[1.75rem] border border-border bg-surface px-6 py-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Prompt
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
  const pairs = useMemo(() => shuffle(cards).slice(0, 6), [cards]);
  type Tile = { id: string; pairId: number; text: string; side: "a" | "b" };
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
      built.push({ id: `a-${pairId}`, pairId, text: card.front, side: "a" });
      built.push({ id: `b-${pairId}`, pairId, text: card.back, side: "b" });
    });
    setTiles(shuffle(built));
    setMatched(new Set());
    setSelected(null);
    setFinishedAt(null);
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
          title="Board cleared!"
          subtitle={`You finished in ${seconds} seconds`}
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

function TestMode({
  cards,
  onExit,
  onNeedMore,
  canLoadMore,
  loadingMore,
}: {
  cards: Flashcard[];
  onExit: () => void;
  onNeedMore: () => void;
  canLoadMore: boolean;
  loadingMore: boolean;
}) {
  const questions = useMemo(() => {
    return shuffle(cards)
      .slice(0, Math.min(8, cards.length))
      .map((card, i) => {
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
        {canLoadMore && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => {
              setIndex(0);
              setAnswer("");
              setScore(0);
              setGraded(false);
              onNeedMore();
            }}
            className="self-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loadingMore ? "Making more…" : "New test batch"}
          </button>
        )}
      </ModeChrome>
    );
  }

  return (
    <ModeChrome title="Test" onExit={onExit}>
      <p className="text-center text-xs font-semibold text-muted">
        Question {index + 1} / {questions.length}
      </p>
      <div className="rounded-[1.75rem] border border-border bg-surface px-6 py-8 text-center">
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
            placeholder="Write your answer..."
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
      <AraAvatar size={80} pose={pose} />
      <p className="mt-3 font-display text-xl font-bold text-stone-900">{title}</p>
      <p className="mt-1 text-sm text-muted">
        {subtitle ?? `${known} / ${total} correct`}
      </p>
    </div>
  );
}

const STUDY_MODES = [
  {
    id: "teach" as const,
    title: "Teach Ara",
    hint: "Explain topics at her desk",
    tone: "bg-teal-50 text-teal-700",
  },
  {
    id: "flashcards" as const,
    title: "Flashcards",
    hint: "Flip prompt & answer",
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
    tone: "bg-emerald-50 text-emerald-700",
  },
];

export default function PracticePage() {
  const params = useParams<{ id: string }>();
  const subjectId = params.id;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [mode, setMode] = useState<Mode>("hub");
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoadMore = cards.length < MAX_CARDS;

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

  async function ensureBatch(opts?: { forceNew?: boolean }) {
    if (cards.length > 0 && !opts?.forceNew) return cards;
    setIsBuilding(true);
    setError(null);
    try {
      const data = await createPracticeDeck(subjectId, {
        count: BATCH_SIZE,
        exclude_fronts: opts?.forceNew
          ? []
          : cards.map((c) => c.front),
      });
      setCards(data.cards);
      return data.cards;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't build practice cards right now."
      );
      return [];
    } finally {
      setIsBuilding(false);
    }
  }

  async function loadMoreCards() {
    if (!canLoadMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const remaining = MAX_CARDS - cards.length;
      const data = await createPracticeDeck(subjectId, {
        count: Math.min(BATCH_SIZE, remaining),
        exclude_fronts: cards.map((c) => c.front),
      });
      setCards((prev) => {
        const seen = new Set(prev.map((c) => c.front.toLowerCase()));
        const next = data.cards.filter(
          (c) => !seen.has(c.front.toLowerCase())
        );
        return [...prev, ...next].slice(0, MAX_CARDS);
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't generate more cards."
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function openMode(next: Mode) {
    setError(null);
    if (next === "hub") {
      setMode("hub");
      return;
    }
    const ready = await ensureBatch();
    if (ready.length === 0) return;
    setMode(next);
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
            <AraAvatar size={64} pose="think" priority />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                Practice
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-stone-900">
                {subject ? `${subject.name} · ${subject.unit}` : "Loading..."}
              </h1>
              <p className="mt-1 text-sm text-muted">
                Pick a mode — cards generate in small batches as you go
              </p>
            </div>
          </div>
        </header>

        {isLoading && <p className="text-sm text-muted">Loading...</p>}
        {error && <p className="text-sm text-rose-500">{error}</p>}

        {!isLoading && mode === "hub" && (
          <div className="flex flex-col gap-5">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STUDY_MODES.map((item) => {
                if (item.id === "teach") {
                  return (
                    <Link
                      key={item.id}
                      href={`/teach-ara?subject_id=${subjectId}`}
                      className="interactive-tile flex flex-col gap-2 rounded-[1.25rem] border border-border bg-surface p-4 text-left"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                        <IconTeach className="h-5 w-5" />
                      </span>
                      <span className="font-display text-sm font-bold text-stone-900">
                        {item.title}
                      </span>
                      <span className="text-[11px] leading-snug text-muted">
                        {item.hint}
                      </span>
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isBuilding}
                    onClick={() => void openMode(item.id)}
                    className="interactive-tile flex flex-col gap-2 rounded-[1.25rem] border border-border bg-surface p-4 text-left disabled:opacity-60"
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
                );
              })}
            </section>

            <div className="rounded-[1.5rem] border border-dashed border-border bg-brand-soft/30 px-5 py-4 text-sm text-brand-ink">
              {isBuilding ? (
                <p>Ara is making your first practice batch…</p>
              ) : cards.length > 0 ? (
                <p>
                  Ready with {cards.length} card
                  {cards.length === 1 ? "" : "s"}
                  {canLoadMore
                    ? ` · up to ${MAX_CARDS} as you keep practicing`
                    : " · batch cap reached"}
                  . Prompts stay hidden until you play a mode.
                </p>
              ) : (
                <p>
                  No term list here — choose a mode and Ara will generate a
                  small batch from your notes (then more as you continue).
                </p>
              )}
            </div>

            {cards.length > 0 && (
              <button
                type="button"
                disabled={isBuilding}
                onClick={() => void ensureBatch({ forceNew: true })}
                className="self-start text-xs font-semibold text-brand hover:underline disabled:opacity-50"
              >
                {isBuilding ? "Refreshing…" : "Refresh first batch from notes"}
              </button>
            )}
          </div>
        )}

        {mode === "flashcards" && cards.length > 0 && (
          <FlashcardsMode
            cards={cards}
            onExit={() => setMode("hub")}
            onNeedMore={() => void loadMoreCards()}
            canLoadMore={canLoadMore}
            loadingMore={loadingMore}
          />
        )}
        {mode === "learn" && cards.length > 0 && (
          <LearnMode
            cards={cards}
            onExit={() => setMode("hub")}
            onNeedMore={() => void loadMoreCards()}
            canLoadMore={canLoadMore}
            loadingMore={loadingMore}
          />
        )}
        {mode === "write" && cards.length > 0 && (
          <WriteMode
            cards={cards}
            onExit={() => setMode("hub")}
            onNeedMore={() => void loadMoreCards()}
            canLoadMore={canLoadMore}
            loadingMore={loadingMore}
          />
        )}
        {mode === "match" && cards.length > 0 && (
          <MatchMode cards={cards} onExit={() => setMode("hub")} />
        )}
        {mode === "test" && cards.length > 0 && (
          <TestMode
            cards={cards}
            onExit={() => setMode("hub")}
            onNeedMore={() => void loadMoreCards()}
            canLoadMore={canLoadMore}
            loadingMore={loadingMore}
          />
        )}
      </main>
    </div>
  );
}
