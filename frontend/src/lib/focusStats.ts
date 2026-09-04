/** Local cumulative focus minutes from Timed Study sessions. */

const STORAGE_KEY = "alara-focus-minutes-total";

export function readFocusMinutesTotal(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(window.localStorage.getItem(STORAGE_KEY) || "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function addFocusMinutes(minutes: number) {
  if (typeof window === "undefined") return;
  const add = Math.max(0, Math.round(minutes));
  if (add <= 0) return;
  const next = readFocusMinutesTotal() + add;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // ignore
  }
}
