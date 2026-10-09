"use client";

import { useEffect, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { pickOpenAchievement, type Achievement } from "@/lib/achievements";
import { readFocusMinutesTotal } from "@/lib/focusStats";
import { fetchProgress } from "@/lib/api";
import {
  isTutorialPending,
  isWelcomeSplashSkipped,
  skipWelcomeSplashPermanently,
} from "@/lib/onboarding";

const SESSION_KEY = "alara-achievement-splash-shown";

type Props = {
  enabled?: boolean;
};

export default function AchievementSplash({ enabled = true }: Props) {
  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    // New accounts see the onboarding tutorial first.
    if (isTutorialPending()) return;
    if (isWelcomeSplashSkipped()) return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      // continue
    }

    let cancelled = false;
    fetchProgress()
      .then((stats) => {
        if (cancelled) return;
        const next = pickOpenAchievement({
          dayStreak: stats.day_streak,
          quizzesCompleted: stats.quizzes_completed,
          focusMinutes: readFocusMinutesTotal(),
        });
        setAchievement(next);
        setOpen(Boolean(next));
        try {
          window.sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Silent — don't block the app if progress fails.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  function dismiss() {
    setOpen(false);
  }

  function skipForever() {
    skipWelcomeSplashPermanently();
    setOpen(false);
  }

  if (!open || !achievement) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Dismiss preview"
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-title"
        className="achievement-card bloom-card relative z-[1] w-full max-w-md overflow-visible px-6 pb-7 pt-8 text-center shadow-[0_30px_80px_-28px_rgba(180,100,130,0.45)]"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-muted transition hover:bg-panel hover:text-ink"
        >
          Skip
        </button>
        <div className="achievement-confetti" aria-hidden />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
          Achievement unlocked
        </p>
        <div className="mx-auto mt-4 flex justify-center">
          <div className="achievement-stage">
            <CharacterStage
              size={168}
              pose="cheer"
              motion="dance"
              priority
              pad="lg"
              label="Ara"
            />
          </div>
        </div>
        <p
          id="achievement-title"
          className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
        >
          {achievement.title}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {achievement.subtitle}
        </p>
        <p className="mt-4 inline-flex rounded-full bg-brand-soft px-4 py-1.5 text-xs font-bold text-brand-ink">
          {achievement.badge}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="bloom-pill mt-6 w-full px-4 py-3 text-sm font-semibold transition hover:brightness-105"
        >
          Let’s study
        </button>
        <button
          type="button"
          onClick={skipForever}
          className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-medium text-muted transition hover:text-ink"
        >
          Don’t show this preview again
        </button>
      </div>
    </div>
  );
}
