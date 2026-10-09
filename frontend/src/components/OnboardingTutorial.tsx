"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { useAuth } from "@/components/AuthProvider";
import {
  TUTORIAL_STEPS,
  markTutorialDone,
  shouldShowTutorial,
} from "@/lib/onboarding";

export default function OnboardingTutorial() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    // Defer one tick so AchievementSplash session flag can settle first.
    const id = window.setTimeout(() => {
      setOpen(shouldShowTutorial(user.id));
    }, 450);
    return () => window.clearTimeout(id);
  }, [user?.id]);

  if (!open || !user?.id) return null;

  const current = TUTORIAL_STEPS[step];
  const isLast = step >= TUTORIAL_STEPS.length - 1;
  const pose = step === 0 ? "wave" : isLast ? "cheer" : "encourage";

  function finish() {
    markTutorialDone(user!.id);
    setOpen(false);
  }

  function next() {
    if (isLast) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Skip tutorial"
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
        onClick={finish}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="achievement-card bloom-card relative z-[1] w-full max-w-md overflow-visible px-6 pb-7 pt-8 text-center shadow-[0_30px_80px_-28px_rgba(180,100,130,0.45)]"
      >
        <button
          type="button"
          onClick={finish}
          className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-muted transition hover:bg-panel hover:text-ink"
        >
          Skip
        </button>

        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
          Getting started · {step + 1}/{TUTORIAL_STEPS.length}
        </p>

        <div className="mx-auto mt-4 flex justify-center">
          <CharacterStage size={140} pose={pose} priority pad="lg" label="Ara" />
        </div>

        <h2
          id="tutorial-title"
          className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink"
        >
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{current.body}</p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {TUTORIAL_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-5 bg-brand" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {current.href && current.cta ? (
            <Link
              href={current.href}
              onClick={isLast ? finish : next}
              className="bloom-pill w-full px-4 py-3 text-sm font-semibold transition hover:brightness-105"
            >
              {current.cta}
            </Link>
          ) : (
            <button
              type="button"
              onClick={next}
              className="bloom-pill w-full px-4 py-3 text-sm font-semibold transition hover:brightness-105"
            >
              {isLast ? "Start studying" : "Next"}
            </button>
          )}
          <button
            type="button"
            onClick={finish}
            className="w-full rounded-xl px-4 py-2 text-sm font-medium text-muted transition hover:text-ink"
          >
            {isLast ? "Close" : "Skip intro"}
          </button>
        </div>
      </div>
    </div>
  );
}
