"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import StudyAmbienceStage from "@/components/StudyAmbienceStage";
import { IconTimer } from "@/components/nav-icons";
import { getSharedAmbientPlayer } from "@/lib/ambientAudio";
import { fetchSubjects, type Subject } from "@/lib/api";
import {
  applyStudySceneTheme,
  araStudyNudge,
  formatClock,
  goalTemplatesForSubject,
  readStudySession,
  tickStudySession,
  writeStudySession,
  type StudyGoal,
  type StudySession,
  type TimerMode,
} from "@/lib/studySession";
import {
  getVibe,
  STUDY_VIBES,
  type StudyVibeId,
} from "@/lib/studyVibes";

const DURATION_PRESETS = [15, 25, 45, 60] as const;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function TimedStudyPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [phase, setPhase] = useState<"setup" | "active" | "ended">("setup");
  const [durationMin, setDurationMin] = useState(25);
  const [customMin, setCustomMin] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [session, setSession] = useState<StudySession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const [vibeId, setVibeId] = useState<StudyVibeId>("cafe");
  const [timerMode, setTimerMode] = useState<TimerMode>("classic");
  const [pomodoroRounds, setPomodoroRounds] = useState(4);
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [musicOn, setMusicOn] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [goalsOpen, setGoalsOpen] = useState(true);

  const dingedEndsAtRef = useRef<number | null>(null);

  useEffect(() => {
    setMusicVolume(getSharedAmbientPlayer().getVolume());
  }, []);

  useEffect(() => {
    fetchSubjects()
      .then(setSubjects)
      .catch(() => setError("Couldn't load subjects."));
  }, []);

  useEffect(() => {
    const saved = readStudySession();
    if (!saved) return;
    setGoals(saved.goals);
    setVibeId(saved.vibe);
    setTimerMode(saved.timerMode);
    setMusicOn(saved.musicOn);

    if (saved.status === "ended") {
      setSession(saved);
      setPhase("ended");
      return;
    }

    const current = tickStudySession(saved, Date.now());
    if (current.status === "ended") {
      writeStudySession(current);
      setSession(current);
      setGoals(current.goals);
      setPhase("ended");
      return;
    }

    writeStudySession(current);
    setSession(current);
    setGoals(current.goals);
    setPhase("active");
  }, []);

  // Music is owned by StudyMusicBridge (app-wide). Only sync volume here.
  useEffect(() => {
    getSharedAmbientPlayer().setVolume(musicVolume);
  }, [musicVolume]);

  useEffect(() => {
    if (phase !== "active" || !session) return;
    const tick = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const latest = readStudySession();
      if (!latest || latest.status !== "active") return;
      if (t < latest.endsAt) return;

      if (dingedEndsAtRef.current !== latest.endsAt) {
        dingedEndsAtRef.current = latest.endsAt;
        void getSharedAmbientPlayer().playDing();
      }

      const next = tickStudySession(
        { ...latest, goals: latest.goals.map((g) => {
          const local = goals.find((x) => x.id === g.id);
          return local ? { ...g, done: local.done } : g;
        }) },
        t
      );
      writeStudySession(next);
      setSession(next);
      setGoals(next.goals);
      if (next.status === "ended") setPhase("ended");
    }, 250);
    return () => window.clearInterval(tick);
  }, [phase, session, goals]);

  const selectedSubject = subjects.find((s) => s.id === subjectId) ?? null;
  const templates = useMemo(
    () => goalTemplatesForSubject(subjectId || null),
    [subjectId]
  );
  const vibe = getVibe(session?.vibe ?? vibeId);

  const remainingSec = session
    ? Math.max(0, Math.ceil((session.endsAt - now) / 1000))
    : 0;
  const segmentDurationSec =
    session?.timerMode === "pomodoro" && session.pomodoro
      ? (session.pomodoro.segment === "work"
          ? session.pomodoro.workMin
          : session.pomodoro.breakMin) * 60
      : session
        ? session.durationMin * 60
        : durationMin * 60;
  const progress =
    segmentDurationSec > 0 ? 1 - remainingSec / segmentDurationSec : 0;
  const nudge = session
    ? araStudyNudge(remainingSec, segmentDurationSec, goals, {
        timerMode: session.timerMode,
        pomodoro: session.pomodoro,
      })
    : "";

  function toggleTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setGoals((prev) => {
      const exists = prev.find((g) => g.id === templateId);
      if (exists) return prev.filter((g) => g.id !== templateId);
      return [
        ...prev,
        {
          id: templateId,
          label: template.label,
          href: template.href,
          done: false,
        },
      ];
    });
  }

  function addCustomGoal() {
    const label = customGoal.trim();
    if (!label) return;
    setGoals((prev) => [...prev, { id: newId(), label, done: false }]);
    setCustomGoal("");
  }

  function startSession() {
    if (goals.length === 0) {
      setError("Add at least one goal to complete.");
      return;
    }

    const startedAt = Date.now();
    let next: StudySession;

    if (timerMode === "pomodoro") {
      const w = Math.min(60, Math.max(1, workMin));
      const b = Math.min(30, Math.max(1, breakMin));
      const r = Math.min(12, Math.max(1, pomodoroRounds));
      next = {
        durationMin: w,
        startedAt,
        endsAt: startedAt + w * 60 * 1000,
        subjectId: selectedSubject?.id ?? null,
        subjectName: selectedSubject?.name ?? null,
        goals,
        status: "active",
        vibe: vibeId,
        timerMode: "pomodoro",
        musicOn,
        pomodoro: {
          workMin: w,
          breakMin: b,
          rounds: r,
          currentRound: 1,
          segment: "work",
        },
      };
    } else {
      const mins = customMin.trim()
        ? Math.min(180, Math.max(1, Number(customMin)))
        : durationMin;
      if (!Number.isFinite(mins) || mins < 1) {
        setError("Pick a valid study time.");
        return;
      }
      next = {
        durationMin: mins,
        startedAt,
        endsAt: startedAt + mins * 60 * 1000,
        subjectId: selectedSubject?.id ?? null,
        subjectName: selectedSubject?.name ?? null,
        goals,
        status: "active",
        vibe: vibeId,
        timerMode: "classic",
        musicOn,
        pomodoro: null,
      };
    }

    setError(null);
    writeStudySession(next);
    setSession(next);
    setNow(startedAt);
    setPhase("active");
    // Start from this click so autoplay is allowed; StudyMusicBridge keeps it going.
    if (next.musicOn) {
      void getSharedAmbientPlayer().start(next.vibe);
    } else {
      getSharedAmbientPlayer().stop();
    }
  }

  function persistSession(updated: StudySession) {
    setSession(updated);
    writeStudySession(updated);
  }

  function persistGoals(nextGoals: StudyGoal[]) {
    setGoals(nextGoals);
    if (!session) return;
    persistSession({ ...session, goals: nextGoals });
  }

  function toggleDone(id: string) {
    persistGoals(
      goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g))
    );
  }

  function toggleMusic() {
    const on = !musicOn;
    setMusicOn(on);
    if (session) {
      persistSession({ ...session, musicOn: on });
    }
    // Immediate feedback; bridge also reacts to the session event.
    if (on && session?.status === "active") {
      void getSharedAmbientPlayer().start(session.vibe);
    } else if (!on) {
      getSharedAmbientPlayer().stop();
    }
  }

  function endEarly() {
    if (!session) return;
    const ended: StudySession = {
      ...session,
      goals,
      status: "ended",
      endsAt: Date.now(),
    };
    writeStudySession(ended);
    setSession(ended);
    setPhase("ended");
    getSharedAmbientPlayer().stop();
  }

  function resetToSetup() {
    writeStudySession(null);
    applyStudySceneTheme(null);
    getSharedAmbientPlayer().stop();
    setSession(null);
    setGoals([]);
    setCustomGoal("");
    setCustomMin("");
    setDurationMin(25);
    setGoalsOpen(true);
    setPhase("setup");
  }

  /** Leave the wrap-up and restore Alara’s normal colors. */
  function finishSession() {
    resetToSetup();
  }

  const doneCount = goals.filter((g) => g.done).length;
  const isBreak =
    session?.timerMode === "pomodoro" &&
    session.pomodoro?.segment === "break";
  const immersive =
    Boolean(vibe.immersive && vibe.sceneImage) &&
    (phase === "active" || phase === "ended");
  const panelClass = immersive
    ? "study-glass rounded-2xl p-6"
    : "rounded-2xl border border-border bg-surface p-6";

  return (
    <div
      className={`flex flex-1 justify-center px-4 sm:px-8 ${
        immersive ? "py-4 sm:py-6" : "py-10 sm:py-14"
      }`}
    >
      <main
        className={`flex w-full flex-col gap-6 ${
          immersive ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        {!immersive && (
          <header className="animate-rise flex items-start gap-3">
            <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <IconTimer className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                Focus
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Timed study
              </h1>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
                Step into a study scene — café, beach, rain, library, and more —
                with matching music and a ding when time’s up.
              </p>
            </div>
          </header>
        )}

        {error && (
          <p className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
            {error}
          </p>
        )}

        {phase === "setup" && (
          <section className="animate-rise flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6">
            {/* Vibe */}
            <div>
              <h2 className="text-sm font-semibold text-ink">Study scene</h2>
              <p className="mt-1 text-xs text-muted">
                Choose where you want to study — immersive scenes play real
                music when you start.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {STUDY_VIBES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVibeId(v.id)}
                    className={`overflow-hidden rounded-xl border text-left transition-colors ${
                      vibeId === v.id
                        ? "border-brand ring-2 ring-brand/30"
                        : "border-border hover:border-brand/40"
                    }`}
                  >
                    {v.sceneImage ? (
                      <div
                        className="h-20 bg-cover bg-center"
                        style={{ backgroundImage: `url(${v.sceneImage})` }}
                      />
                    ) : null}
                    <div
                      className={`px-3.5 py-3 ${
                        vibeId === v.id ? "bg-brand-soft" : "bg-panel"
                      }`}
                    >
                      <p className="text-sm font-semibold text-ink">{v.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{v.blurb}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-brand">
                        {v.musicLabel}
                        {v.immersive ? " · immersive" : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-panel px-3.5 py-3">
                <span className="text-sm font-medium text-ink">
                  Music ({getVibe(vibeId).musicLabel})
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={musicOn}
                  onClick={() => setMusicOn((m) => !m)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    musicOn ? "bg-brand" : "bg-stone-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      musicOn ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
              {getVibe(vibeId).musicCredit && (
                <p className="mt-2 text-[10px] leading-snug text-muted">
                  {getVibe(vibeId).musicCredit}
                </p>
              )}
            </div>

            {/* Timer mode */}
            <div>
              <h2 className="text-sm font-semibold text-ink">Timer mode</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTimerMode("classic")}
                  className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${
                    timerMode === "classic"
                      ? "bg-brand text-white"
                      : "border border-border bg-panel text-ink"
                  }`}
                >
                  Classic
                </button>
                <button
                  type="button"
                  onClick={() => setTimerMode("pomodoro")}
                  className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${
                    timerMode === "pomodoro"
                      ? "bg-brand text-white"
                      : "border border-border bg-panel text-ink"
                  }`}
                >
                  Pomodoro
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                {timerMode === "pomodoro"
                  ? "Focus blocks with short breaks — classic 25 / 5, or tweak it."
                  : "One continuous countdown for your whole study block."}
              </p>
            </div>

            {timerMode === "classic" ? (
              <div>
                <h2 className="text-sm font-semibold text-ink">How long?</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setDurationMin(m);
                        setCustomMin("");
                      }}
                      className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                        !customMin && durationMin === m
                          ? "bg-brand text-white"
                          : "border border-border bg-panel text-ink hover:border-brand/40"
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex flex-col gap-1.5 text-xs font-semibold text-muted">
                  Custom minutes
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customMin}
                    onChange={(e) => setCustomMin(e.target.value)}
                    placeholder="e.g. 40"
                    className="w-full max-w-[10rem] rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-brand"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
                  Focus (min)
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={workMin}
                    onChange={(e) => setWorkMin(Number(e.target.value) || 25)}
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-brand"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
                  Break (min)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={breakMin}
                    onChange={(e) => setBreakMin(Number(e.target.value) || 5)}
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-brand"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
                  Rounds
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={pomodoroRounds}
                    onChange={(e) =>
                      setPomodoroRounds(Number(e.target.value) || 4)
                    }
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-brand"
                  />
                </label>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold text-ink">
                Subject{" "}
                <span className="font-normal text-muted">(optional)</span>
              </h2>
              <select
                value={subjectId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSubjectId(nextId);
                  const known = new Set([
                    "notes",
                    "quiz",
                    "practice",
                    "teach",
                    "homework",
                    "review",
                  ]);
                  const nextTemplates = goalTemplatesForSubject(nextId || null);
                  setGoals((prev) => {
                    const custom = prev.filter((g) => !known.has(g.id));
                    const selectedIds = new Set(
                      prev.filter((g) => known.has(g.id)).map((g) => g.id)
                    );
                    const remapped = nextTemplates
                      .filter((t) => selectedIds.has(t.id))
                      .map((t) => ({
                        id: t.id,
                        label: t.label,
                        href: t.href,
                        done: prev.find((g) => g.id === t.id)?.done ?? false,
                      }));
                    return [...remapped, ...custom];
                  });
                }}
                className="mt-2 w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">Any / general</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.unit ? ` · ${s.unit}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink">
                What do you need to complete?
              </h2>
              <p className="mt-1 text-xs text-muted">
                Pick suggested goals or add your own. Check them off as you go.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {templates.map((t) => {
                  const selected = goals.some((g) => g.id === t.id);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => toggleTemplate(t.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                          selected
                            ? "border-brand bg-brand-soft text-brand-ink"
                            : "border-border bg-panel text-ink hover:border-brand/35"
                        }`}
                      >
                        {t.label}
                        <span className="text-xs font-semibold text-muted">
                          {selected ? "Added" : "Add"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex gap-2">
                <input
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomGoal();
                    }
                  }}
                  placeholder="Custom goal…"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={addCustomGoal}
                  className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand"
                >
                  Add
                </button>
              </div>

              {goals.length > 0 && (
                <p className="mt-3 text-xs font-semibold text-brand">
                  {goals.length} goal{goals.length === 1 ? "" : "s"} ready
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={startSession}
              className="rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
            >
              Start {timerMode === "pomodoro" ? "Pomodoro" : "timed"} session
            </button>
          </section>
        )}

        {phase === "active" && session && immersive && vibe.sceneImage && (
          <StudyAmbienceStage
            vibeId={session.vibe}
            sceneImage={vibe.sceneImage}
          >
            <div className="ml-auto flex w-full max-w-md flex-col gap-3 sm:mr-0">
              <div className="study-glass rounded-2xl px-4 py-4 sm:px-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
                  {vibe.name}
                  {session.timerMode === "pomodoro" && session.pomodoro
                    ? isBreak
                      ? ` · Break · after round ${session.pomodoro.currentRound}`
                      : ` · Focus ${session.pomodoro.currentRound}/${session.pomodoro.rounds}`
                    : " · Live session"}
                </p>
                <p className="mt-1 font-display text-5xl font-semibold tracking-tight text-ink tabular-nums">
                  {formatClock(remainingSec)}
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-brand-soft">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-300"
                    style={{ width: `${Math.min(100, progress * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-muted">
                  {session.subjectName ? `${session.subjectName} · ` : ""}
                  {doneCount}/{goals.length} goals
                  {musicOn ? " · music on" : ""}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMusic}
                    className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/40"
                  >
                    {musicOn ? "Mute" : "Music"}
                  </button>
                  {musicOn && (
                    <label className="flex items-center gap-2 text-xs text-muted">
                      Vol
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={musicVolume}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMusicVolume(v);
                          getSharedAmbientPlayer().setVolume(v);
                        }}
                        className="w-24"
                      />
                    </label>
                  )}
                  {!isBreak && (
                    <button
                      type="button"
                      onClick={() => setGoalsOpen((o) => !o)}
                      className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/40"
                    >
                      {goalsOpen ? "Hide goals" : "Goals"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={endEarly}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
                  >
                    End
                  </button>
                </div>

                <div className="ara-callout mt-3 px-3 py-2.5 text-sm text-ink">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                    Ara · {isBreak ? "break" : "focus"}
                  </p>
                  <p className="mt-0.5 font-medium leading-snug">{nudge}</p>
                </div>
              </div>

              {goalsOpen && !isBreak && (
                <div className="study-glass rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-ink">
                      Session goals
                    </h2>
                    <button
                      type="button"
                      onClick={() => setGoalsOpen(false)}
                      className="text-xs font-semibold text-muted hover:text-ink"
                    >
                      Close
                    </button>
                  </div>
                  <ul className="mt-2 flex flex-col gap-2">
                    {goals.map((goal) => (
                      <li
                        key={goal.id}
                        className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                          goal.done
                            ? "border-brand/30 bg-brand-soft/60"
                            : "border-border bg-surface/70"
                        }`}
                      >
                        <label className="flex min-w-0 cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={goal.done}
                            onChange={() => toggleDone(goal.id)}
                            className="mt-1 h-4 w-4 accent-[var(--brand)]"
                          />
                          <span
                            className={`text-sm font-medium ${
                              goal.done
                                ? "text-brand-ink line-through opacity-80"
                                : "text-ink"
                            }`}
                          >
                            {goal.label}
                          </span>
                        </label>
                        {goal.href && !goal.done && (
                          <Link
                            href={goal.href}
                            className="shrink-0 self-start rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-ink sm:self-center"
                          >
                            Go do it
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {vibe.musicCredit && (
                <p className="text-[10px] text-muted">{vibe.musicCredit}</p>
              )}
            </div>
          </StudyAmbienceStage>
        )}

        {phase === "active" && session && !immersive && (
          <div className="study-vibe-shell flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-col items-center gap-4">
              <CharacterStage
                size={96}
                pose={isBreak ? "wink" : remainingSec <= 60 ? "encourage" : "think"}
                pad="md"
              />
              <p className="font-display text-5xl font-semibold tracking-tight text-ink tabular-nums">
                {formatClock(remainingSec)}
              </p>
              <p className="text-xs font-semibold text-muted">{nudge}</p>
              <button
                type="button"
                onClick={endEarly}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:bg-panel hover:text-ink"
              >
                End session now
              </button>
            </div>
          </div>
        )}

        {phase === "ended" && session && (
          <section className={`flex flex-col gap-5 ${panelClass}`}>
            {immersive && vibe.sceneImage && (
              <div
                className="h-36 rounded-xl bg-cover bg-center sm:h-44"
                style={{ backgroundImage: `url(${vibe.sceneImage})` }}
                aria-hidden
              />
            )}
            <div className="flex flex-col items-center gap-3 text-center">
              <CharacterStage
                size={100}
                pose={doneCount === goals.length ? "cheer" : "encourage"}
                pad="md"
              />
              <h2 className="font-display text-2xl font-semibold text-ink">
                {doneCount === goals.length
                  ? "Session complete"
                  : "Session ended"}
              </h2>
              <p className="max-w-md text-sm text-muted">
                {session.timerMode === "pomodoro" && session.pomodoro
                  ? `Pomodoro · ${session.pomodoro.rounds} rounds · ${vibe.name}`
                  : `${session.durationMin}-minute ${vibe.name} session`}
                {session.subjectName ? ` · ${session.subjectName}` : ""}. You
                finished {doneCount} of {goals.length} goals.
              </p>
            </div>

            <div className="ara-callout w-full px-4 py-3 text-sm text-ink">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                Ara · wrap-up
              </p>
              <p className="mt-1 font-medium leading-snug">
                {araStudyNudge(0, segmentDurationSec, goals, {
                  timerMode: session.timerMode,
                  pomodoro: session.pomodoro,
                })}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">
                Check off anything you finished
              </p>
              <p className="mt-1 text-xs text-muted">
                Still count a goal if you wrapped it up right as the timer ended.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {goals.map((goal) => (
                  <li
                    key={goal.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${
                      goal.done
                        ? "border-brand/30 bg-brand-soft/60"
                        : "border-border bg-panel"
                    }`}
                  >
                    <label className="flex min-w-0 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={goal.done}
                        onChange={() => toggleDone(goal.id)}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      <span
                        className={
                          goal.done
                            ? "text-brand-ink line-through opacity-80"
                            : "text-ink"
                        }
                      >
                        {goal.label}
                      </span>
                    </label>
                    <span
                      className={`shrink-0 text-xs font-bold uppercase tracking-wide ${
                        goal.done ? "text-brand" : "text-muted"
                      }`}
                    >
                      {goal.done ? "Done" : "Not yet"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-semibold text-brand">
                {doneCount}/{goals.length} marked complete
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={finishSession}
                className="rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-ink sm:flex-1"
              >
                Finished
              </button>
              <button
                type="button"
                onClick={resetToSetup}
                className="rounded-lg border border-border px-5 py-3 text-sm font-semibold text-ink hover:bg-panel sm:flex-1"
              >
                Plan another session
              </button>
            </div>
            <p className="text-center text-xs text-muted">
              Finished returns Alara to its usual look.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
