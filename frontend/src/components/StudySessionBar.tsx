"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getSharedAmbientPlayer } from "@/lib/ambientAudio";
import { getVibe } from "@/lib/studyVibes";
import {
  STUDY_SESSION_EVENT,
  applyStudySceneTheme,
  formatClock,
  readStudySession,
  tickStudySession,
  writeStudySession,
  type StudySession,
} from "@/lib/studySession";

/**
 * Sticky top timer while an active study session continues off /timed-study.
 */
export default function StudySessionBar() {
  const pathname = usePathname();
  const onTimedStudy = pathname.includes("timed-study");
  const [session, setSession] = useState<StudySession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dingedEndsAtRef = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setSession(readStudySession());
    sync();
    window.addEventListener(STUDY_SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STUDY_SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!session || session.status !== "active" || onTimedStudy) return;

    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const current = readStudySession();
      if (!current || current.status !== "active") return;

      if (t >= current.endsAt) {
        if (dingedEndsAtRef.current !== current.endsAt) {
          dingedEndsAtRef.current = current.endsAt;
          void getSharedAmbientPlayer().playDing();
        }
        const next = tickStudySession(current, t);
        if (next !== current) {
          writeStudySession(next);
          setSession(next);
        }
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [session?.status, session?.endsAt, onTimedStudy, session]);

  if (onTimedStudy || !session) return null;

  const activeSession = session;
  const vibe = getVibe(activeSession.vibe);
  const done = activeSession.goals.filter((g) => g.done).length;
  const total = activeSession.goals.length;

  function clearSession() {
    writeStudySession(null);
    applyStudySceneTheme(null);
    getSharedAmbientPlayer().stop();
    setSession(null);
  }

  function toggleMute() {
    if (activeSession.status !== "active") return;
    const on = !activeSession.musicOn;
    const next = { ...activeSession, musicOn: on };
    writeStudySession(next);
    setSession(next);
    if (on) void getSharedAmbientPlayer().start(activeSession.vibe);
    else getSharedAmbientPlayer().stop();
  }

  if (activeSession.status === "ended") {
    return (
      <div className="study-session-bar sticky top-0 z-40 border-b border-border bg-surface/95 px-3 py-2.5 backdrop-blur-md md:pl-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 sm:gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-ink">
            Session ended · {done}/{total} goals
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/timed-study"
              className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/40"
            >
              Review goals
            </Link>
            <button
              type="button"
              onClick={clearSession}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-ink"
            >
              Finished
            </button>
          </div>
        </div>
      </div>
    );
  }

  const remainingSec = Math.max(0, Math.ceil((activeSession.endsAt - now) / 1000));
  const isBreak = activeSession.pomodoro?.segment === "break";
  const label =
    activeSession.timerMode === "pomodoro" && activeSession.pomodoro
      ? isBreak
        ? `Break · ${vibe.name}`
        : `Focus ${activeSession.pomodoro.currentRound}/${activeSession.pomodoro.rounds} · ${vibe.name}`
      : vibe.name;

  return (
    <div className="study-session-bar sticky top-0 z-40 border-b border-border bg-surface/95 px-3 py-2.5 backdrop-blur-md md:pl-4">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-display text-lg font-semibold tabular-nums text-ink sm:text-xl">
            {formatClock(remainingSec)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-brand">
              {label}
            </p>
            <p className="truncate text-xs text-muted">
              {activeSession.subjectName ? `${activeSession.subjectName} · ` : ""}
              {done}/{total} goals
              {activeSession.musicOn ? " · music on" : " · muted"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/40"
          >
            {activeSession.musicOn ? "Mute" : "Unmute"}
          </button>
          <Link
            href="/timed-study"
            className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/40"
          >
            Back to focus
          </Link>
        </div>
      </div>
    </div>
  );
}
