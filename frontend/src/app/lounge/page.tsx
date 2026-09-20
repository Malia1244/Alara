"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type PendingImage = {
  base64: string;
  mime: string;
  preview: string;
};

type Thread = {
  parent: LoungeMessage;
  replies: LoungeMessage[];
};

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fileToBase64(file: File): Promise<PendingImage> {
  let mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    if (name.endsWith(".png")) mime = "image/png";
    else if (name.endsWith(".webp")) mime = "image/webp";
    else if (name.endsWith(".gif")) mime = "image/gif";
    else mime = "image/jpeg";
  }
  if (mime === "image/heic" || mime === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif")) {
    throw new Error(
      "iPhone HEIC photos aren't supported yet. Take a screenshot of the worksheet, or export as JPEG."
    );
  }
  if (!mime.startsWith("image/")) {
    throw new Error("Please choose a photo (JPEG, PNG, or WebP).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("That photo is too large — try one under 4 MB.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(",");
  const header = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mimeMatch = /data:([^;]+)/i.exec(header);
  const detected = (mimeMatch?.[1] || mime || "image/jpeg").toLowerCase();
  return { base64, mime: detected, preview: dataUrl };
}

function threadMessages(messages: LoungeMessage[]): Thread[] {
  const byId = new Map(messages.map((row) => [row.id, row]));

  function rootId(row: LoungeMessage) {
    let current = row;
    const seen = new Set<string>();
    while (
      current.reply_to_id &&
      byId.has(current.reply_to_id) &&
      !seen.has(current.id)
    ) {
      seen.add(current.id);
      current = byId.get(current.reply_to_id)!;
    }
    return current.id;
  }

  const buckets = new Map<string, LoungeMessage[]>();
  for (const row of messages) {
    const id = rootId(row);
    const list = buckets.get(id) ?? [];
    list.push(row);
    buckets.set(id, list);
  }

  const threads: Thread[] = [];
  for (const row of messages) {
    if (!buckets.has(row.id)) continue;
    const group = buckets.get(row.id)!;
    buckets.delete(row.id);
    threads.push({
      parent: row,
      replies: group.filter((item) => item.id !== row.id),
    });
  }
  return threads;
}

function Bubble({
  message,
  indented,
  onReply,
  onDelete,
}: {
  message: LoungeMessage;
  indented?: boolean;
  onReply: (message: LoungeMessage) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
        message.is_mine
          ? `${indented ? "ml-10 " : ""}ml-auto bg-brand text-white`
          : `${indented ? "ml-7 sm:ml-10 " : ""}mr-auto border border-border bg-panel text-ink`
      }`}
    >
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p
          className={`text-[11px] font-semibold ${
            message.is_mine ? "text-white/80" : "text-muted"
          }`}
        >
          {message.is_mine ? "You" : message.author_label}
          {indented ? " · answer" : ""}
        </p>
        <p
          className={`text-[10px] ${
            message.is_mine ? "text-white/70" : "text-muted"
          }`}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
      {message.reply_to_preview && !indented && (
        <p
          className={`mb-1.5 line-clamp-2 rounded-md px-2 py-1 text-[11px] ${
            message.is_mine ? "bg-white/15 text-white/85" : "bg-white text-muted"
          }`}
        >
          Replying to {message.reply_to_label ?? "a post"}:{" "}
          {message.reply_to_preview}
        </p>
      )}
      {message.image_url && (
        <a
          href={message.image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.image_url}
            alt="Assignment photo"
            className={`max-h-56 w-auto rounded-lg object-contain ${
              message.is_mine ? "border border-white/30" : "border border-border"
            }`}
          />
        </a>
      )}
      {message.body && (
        <p className="whitespace-pre-wrap">{message.body}</p>
      )}
      <div className="mt-1.5 flex gap-3">
        <button
          type="button"
          onClick={() => onReply(message)}
          className={`text-[11px] font-semibold hover:underline ${
            message.is_mine ? "text-white/80" : "text-brand"
          }`}
        >
          Answer
        </button>
        {message.is_mine && (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            className={`text-[11px] font-semibold hover:underline ${
              message.is_mine ? "text-white/80" : "text-accent"
            }`}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoungePage() {
  const [messages, setMessages] = useState<LoungeMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [replyTo, setReplyTo] = useState<LoungeMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stickToBottom = useRef(true);

  const threads = useMemo(() => threadMessages(messages), [messages]);

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

  async function onPickImage(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      setPendingImage(await fileToBase64(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use that photo.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (sending || (!text && !pendingImage)) return;
    setSending(true);
    setError(null);
    try {
      const saved = await postLoungeMessage({
        body: text,
        reply_to_id: replyTo?.id ?? null,
        image_base64: pendingImage?.base64 ?? null,
        image_mime: pendingImage?.mime ?? null,
      });
      setDraft("");
      setPendingImage(null);
      setReplyTo(null);
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
      if (replyTo?.id === id) setReplyTo(null);
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
              Stuck on an assignment? Post a photo of the problem and ask how to
              do it. Other students can answer with what they think.
            </p>
          </div>
        </header>

        <section className="animate-rise-delay flex items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-3">
          <CharacterStage size={64} pose="wave" pad="sm" />
          <p className="text-sm text-ink">
            Share the worksheet, explain where you&apos;re stuck, then tap{" "}
            <span className="font-semibold">Answer</span> on someone&apos;s post
            to help. For private step-by-step help from Ara, use Homework Help.
          </p>
        </section>

        <section className="animate-rise flex min-h-[28rem] flex-col rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Assignment help
            </p>
            <p className="text-[11px] text-muted">Updates every few seconds</p>
          </div>

          <div
            className="flex max-h-[32rem] flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
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
                No questions yet. Attach a photo and ask how to start.
              </p>
            )}
            {threads.map(({ parent, replies }) => (
              <div key={parent.id} className="flex flex-col gap-2">
                <Bubble
                  message={parent}
                  onReply={setReplyTo}
                  onDelete={(id) => void onDelete(id)}
                />
                {replies.map((reply) => (
                  <Bubble
                    key={reply.id}
                    message={reply}
                    indented
                    onReply={setReplyTo}
                    onDelete={(id) => void onDelete(id)}
                  />
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-border p-3 sm:p-4"
          >
            {replyTo && (
              <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-brand/25 bg-brand-soft/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                    Answering {replyTo.is_mine ? "yourself" : replyTo.author_label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {replyTo.body || "Photo question"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="shrink-0 text-xs font-semibold text-brand-ink hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
            {pendingImage && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-panel px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImage.preview}
                  alt="Selected assignment"
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink">Photo attached</p>
                  <p className="text-[11px] text-muted">
                    Everyone will see this with your question
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
            <label htmlFor="lounge-input" className="sr-only">
              Ask the lounge
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand-soft/50 px-3 py-3 text-sm font-semibold text-brand-ink transition hover:border-brand hover:bg-brand-soft disabled:opacity-50"
            >
              {pendingImage ? "Change photo" : "Add assignment photo"}
            </button>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                className="hidden"
                onChange={(e) => {
                  void onPickImage(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <textarea
                id="lounge-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, BODY_MAX))}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const item of Array.from(items)) {
                    if (!item.type.startsWith("image/")) continue;
                    const file = item.getAsFile();
                    if (!file) continue;
                    e.preventDefault();
                    void onPickImage(file);
                    return;
                  }
                }}
                rows={2}
                maxLength={BODY_MAX}
                placeholder={
                  replyTo
                    ? "Write how you would do it…"
                    : "Ask how to do this, or paste a photo of the worksheet…"
                }
                className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-brand/30 focus:ring-2"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || (!draft.trim() && !pendingImage)}
                className="shrink-0 self-end rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
              >
                {sending ? "Sending…" : replyTo ? "Answer" : "Ask"}
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
