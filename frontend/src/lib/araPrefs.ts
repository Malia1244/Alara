export type UiTheme = "original" | "sleek" | "playful";

/** Shop item ids that unlock paid UI themes. */
export const THEME_SHOP_IDS: Record<Exclude<UiTheme, "original">, string> = {
  sleek: "theme-sleek",
  playful: "theme-playful",
};

export function themeShopId(theme: UiTheme): string | null {
  if (theme === "original") return null;
  return THEME_SHOP_IDS[theme];
}

export function isThemeUnlocked(
  theme: UiTheme,
  ownedItemIds: string[] | Set<string>
): boolean {
  if (theme === "original") return true;
  const id = THEME_SHOP_IDS[theme];
  if (ownedItemIds instanceof Set) return ownedItemIds.has(id);
  return ownedItemIds.includes(id);
}

export type AraPrefs = {
  /** Idle bob + pose-change bounce */
  motion: boolean;
  /** “Work on ___ more” speech bubbles */
  tips: boolean;
  /** Remind to log what you learned today */
  studyReminders: boolean;
  /** Local hour (0–23) to nudge if nothing logged yet */
  reminderHour: number;
  /** App color / vibe theme */
  theme: UiTheme;
};

export const DEFAULT_ARA_PREFS: AraPrefs = {
  motion: true,
  tips: true,
  studyReminders: false,
  reminderHour: 17,
  theme: "original",
};

const STORAGE_KEY = "alara-ara-prefs";
export const ARA_PREFS_EVENT = "alara-ara-prefs";

function clampHour(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ARA_PREFS.reminderHour;
  return Math.min(23, Math.max(0, Math.round(n)));
}

function normalizeTheme(value: unknown): UiTheme {
  if (value === "sleek" || value === "playful" || value === "original") {
    return value;
  }
  return "original";
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
      theme: normalizeTheme(parsed.theme),
    };
  } catch {
    return DEFAULT_ARA_PREFS;
  }
}

export function writeAraPrefs(next: AraPrefs) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(ARA_PREFS_EVENT, { detail: next }));
}

export function applyUiTheme(theme: UiTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "original") {
    delete root.dataset.uiTheme;
  } else {
    root.dataset.uiTheme = theme;
  }
}
