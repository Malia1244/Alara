"use client";

import { useEffect, useRef, useState } from "react";

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
};

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function NotesInput({
  id = "content",
  value,
  onChange,
  placeholder = "Paste or type your notes, in your own words...",
  rows = 6,
  required = false,
}: Props) {
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setHint(null);

    const name = file.name.toLowerCase();
    const isText =
      file.type.startsWith("text/") ||
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".markdown") ||
      name.endsWith(".csv");

    if (!isText) {
      setHint("Please upload a .txt or .md notes file.");
      return;
    }

    try {
      const text = await file.text();
      const cleaned = text.replace(/\u0000/g, "").trim();
      if (!cleaned) {
        setHint("That file looked empty.");
        return;
      }
      const current = valueRef.current.trim();
      onChange(current ? `${current}\n\n${cleaned}` : cleaned);
      setHint(`Added notes from ${file.name}`);
    } catch {
      setHint("Couldn’t read that file.");
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
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,.csv,text/plain,text/markdown"
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
        placeholder={placeholder}
        rows={rows}
        className="resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-brand focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
        required={required}
      />

      {hint && <p className="text-xs text-muted">{hint}</p>}
      {!voiceSupported && (
        <p className="text-xs text-muted">
          Voice works best in Chrome or Edge.
        </p>
      )}
    </div>
  );
}
