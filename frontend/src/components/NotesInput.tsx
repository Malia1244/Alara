"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { notesFromImage } from "@/lib/api";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  subject?: string;
  unit?: string;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
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
  return { base64, mime };
}

export default function NotesInput({
  id = "content",
  value,
  onChange,
  placeholder = "Paste or type your notes, or paste/upload a photo…",
  rows = 6,
  required = false,
  subject,
  unit,
}: Props) {
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Keep the latest notes text available inside speech callbacks.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function appendText(chunk: string) {
    const trimmed = chunk.trim();
    if (!trimmed) return;
    const current = valueRef.current.trim();
    onChange(current ? `${current} ${trimmed}` : trimmed);
  }

  function appendBlock(chunk: string) {
    const trimmed = chunk.trim();
    if (!trimmed) return;
    const current = valueRef.current.trim();
    onChange(current ? `${current}\n\n${trimmed}` : trimmed);
  }

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setHint(null);
      return;
    }

    const recognition = getSpeechRecognition();
    if (!recognition) {
      setVoiceSupported(false);
      setHint("Voice isn’t supported in this browser — try Chrome.");
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        }
      }
      if (finalChunk) appendText(finalChunk);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "not-allowed") {
        setHint("Microphone permission was blocked.");
      } else if (event.error !== "aborted") {
        setHint("Couldn’t hear that — try again.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      setHint("Listening… tap Stop when you’re done.");
    } catch {
      setHint("Couldn’t start the mic — try again.");
      setIsListening(false);
    }
  }

  async function handlePhoto(file: File | undefined) {
    if (!file || readingPhoto) return;
    setHint(null);
    setReadingPhoto(true);
    try {
      const { base64, mime } = await fileToBase64(file);
      const result = await notesFromImage({
        image_base64: base64,
        image_mime: mime,
        subject,
        unit,
      });
      appendBlock(result.content);
      setHint("Added notes from your photo — edit anything that looks off.");
    } catch (err) {
      setHint(
        err instanceof Error ? err.message : "Couldn’t read that photo."
      );
    } finally {
      setReadingPhoto(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setHint(null);

    if (file.type.startsWith("image/")) {
      await handlePhoto(file);
      return;
    }

    const name = file.name.toLowerCase();
    const isText =
      file.type.startsWith("text/") ||
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".markdown") ||
      name.endsWith(".csv");

    if (!isText) {
      setHint("Upload a photo, or a .txt / .md notes file.");
      return;
    }

    try {
      const text = await file.text();
      const cleaned = text.replace(/\u0000/g, "").trim();
      if (!cleaned) {
        setHint("That file looked empty.");
        return;
      }
      appendBlock(cleaned);
      setHint(`Added notes from ${file.name}`);
    } catch {
      setHint("Couldn’t read that file.");
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      await handlePhoto(file);
      return;
    }
  }

  function downloadNotes() {
    const text = value.trim();
    if (!text) {
      setHint("Write or upload some notes first.");
      return;
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alara-notes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setHint("Notes downloaded.");
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleVoice}
          disabled={!voiceSupported && !isListening}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            isListening
              ? "bg-rose-500 text-white"
              : "border border-border bg-white text-stone-600 hover:border-brand hover:text-brand"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isListening ? "animate-pulse bg-white" : "bg-brand"
            }`}
            aria-hidden
          />
          {isListening ? "Stop voice" : "Voice"}
        </button>

        <button
          type="button"
          disabled={readingPhoto}
          onClick={() => photoInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {readingPhoto ? "Reading photo…" : "Add photo"}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-brand hover:text-brand"
        >
          Upload notes
        </button>

        <button
          type="button"
          onClick={downloadNotes}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-brand hover:text-brand"
        >
          Download notes
        </button>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            void handlePhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,.csv,text/plain,text/markdown,image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          void handlePaste(e);
        }}
        placeholder={placeholder}
        rows={rows}
        disabled={readingPhoto}
        className="resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-brand focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)] disabled:opacity-70"
        required={required}
      />

      {hint && <p className="text-xs text-muted">{hint}</p>}
      {!voiceSupported && (
        <p className="text-xs text-muted">
          Voice works best in Chrome or Edge.
        </p>
      )}
      <p className="text-[11px] text-muted">
        Tip: paste a photo into the box, or tap Add photo. Ara turns it into
        text notes you can edit and quiz on.
      </p>
    </div>
  );
}
