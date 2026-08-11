export type AraPrefs = {
  /** Idle bob + pose-change bounce */
  motion: boolean;
  /** “Work on ___ more” speech bubbles */
  tips: boolean;
};

export const DEFAULT_ARA_PREFS: AraPrefs = {
  motion: true,
  tips: true,
};

const STORAGE_KEY = "alara-ara-prefs";
export const ARA_PREFS_EVENT = "alara-ara-prefs";

export function readAraPrefs(): AraPrefs {
  if (typeof window === "undefined") return DEFAULT_ARA_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ARA_PREFS;
    const parsed = JSON.parse(raw) as Partial<AraPrefs>;
    return {
      motion: parsed.motion !== false,
      tips: parsed.tips !== false,
    };
  } catch {
    return DEFAULT_ARA_PREFS;
  }
}

export function writeAraPrefs(next: AraPrefs) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(ARA_PREFS_EVENT, { detail: next }));
}
