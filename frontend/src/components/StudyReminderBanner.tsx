"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAraPrefs } from "@/components/AraPrefsProvider";
import {
  fetchLearningEntries,
  fetchSubjects,
  type Subject,
} from "@/lib/api";

const DISMISS_KEY = "alara-study-reminder-dismissed";
const NOTIFY_KEY = "alara-study-reminder-notified";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function readDayFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === todayKey();
  } catch {
    return false;
  }
}

function writeDayFlag(key: string) {
  try {
    window.localStorage.setItem(key, todayKey());
  } catch {
    // ignore
  }
}

/**
 * When study reminders are on, nudge the student to log what they learned
 * (in-app banner + optional browser notification around reminder hour).
 */
export default function StudyReminderBanner() {
  const pathname = usePathname();
  const { prefs } = useAraPrefs();
  const [pending, setPending] = useState<Subject[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!prefs.studyReminders) {
      setVisible(false);
      setPending([]);
      return;
    }
    if (pathname === "/login" || pathname === "/signup") return;

    let cancelled = false;

    async function check() {
      try {
        const [subjects, entries] = await Promise.all([
          fetchSubjects(),
          fetchLearningEntries(),
        ]);
        if (cancelled) return;

        const loggedIds = new Set(
          entries
            .filter((e) => isToday(e.created_at) && e.subject_id)
            .map((e) => e.subject_id as string)
        );
        const missing = subjects.filter((s) => !loggedIds.has(s.id));
        setPending(missing);

        if (missing.length === 0) {
          setVisible(false);
          return;
        }

        const hour = new Date().getHours();
        const atOrPastReminder = hour >= prefs.reminderHour;
        const dismissed = readDayFlag(DISMISS_KEY);
        setVisible(atOrPastReminder && !dismissed);

        // Browser notification once per day when permitted and due.
        if (
          atOrPastReminder &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          !readDayFlag(NOTIFY_KEY) &&
          document.visibilityState !== "hidden"
        ) {
          const first = missing[0];
          try {
            new Notification("Alara study reminder", {
              body: `Log what you learned in ${first.name} — earn shop points!`,
              tag: `alara-study-${todayKey()}`,
            });
            writeDayFlag(NOTIFY_KEY);
          } catch {
            // Some browsers block Notification constructor without SW.
          }
        }
      } catch {
        // Don't block the app if the reminder check fails.
      }
    }

    void check();
    const id = window.setInterval(() => {
      void check();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [prefs.studyReminders, prefs.reminderHour, pathname]);

  if (!visible || pending.length === 0) return null;

  const first = pending[0];
  const extra =
    pending.length > 1 ? ` (+${pending.length - 1} more)` : "";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4 md:top-5">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border border-brand/30 bg-white px-4 py-3 shadow-[0_16px_40px_-20px_rgba(28,25,23,0.45)]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-ink">
            Time to log what you learned
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Save today&apos;s notes for {first.name}
            {extra} and earn shop points.
          </p>
          <Link
            href={`/subjects/${first.id}`}
            className="mt-2 inline-block text-xs font-bold text-brand hover:text-brand-ink"
          >
            Open {first.name} →
          </Link>
        </div>
        <button
          type="button"
          onClick={() => {
            writeDayFlag(DISMISS_KEY);
            setVisible(false);
          }}
          aria-label="Dismiss"
          className="shrink-0 rounded-xl px-2 py-0.5 text-lg leading-none text-muted transition-colors hover:bg-stone-100 hover:text-stone-800"
        >
          ×
        </button>
      </div>
    </div>
  );
}
