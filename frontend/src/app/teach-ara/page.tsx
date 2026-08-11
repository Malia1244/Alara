"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CharacterStage from "@/components/CharacterStage";
import { IconTeach } from "@/components/nav-icons";
import type { AraPose } from "@/lib/araPoses";
import {
  fetchTeachTopics,
  sendTeachAraMessage,
  startTeachAra,
  type AraMemoryCard,
  type TeachChatTurn,
  type TeachReviewEntry,
  type TeachTopic,
} from "@/lib/api";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
  type SpeechRecognitionLike,
} from "@/lib/speech";

type ChatLine = TeachChatTurn & { status?: string };

function poseForStatus(status?: string): AraPose {
  if (status === "understood") return "sitUnderstood";
  if (status === "confused") return "sitConfused";
  if (status === "clarify") return "sitClarify";
  if (status === "ask") return "sitClarify";
  return "sitConfused";
}

function expressionLabel(status?: string): string {
  if (status === "understood") return "Understood";
  if (status === "confused") return "Needs another pass";
  if (status === "clarify") return "Almost there";
  if (status === "ask") return "Ready to learn";
  return "Listening";
}

export default function TeachAraPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-16 text-sm text-muted">
          Loading Teach Ara…
        </div>
      }
    >
      <TeachAraInner />
    </Suspense>
  );
}

