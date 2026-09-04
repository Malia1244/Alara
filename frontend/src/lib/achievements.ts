import { readFocusMinutesTotal } from "@/lib/focusStats";

export type AchievementKind = "streak" | "focus" | "quizzes";

export type Achievement = {
  id: string;
  kind: AchievementKind;
  title: string;
  subtitle: string;
  badge: string;
};

const STREAK_TIERS = [1, 3, 7, 14, 30, 60, 100];
const FOCUS_TIERS = [15, 30, 60, 120, 300, 600];
const QUIZ_TIERS = [1, 5, 10, 25, 50];

function bestTier(value: number, tiers: number[]): number | null {
  let best: number | null = null;
  for (const t of tiers) {
    if (value >= t) best = t;
  }
  return best;
}

/**
 * Pick one celebratory achievement for the welcome splash from current stats.
 */
export function pickOpenAchievement(input: {
  dayStreak: number;
  quizzesCompleted: number;
  focusMinutes?: number;
}): Achievement | null {
  const streak = Math.max(0, input.dayStreak || 0);
  const quizzes = Math.max(0, input.quizzesCompleted || 0);
  const focus = Math.max(
    0,
    input.focusMinutes ?? readFocusMinutesTotal()
  );

  const streakTier = bestTier(streak, STREAK_TIERS);
  const focusTier = bestTier(focus, FOCUS_TIERS);
  const quizTier = bestTier(quizzes, QUIZ_TIERS);

  const candidates: Achievement[] = [];

  if (streakTier != null) {
    candidates.push({
      id: `streak-${streakTier}`,
      kind: "streak",
      title:
        streakTier === 1
          ? "First spark!"
          : `${streakTier}-day streak unlocked!`,
      subtitle:
        streakTier === 1
          ? "You showed up to study today — Ara’s hyped."
          : `You’re on a ${streak}-day learning streak. Keep the glow going.`,
      badge: `${streak} day${streak === 1 ? "" : "s"}`,
    });
  }

  if (focusTier != null) {
    const hours = focus >= 60 ? `${Math.floor(focus / 60)}h` : `${focus}m`;
    candidates.push({
      id: `focus-${focusTier}`,
      kind: "focus",
      title:
        focusTier < 60
          ? `${focusTier} minutes of focus!`
          : `${Math.floor(focusTier / 60)} hour focus badge!`,
      subtitle: `You’ve banked about ${hours} of Timed Study focus time.`,
      badge: hours,
    });
  }

  if (quizTier != null) {
    candidates.push({
      id: `quizzes-${quizTier}`,
      kind: "quizzes",
      title:
        quizTier === 1
          ? "Quiz starter!"
          : `${quizTier} quizzes crushed!`,
      subtitle: `You’ve finished ${quizzes} quiz${quizzes === 1 ? "" : "zes"} — brains + style.`,
      badge: `${quizzes} quiz${quizzes === 1 ? "" : "zes"}`,
    });
  }

  if (candidates.length === 0) {
    return {
      id: "welcome",
      kind: "streak",
      title: "Welcome back!",
      subtitle: "Log what you learn and Ara will dance for your next unlock.",
      badge: "Let’s go",
    };
  }

  // Prefer streak, then focus, then quizzes — feels most “open the app” celebratory.
  const order: AchievementKind[] = ["streak", "focus", "quizzes"];
  candidates.sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)
  );
  return candidates[0];
}
