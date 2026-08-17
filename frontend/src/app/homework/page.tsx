"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { IconHomework } from "@/components/nav-icons";
import {
  sendHomeworkHelp,
  type HomeworkChatTurn,
} from "@/lib/api";

type ChatLine = HomeworkChatTurn & {
  imagePreview?: string | null;
};

const WELCOME: ChatLine = {
  role: "ara",
  content:
    "Stuck on homework? Type the question, attach a photo of the worksheet, or both — I'll walk you through it step by step.",
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function fileToBase64(file: File): Promise<{
  base64: string;
  mime: string;
  preview: string;
}> {
  if (!file.type.startsWith("image/")) {
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
  const mime = mimeMatch?.[1] || file.type || "image/jpeg";
  return { base64, mime, preview: dataUrl };
}

export default function HomeworkHelpPage() {
  const [messages, setMessages] = useState<ChatLine[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mime: string;
    preview: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, pendingImage]);

  async function onPickImage(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const parsed = await fileToBase64(file);
      setPendingImage(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use that photo");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (sending || (!text && !pendingImage)) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    const nextUser: ChatLine = {
      role: "user",
      content: text || "(sent a homework photo)",
      imagePreview: pendingImage?.preview ?? null,
    };
    setMessages((prev) => [...prev, nextUser]);
    setDraft("");
    const image = pendingImage;
    setPendingImage(null);
    setSending(true);
    setError(null);

    try {
      const reply = await sendHomeworkHelp({
        question: text,
        history,
        image_base64: image?.base64 ?? null,
        image_mime: image?.mime ?? null,
      });
      const lines: ChatLine[] = [{ role: "ara", content: reply.message }];
      if (reply.follow_up) {
        lines.push({ role: "ara", content: reply.follow_up });
      }
      setMessages((prev) => [...prev, ...lines]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ara got stuck");
      setMessages((prev) => prev.slice(0, -1));
      setDraft(text);
      if (image) setPendingImage(image);
    } finally {
      setSending(false);
    }
  }

  function clearChat() {
    setMessages([WELCOME]);
    setDraft("");
    setPendingImage(null);
    setError(null);
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-8 sm:px-8 sm:py-10">
      <main className="flex w-full max-w-3xl flex-col gap-5">
        <header className="animate-rise flex items-start gap-3">
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <IconHomework className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Study help
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
              Homework Help
            </h1>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
              Ask Ara a question — type it out or upload a photo of the problem.
              She&apos;ll guide you through the steps so you learn the method.
            </p>
          </div>
        </header>

        <section className="animate-rise-delay flex flex-col items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-6">
          <div
            className={`transition-transform duration-300 ${
              sending ? "scale-[0.98]" : "scale-100"
            }`}
          >
            <CharacterStage
              size={160}
              pose={sending ? "sitClarify" : "sitUnderstood"}
              priority
              pad="lg"
            />
          </div>
          <div className="ara-callout max-w-sm px-4 py-2.5 text-sm text-ink">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              Ara · status
            </p>
            <p className="mt-0.5 font-medium">
              {sending ? "Working through it…" : "Ready when you are"}
            </p>
          </div>
        </section>

        <section className="animate-rise flex min-h-[24rem] flex-col rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Homework chat
            </p>
            <button
              type="button"
              onClick={clearChat}
              className="text-xs font-semibold text-brand hover:underline"
            >
              New question
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((line, index) => (
              <div
                key={`${line.role}-${index}-${line.content.slice(0, 16)}`}
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  line.role === "user"
                    ? "ml-auto bg-brand text-white"
                    : "mr-auto border border-border bg-panel text-ink"
                }`}
              >
                {line.imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.imagePreview}
                    alt="Homework upload"
                    className="mb-2 max-h-48 w-auto rounded-lg border border-white/30 object-contain"
                  />
                )}
                <p className="whitespace-pre-wrap">{line.content}</p>
              </div>
            ))}
            {sending && (
              <p className="text-xs font-medium text-muted">
                Ara is reviewing your homework…
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-border p-3 sm:p-4"
          >
            {pendingImage && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-panel px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImage.preview}
                  alt="Selected homework"
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink">
                    Photo attached
                  </p>
                  <p className="text-[11px] text-muted">
                    Ara will read this with your question
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

            <label htmlFor="homework-input" className="sr-only">
              Ask Ara about homework
            </label>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  void onPickImage(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={sending}
                className="shrink-0 self-end rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-brand-ink transition hover:border-brand/40 hover:bg-brand-soft/40 disabled:opacity-50"
                aria-label="Upload homework photo"
              >
                Photo
              </button>
              <textarea
                id="homework-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
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
                placeholder="Type the question, paste a photo, or add a photo…"
                className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-brand/30 focus:ring-2"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || (!draft.trim() && !pendingImage)}
                className="shrink-0 self-end rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
              >
                Ask
              </button>
            </div>
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
