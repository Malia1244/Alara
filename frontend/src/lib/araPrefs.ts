export type AraPrefs = {
  /** Idle bob + pose-change bounce */
  motion: boolean;
  /** “Work on ___ more” speech bubbles */
  tips: boolean;
  /** Remind to log what you learned today */
  studyReminders: boolean;
  /** Local hour (0–23) to nudge if nothing logged yet */
  reminderHour: number;
};

export const DEFAULT_ARA_PREFS: AraPrefs = {
  motion: true,
  tips: true,
  studyReminders: false,
  reminderHour: 17,
};

const STORAGE_KEY = "alara-ara-prefs";
export const ARA_PREFS_EVENT = "alara-ara-prefs";

function clampHour(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ARA_PREFS.reminderHour;
  return Math.min(23, Math.max(0, Math.round(n)));
}

export function readAraPrefs(): AraPrefs {
  if (typeof window === "undefined") return DEFAULT_ARA_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ARA_PREFS;
    const parsed = JSON.parse(raw) as Partial<AraPrefs>;
    return {
      motion: parsed.motion !== false,
      tips: parsed.tips !== false,
      studyReminders: parsed.studyReminders === true,
      reminderHour: clampHour(parsed.reminderHour),
    };
  } catch {
    return DEFAULT_ARA_PREFS;
  }
}

export function writeAraPrefs(next: AraPrefs) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(ARA_PREFS_EVENT, { detail: next }));
}
