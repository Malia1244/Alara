"use client";

import { useEffect, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { pickOpenAchievement, type Achievement } from "@/lib/achievements";
import { readFocusMinutesTotal } from "@/lib/focusStats";
import { fetchProgress } from "@/lib/api";

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

  if (!open || !achievement) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Dismiss achievement"
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-title"
        className="achievement-card relative z-[1] w-full max-w-md overflow-hidden rounded-[1.75rem] border border-border bg-surface px-6 pb-7 pt-8 text-center shadow-[0_30px_80px_-28px_rgba(16,32,28,0.55)]"
      >
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
          onClick={() => setOpen(false)}
          className="mt-6 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-ink"
        >
          Let’s study
        </button>
      </div>
    </div>
  );
}
