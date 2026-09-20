"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { IconLounge } from "@/components/nav-icons";
import {
  apiUnreachableMessage,
  deleteLoungeMessage,
  fetchLoungeMessages,
  postLoungeMessage,
  type LoungeMessage,
} from "@/lib/api";

const POLL_MS = 4000;
const BODY_MAX = 500;

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LoungePage() {
  const [messages, setMessages] = useState<LoungeMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  const loadMessages = useCallback(async (quiet = false) => {
    try {
      const data = await fetchLoungeMessages();
      setMessages(data);
      if (!quiet) setError(null);
    } catch (err) {
      if (!quiet) {
        setError(
          err instanceof Error ? err.message : apiUnreachableMessage()
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
    const id = window.setInterval(() => {
      void loadMessages(true);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const saved = await postLoungeMessage(text);
      setDraft("");
      stickToBottom.current = true;
      setMessages((current) => {
        if (current.some((row) => row.id === saved.id)) return current;
        return [...current, saved];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteLoungeMessage(id);
      setMessages((current) => current.filter((row) => row.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that.");
    }
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-8 sm:px-8 sm:py-10">
      <main className="flex w-full max-w-3xl flex-col gap-5">
        <header className="animate-rise flex items-start gap-3">
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <IconLounge className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Everyone
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
              Lounge
            </h1>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
              One shared room for every Alara student. Class rooms come later —
              this is the all-campus chat.
            </p>
          </div>
        </header>

        <section className="animate-rise-delay flex items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-3">
          <CharacterStage size={64} pose="wave" pad="sm" />
          <p className="text-sm text-ink">
            Be kind. Homework Help stays private with Ara — this room is for
            saying hi and studying together.
          </p>
        </section>

        <section className="animate-rise flex min-h-[28rem] flex-col rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Shared chat
            </p>
            <p className="text-[11px] text-muted">Updates every few seconds</p>
          </div>

          <div
            className="flex max-h-[28rem] flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
            onScroll={(e) => {
              const el = e.currentTarget;
              const remaining =
                el.scrollHeight - el.scrollTop - el.clientHeight;
              stickToBottom.current = remaining < 48;
            }}
          >
            {isLoading && (
              <p className="text-center text-sm text-muted">Opening lounge…</p>
            )}
            {!isLoading && messages.length === 0 && !error && (
              <p className="text-center text-sm text-muted">
                Nobody has written yet. Say hi — everyone will see it.
              </p>
            )}
            {messages.map((line) => (
              <div
                key={line.id}
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  line.is_mine
                    ? "ml-auto bg-brand text-white"
                    : "mr-auto border border-border bg-panel text-ink"
                }`}
              >
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <p
                    className={`text-[11px] font-semibold ${
                      line.is_mine ? "text-white/80" : "text-muted"
                    }`}
                  >
                    {line.is_mine ? "You" : line.author_label}
                  </p>
                  <p
                    className={`text-[10px] ${
                      line.is_mine ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {formatTime(line.created_at)}
                  </p>
                </div>
                <p className="whitespace-pre-wrap">{line.body}</p>
                {line.is_mine && (
                  <button
                    type="button"
                    onClick={() => void onDelete(line.id)}
                    className="mt-1.5 text-[11px] font-semibold text-white/80 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-border p-3 sm:p-4"
          >
            <label htmlFor="lounge-input" className="sr-only">
              Message the lounge
            </label>
            <div className="flex gap-2">
              <textarea
                id="lounge-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, BODY_MAX))}
                rows={2}
                maxLength={BODY_MAX}
                placeholder="Write something for everyone…"
                className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-brand/30 focus:ring-2"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="shrink-0 self-end rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
            <p className="mt-1.5 text-right text-[11px] text-muted">
              {draft.length}/{BODY_MAX}
            </p>
          </form>
        </section>

        {error && (
          <p className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