function TeachAraInner() {
  const searchParams = useSearchParams();
  const focusSubjectId = searchParams.get("subject_id");

  const [topics, setTopics] = useState<TeachTopic[]>([]);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [pose, setPose] = useState<AraPose>("sitConfused");
  const [expression, setExpression] = useState<string>("ask");
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [reviewEntry, setReviewEntry] = useState<TeachReviewEntry | null>(null);
  const [reviewPrompt, setReviewPrompt] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewed, setReviewed] = useState(true);
  const [pendingTeachMessage, setPendingTeachMessage] = useState("");
  const [pastMemories, setPastMemories] = useState<AraMemoryCard[]>([]);
  const [savedMemory, setSavedMemory] = useState<string | null>(null);

  const [voiceMode, setVoiceMode] = useState(true);
  const [araTalks, setAraTalks] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messagesRef = useRef<ChatLine[]>([]);
  const sendingRef = useRef(false);
  messagesRef.current = messages;
  sendingRef.current = sending;

  const visibleTopics = useMemo(() => {
    if (!focusSubjectId) return topics;
    const focused = topics.filter((t) => t.subject_id === focusSubjectId);
    return focused.length > 0 ? focused : topics;
  }, [topics, focusSubjectId]);

  useEffect(() => {
    setVoiceSupported(isSpeechRecognitionSupported());
    setTtsSupported(isSpeechSynthesisSupported());
    // Chrome loads voices async
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchTeachTopics()
      .then((rows) => {
        if (!cancelled) setTopics(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingTopics(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, savedMemory, interim]);

  useEffect(() => {
    if (!savedMemory) return;
    const timer = window.setTimeout(() => setSavedMemory(null), 6000);
    return () => window.clearTimeout(timer);
  }, [savedMemory]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  function maybeSpeak(text: string) {
    if (!voiceMode || !araTalks || !ttsSupported) return;
    speakText(text);
  }

  async function beginSession(picked?: TeachTopic) {
    setError(null);
    setStarting(true);
    setSessionReady(false);
    setMessages([]);
    setReviewEntry(null);
    setReviewPrompt("");
    setPendingTeachMessage("");
    setReviewed(true);
    setShowReviewModal(false);
    setPastMemories([]);
    setSavedMemory(null);
    stopSpeaking();
    try {
      const start = await startTeachAra(
        picked
          ? {
              topic: picked.topic,
              subject: picked.subject,
              subject_id: picked.subject_id,
            }
          : undefined
      );
      setTopic(start.topic);
      setSubject(start.subject);
      setSubjectId(start.subject_id);
      setPastMemories(start.past_memories ?? []);
      setPose("sitClarify");
      setExpression("ask");
      setSessionReady(true);

      if (start.review_entry) {
        setReviewEntry(start.review_entry);
        setReviewPrompt(start.review_prompt || "");
        setPendingTeachMessage(start.message);
        setReviewed(false);
        setShowReviewModal(true);
        const reviewLine =
          start.review_prompt ||
          "Review this notes entry first, then teach me.";
        setMessages([
          {
            role: "ara",
            content: reviewLine,
            status: "ask",
          },
        ]);
        maybeSpeak(reviewLine);
      } else {
        setMessages([{ role: "ara", content: start.message, status: "ask" }]);
        maybeSpeak(start.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setStarting(false);
    }
  }

  function closeReviewModal() {
    setShowReviewModal(false);
    if (!reviewed) {
      setReviewed(true);
      if (pendingTeachMessage) {
        const msg = pendingTeachMessage;
        setMessages((prev) => [
          ...prev,
          { role: "ara", content: msg, status: "ask" },
        ]);
        setPendingTeachMessage("");
        maybeSpeak(msg);
      }
    }
  }

  async function sendTeach(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !sessionReady || sendingRef.current || !reviewed) return;

    stopSpeaking();
    const history = messagesRef.current.map(({ role, content }) => ({
      role,
      content,
    }));
    const nextUser: ChatLine = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, nextUser]);
    setDraft("");
    setInterim("");
    setSending(true);
    setError(null);
    setPose("sitConfused");
    setExpression("thinking");

    try {
      const reply = await sendTeachAraMessage({
        topic,
        subject,
        subject_id: subjectId,
        message: trimmed,
        history,
      });
      setPose(poseForStatus(reply.status));
      setExpression(reply.status);
      const lines: ChatLine[] = [
        { role: "ara", content: reply.message, status: reply.status },
      ];
      if (reply.follow_up) {
        lines.push({
          role: "ara",
          content: reply.follow_up,
          status: reply.status,
        });
      }
      setMessages((prev) => [...prev, ...lines]);
      const spoken = [reply.message, reply.follow_up].filter(Boolean).join(" ");
      maybeSpeak(spoken);
      if (reply.memory_saved && reply.lesson_summary) {
        setSavedMemory(reply.lesson_summary);
        setPastMemories((prev) => [
          { topic, subject, summary: reply.lesson_summary || "" },
          ...prev.filter(
            (m) =>
              !(
                m.topic.toLowerCase() === topic.toLowerCase() &&
                m.subject.toLowerCase() === subject.toLowerCase()
              )
          ),
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ara got stuck");
      setMessages((prev) => prev.slice(0, -1));
      setDraft(trimmed);
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await sendTeach(draft);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function startListening() {
    if (!voiceSupported || listening || sending || !reviewed) return;
    stopSpeaking();

    const recognition = createSpeechRecognition();
    if (!recognition) {
      setVoiceSupported(false);
      setError("Voice isn’t supported here — try Chrome.");
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalBits = "";

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0].transcript;
        if (result.isFinal) {
          finalBits += (finalBits ? " " : "") + piece.trim();
          setDraft((prev) => {
            const base = prev.trim();
            const add = piece.trim();
            return base ? `${base} ${add}` : add;
          });
        } else {
          interimText += piece;
        }
      }
      setInterim(interimText.trim());
    };

    recognition.onerror = (event) => {
      setListening(false);
      setInterim("");
      if (event.error === "not-allowed") {
        setError("Microphone permission was blocked.");
      } else if (event.error !== "aborted") {
        setError("Couldn’t hear that — try the mic again.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
      const spoken = finalBits.trim();
      // In voice mode, send when the user stops talking.
      if (voiceMode && spoken && !sendingRef.current) {
        void sendTeach(spoken);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      setError("Couldn’t start the mic — try again.");
    }
  }

  function toggleMic() {
    if (listening) stopListening();
    else startListening();
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-8 sm:px-8 sm:py-10">
      <main className="flex w-full max-w-3xl flex-col gap-5">
        <header className="animate-rise flex items-start gap-3">
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <IconTeach className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Study mode
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
              Teach Ara
            </h1>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
              Type — or turn on Voice study and talk it out. Ara listens, asks
              questions, and can speak back.
            </p>
          </div>
        </header>

        <section className="animate-rise flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={voiceMode}
              onChange={(e) => {
                setVoiceMode(e.target.checked);
                if (!e.target.checked) {
                  stopListening();
                  stopSpeaking();
                }
              }}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Voice study
          </label>
          <label
            className={`flex items-center gap-2 text-sm font-medium ${
              voiceMode ? "cursor-pointer text-ink" : "text-muted"
            }`}
          >
            <input
              type="checkbox"
              checked={araTalks}
              disabled={!voiceMode || !ttsSupported}
              onChange={(e) => {
                setAraTalks(e.target.checked);
                if (!e.target.checked) stopSpeaking();
              }}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Ara talks back
          </label>
          {!voiceSupported && (
            <p className="text-xs text-accent">
              Mic dictation needs Chrome / Edge.
            </p>
          )}
        </section>

        <section className="animate-rise-delay flex flex-col items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-6">
          <CharacterStage size={180} pose={pose} priority pad="lg" />
          <div className="ara-callout max-w-sm px-4 py-2.5 text-sm text-ink">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              Ara · status
            </p>
            <p className="mt-0.5 font-medium">
              {listening
                ? "Listening to you…"
                : sending
                  ? "Thinking…"
                  : expressionLabel(expression)}
            </p>
          </div>
          {sessionReady && (
            <p className="rounded-lg border border-border bg-surface px-4 py-1.5 text-center text-xs font-semibold text-brand-ink">
              Learning: {topic}
              <span className="mx-1.5 text-muted">·</span>
              {subject}
            </p>
          )}
          {sessionReady && pastMemories.length > 0 && (
            <div className="w-full max-w-md rounded-xl border border-border bg-surface px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                Ara remembers
              </p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {pastMemories.slice(0, 3).map((memory) => (
                  <li
                    key={`${memory.subject}-${memory.topic}-${memory.summary.slice(0, 24)}`}
                    className="text-xs leading-snug text-ink/80"
                  >
                    <span className="font-semibold text-brand-ink">
                      {memory.topic}
                    </span>
                    <span className="text-muted"> — {memory.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {!sessionReady ? (
          <section className="animate-rise rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              What should Ara learn?
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pick a topic, then teach by typing or talking.
            </p>

            {loadingTopics ? (
              <p className="mt-4 text-sm text-muted">Looking at your notes…</p>
            ) : visibleTopics.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-brand-soft/40 px-4 py-5 text-sm text-brand-ink">
                Add a subject and some notes first, then come back to teach Ara.
                <Link href="/" className="mt-2 block font-semibold underline">
                  Go home
                </Link>
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {visibleTopics.map((item) => (
                  <li key={`${item.subject}-${item.topic}`}>
                    <button
                      type="button"
                      disabled={starting}
                      onClick={() => void beginSession(item)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left transition hover:border-brand/40 hover:bg-brand-soft/40 disabled:opacity-60"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-ink">
                          {item.topic}
                        </span>
                        <span className="text-xs text-muted">{item.subject}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          item.reason === "struggling"
                            ? "bg-accent-soft text-accent"
                            : "bg-brand-soft text-brand"
                        }`}
                      >
                        {item.reason === "struggling" ? "Struggling" : "Learning"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              disabled={starting || visibleTopics.length === 0}
              onClick={() => {
                if (focusSubjectId) {
                  const pool = visibleTopics;
                  const pick =
                    pool.find((t) => t.reason === "struggling") ?? pool[0];
                  void beginSession(pick);
                  return;
                }
                void beginSession();
              }}
              className="mt-4 w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
            >
              {starting ? "Getting ready…" : "Surprise me"}
            </button>
          </section>
        ) : (
          <section className="animate-rise flex min-h-[22rem] flex-col rounded-2xl border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {voiceMode ? "Voice lesson" : "Lesson chat"}
              </p>
              <div className="flex items-center gap-3">
                {reviewEntry && (
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(true)}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Show notes
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    stopListening();
                    stopSpeaking();
                    setSessionReady(false);
                    setMessages([]);
                    setReviewEntry(null);
                    setShowReviewModal(false);
                    setPastMemories([]);
                    setSavedMemory(null);
                    setPose("sitConfused");
                    setExpression("ask");
                  }}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  New topic
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {messages.map((line, index) => (
                <div
                  key={`${line.role}-${index}-${line.content.slice(0, 12)}`}
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    line.role === "user"
                      ? "ml-auto bg-brand text-white"
                      : "mr-auto border border-border bg-panel text-ink"
                  }`}
                >
                  {line.role === "ara" && line.status && line.status !== "ask" && (
                    <span
                      className={`mb-1 block text-[10px] font-bold uppercase tracking-wide ${
                        line.status === "understood"
                          ? "text-brand"
                          : line.status === "confused"
                            ? "text-accent"
                            : "text-amber"
                      }`}
                    >
                      {line.status === "understood"
                        ? "Got it"
                        : line.status === "confused"
                          ? "Confused"
                          : "Needs clarity"}
                    </span>
                  )}
                  {line.content}
                </div>
              ))}
              {listening && interim && (
                <p className="ml-auto max-w-[85%] rounded-xl bg-brand/20 px-3.5 py-2 text-sm italic text-brand-ink">
                  {interim}…
                </p>
              )}
              {sending && (
                <p className="text-xs font-medium text-muted">Ara is thinking…</p>
              )}
              {savedMemory && (
                <div className="ara-callout mr-auto max-w-[90%] px-3.5 py-2.5 text-sm text-ink">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    Ara · remembered
                  </p>
                  <p className="mt-1 leading-relaxed">{savedMemory}</p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={onSubmit}
              className="border-t border-border p-3 sm:p-4"
            >
              {voiceMode && (
                <div className="mb-3 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMic}
                    disabled={!voiceSupported || sending || !reviewed}
                    className={`flex h-16 w-16 items-center justify-center rounded-full text-sm font-bold text-white shadow-md transition disabled:opacity-50 ${
                      listening
                        ? "animate-pulse bg-accent"
                        : "bg-brand hover:bg-brand-ink"
                    }`}
                    aria-pressed={listening}
                    aria-label={listening ? "Stop listening" : "Start talking"}
                  >
                    {listening ? "Stop" : "Mic"}
                  </button>
                  <p className="text-center text-xs text-muted">
                    {listening
                      ? "Listening… tap Stop when you’re done — Ara will answer."
                      : "Tap Mic, explain out loud, then tap Stop."}
                  </p>
                </div>
              )}

              <label htmlFor="teach-input" className="sr-only">
                Teach Ara
              </label>
              <div className="flex gap-2">
                <textarea
                  id="teach-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder={
                    reviewed
                      ? voiceMode
                        ? "Or type here if you prefer…"
                        : "Explain it in your own words…"
                      : "Review the notes popup first…"
                  }
                  className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-brand/30 focus:ring-2"
                  disabled={sending || !reviewed}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim() || !reviewed}
                  className="shrink-0 self-end rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
                >
                  Teach
                </button>
              </div>
            </form>
          </section>
        )}

        {error && (
          <p className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
            {error}
          </p>
        )}
      </main>

      {showReviewModal && reviewEntry && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-notes-title"
        >
          <div className="animate-rise flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_80px_-40px_rgba(12,18,34,0.55)]">
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <IconTeach className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Review first
                </p>
                <p
                  id="review-notes-title"
                  className="mt-1 text-sm font-medium leading-snug text-ink"
                >
                  {reviewPrompt ||
                    "Look over this notes entry, then come teach Ara."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                className="rounded-lg px-2 py-1 text-lg leading-none text-muted hover:bg-panel hover:text-ink"
                aria-label="Close notes"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-brand">
                  {reviewEntry.subject}
                </span>
                {reviewEntry.unit && (
                  <span className="rounded-lg bg-panel px-2.5 py-1">
                    {reviewEntry.unit}
                  </span>
                )}
                {reviewEntry.created_at && (
                  <span>
                    {new Date(reviewEntry.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
                {reviewEntry.content}
              </p>
            </div>
            <div className="border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={closeReviewModal}
                className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
              >
                {reviewed
                  ? "Close notes"
                  : "I've reviewed this — teach Ara"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
