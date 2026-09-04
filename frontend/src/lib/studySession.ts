import { isImmersiveVibe, type StudyVibeId } from "@/lib/studyVibes";
import { addFocusMinutes } from "@/lib/focusStats";

export type StudyGoal = {
  id: string;
  label: string;
  /** Optional deep link into Alara */
  href?: string;
  done: boolean;
};

export type TimerMode = "classic" | "pomodoro";

export type PomodoroState = {
  workMin: number;
  breakMin: number;
  rounds: number;
  currentRound: number;
  segment: "work" | "break";
};

export type StudySession = {
  durationMin: number;
  startedAt: number;
  /** End of the current segment (classic session or pomodoro work/break) */
  endsAt: number;
  subjectId: string | null;
  subjectName: string | null;
  goals: StudyGoal[];
  status: "active" | "ended";
  vibe: StudyVibeId;
  timerMode: TimerMode;
  musicOn: boolean;
  pomodoro: PomodoroState | null;
};

export const STUDY_SESSION_KEY = "alara-study-session";
export const STUDY_SESSION_EVENT = "alara-study-session-change";

export function readStudySession(): StudySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STUDY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudySession;
    // Backfill older saved sessions.
    return {
      ...parsed,
      vibe: parsed.vibe ?? "focus",
      timerMode: parsed.timerMode ?? "classic",
      musicOn: parsed.musicOn ?? false,
      pomodoro: parsed.pomodoro ?? null,
    };
  } catch {
    return null;
  }
}

function emitStudySessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STUDY_SESSION_EVENT));
}

export function writeStudySession(session: StudySession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(STUDY_SESSION_KEY);
    emitStudySessionChange();
    return;
  }
  if (session.status === "ended") {
    creditFocusMinutesOnce(session);
  }
  window.localStorage.setItem(STUDY_SESSION_KEY, JSON.stringify(session));
  emitStudySessionChange();
}

const FOCUS_CREDIT_KEY = "alara-focus-credited-session";

function creditFocusMinutesOnce(session: StudySession) {
  try {
    const id = String(session.startedAt);
    if (window.localStorage.getItem(FOCUS_CREDIT_KEY) === id) return;
    const end = Math.min(Date.now(), session.endsAt || Date.now());
    const elapsedMs = Math.max(0, end - session.startedAt);
    const minutes = Math.max(1, Math.round(elapsedMs / 60000));
    addFocusMinutes(minutes);
    window.localStorage.setItem(FOCUS_CREDIT_KEY, id);
  } catch {
    // ignore
  }
}

/**
 * Full-app palette while a themed session is in progress.
 * Ended wrap-up keeps the palette only on Timed Study; elsewhere (or after clear) returns to normal.
 */
export function activeStudySceneTheme(
  session: StudySession | null = readStudySession(),
  pathname?: string | null
): StudyVibeId | null {
  if (!session || !isImmersiveVibe(session.vibe)) return null;
  if (session.status === "active") return session.vibe;
  if (
    session.status === "ended" &&
    pathname != null &&
    pathname.includes("timed-study")
  ) {
    return session.vibe;
  }
  return null;
}

