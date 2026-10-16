import type { LoungeMessage } from "@/lib/api";

const STORAGE_KEY = "alara-lounge-last-seen";
export const LOUNGE_UNREAD_EVENT = "alara-lounge-unread";

export function readLoungeLastSeen(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markLoungeSeen(iso: string | null | undefined) {
  if (typeof window === "undefined" || !iso) return;
  try {
    const prev = readLoungeLastSeen();
    if (prev && prev >= iso) {
      notifyLoungeUnread(false);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, iso);
    notifyLoungeUnread(false);
  } catch {
    // ignore
  }
}

export function latestLoungeActivity(messages: LoungeMessage[]): string | null {
  let latest: string | null = null;
  for (const row of messages) {
    if (!row.created_at) continue;
    if (!latest || row.created_at > latest) latest = row.created_at;
  }
  return latest;
}

/** Unread = someone else's message newer than last time you opened Lounge. */
export function hasLoungeUnread(
  messages: LoungeMessage[],
  lastSeen: string | null = readLoungeLastSeen()
): boolean {
  return messages.some(
    (row) => !row.is_mine && (!lastSeen || row.created_at > lastSeen)
  );
}

export function notifyLoungeUnread(hasUnread: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LOUNGE_UNREAD_EVENT, { detail: { hasUnread } })
  );
}

export function subscribeLoungeUnread(
  listener: (hasUnread: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ hasUnread: boolean }>).detail;
    listener(Boolean(detail?.hasUnread));
  };
  window.addEventListener(LOUNGE_UNREAD_EVENT, handler);
  return () => window.removeEventListener(LOUNGE_UNREAD_EVENT, handler);
}
