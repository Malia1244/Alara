/** Browser speech helpers for Voice Study / notes dictation. */

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak text aloud (cancels any current utterance). */
export function speakText(text: string, opts?: { rate?: number; pitch?: number }) {
  if (!isSpeechSynthesisSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text.trim());
  utter.lang = "en-US";
  utter.rate = opts?.rate ?? 1.02;
  utter.pitch = opts?.pitch ?? 1.05;
  // Prefer a softer female-ish voice when available.
  const voices = synth.getVoices();
  const preferred =
    voices.find((v) => /google us english|samantha|zira|female/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
  if (preferred) utter.voice = preferred;
  synth.speak(utter);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