export function applyStudySceneTheme(scene: StudyVibeId | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (scene) {
    root.dataset.studyScene = scene;
  } else {
    delete root.dataset.studyScene;
  }
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Advance the clock: end classic sessions or flip pomodoro segments when
 * endsAt has passed. Safe to call every tick from any page.
 */
export function tickStudySession(
  session: StudySession,
  now = Date.now()
): StudySession {
  if (session.status !== "active") return session;

  let current = session;
  let guard = 0;
  while (
    current.status === "active" &&
    current.endsAt <= now &&
    guard < 24
  ) {
    guard += 1;
    if (current.timerMode === "pomodoro" && current.pomodoro) {
      current = advancePomodoroSegment(current, current.goals, now);
    } else {
      current = { ...current, status: "ended", endsAt: now, goals: current.goals };
    }
  }
  return current;
}

/** Advance pomodoro when a segment hits zero. Returns updated session. */
export function advancePomodoroSegment(
  session: StudySession,
  goals: StudyGoal[],
  now = Date.now()
): StudySession {
  const p = session.pomodoro;
  if (!p || session.timerMode !== "pomodoro") {
    return { ...session, goals, status: "ended" };
  }

  if (p.segment === "work") {
    if (p.currentRound >= p.rounds) {
      return { ...session, goals, status: "ended", endsAt: now };
    }
    return {
      ...session,
      goals,
      endsAt: now + p.breakMin * 60 * 1000,
      pomodoro: { ...p, segment: "break" },
    };
  }

  // Break finished → next work round
  const nextRound = p.currentRound + 1;
  return {
    ...session,
    goals,
    endsAt: now + p.workMin * 60 * 1000,
    durationMin: p.workMin,
    pomodoro: {
      ...p,
      currentRound: nextRound,
      segment: "work",
    },
  };
}

/** Ara keeps the session on track based on time left vs unfinished goals. */
export function araStudyNudge(
  remainingSec: number,
  durationSec: number,
  goals: StudyGoal[],
  opts?: {
    timerMode?: TimerMode;
    pomodoro?: PomodoroState | null;
  }
): string {
  const incomplete = goals.filter((g) => !g.done);
  const done = goals.length - incomplete.length;
  const fractionLeft = durationSec > 0 ? remainingSec / durationSec : 0;
  const pomo = opts?.pomodoro;

  if (pomo?.segment === "break") {
    return remainingSec > 0
      ? `Break time — stretch, sip water, then round ${pomo.currentRound + 1} of ${pomo.rounds}.`
      : "Break’s over — ready for the next focus block?";
  }

  if (goals.length === 0) {
    return "Add a couple of goals so I can keep you on track.";
  }

  if (incomplete.length === 0) {
    return remainingSec > 0
      ? "You hit every goal — nice work. Use leftover time to review, or end the session."
      : "Session complete. You finished everything on the list.";
  }

  if (remainingSec <= 0) {
    return `Time's up. You finished ${done}/${goals.length}. Next time, start with “${incomplete[0].label}” earlier.`;
  }

  const next = incomplete[0].label;
  const roundTag =
    opts?.timerMode === "pomodoro" && pomo
      ? ` (Pomodoro ${pomo.currentRound}/${pomo.rounds})`
      : "";

  if (remainingSec <= 60) {
    return `Under a minute${roundTag} — mark what’s done, or sprint “${next}” now.`;
  }

  if (remainingSec <= 5 * 60) {
    return `${formatClock(remainingSec)} left${roundTag}. Focus on “${next}” before the timer hits zero.`;
  }

  if (fractionLeft <= 0.5 && done === 0) {
    return `Halfway already and nothing checked off yet — open “${next}” and get moving.`;
  }

  if (fractionLeft <= 0.35 && incomplete.length >= 2) {
    return `${incomplete.length} goals left with ${formatClock(remainingSec)} on the clock. Tackle “${next}” next.`;
  }

  if (done === 0) {
    return `Timer’s running${roundTag}. Start with “${next}” — I’ll watch the clock.`;
  }

  return `${done}/${goals.length} done${roundTag}. Next up: “${next}”. You’ve got ${formatClock(remainingSec)}.`;
}

export type GoalTemplate = {
  id: string;
  label: string;
  href?: string;
};

export function goalTemplatesForSubject(
  subjectId: string | null
): GoalTemplate[] {
  const subjectPath = subjectId ? `/subjects/${subjectId}` : "/";
  const practicePath = subjectId
    ? `/subjects/${subjectId}/practice`
    : "/";
  const teachPath = subjectId
    ? `/teach-ara?subject_id=${subjectId}`
    : "/teach-ara";

  return [
    { id: "notes", label: "Log today's notes", href: subjectPath },
    { id: "quiz", label: "Complete a quiz", href: subjectPath },
    { id: "practice", label: "Do practice / flashcards", href: practicePath },
    { id: "teach", label: "Teach Ara a topic", href: teachPath },
    { id: "homework", label: "Get homework help", href: "/homework" },
    { id: "review", label: "Review a weak topic", href: "/progress" },
  ];
}
