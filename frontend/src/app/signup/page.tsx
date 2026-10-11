"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import CharacterStage from "@/components/CharacterStage";
import CutFlowerScatter from "@/components/CutFlowers";
import { useAuth } from "@/components/AuthProvider";
import {
  markTutorialPending,
  skipWelcomeSplashPermanently,
} from "@/lib/onboarding";

const inputClass =
  "rounded-full border border-border bg-white px-5 py-2.5 text-sm font-normal text-ink outline-none transition-[border-color,box-shadow] shadow-[0_8px_22px_-16px_rgba(140,100,115,0.28)] focus:border-brand focus:shadow-[0_0_0_3px_rgba(201,160,171,0.28)]";

export default function SignupPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [skipIntro, setSkipIntro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(false);
  const [signedInNow, setSignedInNow] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setAwaitingEmail(false);
    setSignedInNow(false);
    const result = await signUp(email.trim(), password);
    if (result.error) {
      setError(result.error);
    } else {
      if (skipIntro) {
        skipWelcomeSplashPermanently();
      } else {
        markTutorialPending();
      }
      if (result.needsEmailConfirm) {
        setAwaitingEmail(true);
      } else {
        setSignedInNow(true);
      }
    }
    setIsSaving(false);
  }

  if (awaitingEmail) {
    return (
      <div className="relative flex flex-1 justify-center px-4 py-14">
        <CutFlowerScatter variant="auth" />
        <main className="relative z-[1] flex w-full max-w-md flex-col gap-6 overflow-visible">
          <div className="flex flex-col items-center text-center">
            <CharacterStage size={100} pose="wave" priority pad="md" />
            <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
              Check your email
            </h1>
          </div>
          <div className="bloom-card flex flex-col gap-3 p-7 text-center">
            <p className="text-sm leading-relaxed text-ink">
              We sent a confirmation link to{" "}
              <span className="font-semibold">{email.trim()}</span>.
            </p>
            <ol className="mt-1 space-y-2 text-left text-sm leading-relaxed text-muted">
              <li>1. Open your email app (Gmail, Outlook, etc.)</li>
              <li>2. Find the message from Alara / Supabase</li>
              <li>3. Tap the confirm link</li>
              <li>4. Come back here and sign in</li>
            </ol>
            <p className="text-xs leading-relaxed text-muted">
              Don’t see it? Check spam / promotions. It can take a minute.
            </p>
            <Link
              href="/login"
              className="bloom-pill mt-2 px-5 py-2.5 text-sm font-semibold"
            >
              Go to sign in
            </Link>
          </div>
          <p className="text-center text-[10px] tracking-wide text-muted/70">
            made by Malia
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 justify-center px-4 py-14">
      <CutFlowerScatter variant="auth" />
      <main className="relative z-[1] flex w-full max-w-md flex-col gap-6 overflow-visible">
        <div className="flex flex-col items-center text-center">
          <CharacterStage size={100} pose="cheer" priority pad="md" />
          <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
            Alara
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Create an account — notes and quizzes stay private.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bloom-card flex flex-col gap-4 p-7"
        >
          <p className="rounded-2xl bg-panel px-3.5 py-2.5 text-xs leading-relaxed text-muted">
            After you sign up, open your email and tap the confirmation link
            before signing in.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={skipIntro}
              onChange={(e) => setSkipIntro(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[var(--brand)]"
            />
            Skip intro preview
          </label>
          {error && <p className="text-sm text-accent">{error}</p>}
          {signedInNow && (
            <p className="text-sm text-brand-ink">
              You’re signed in — head to{" "}
              <Link href="/" className="font-semibold underline">
                Home
              </Link>{" "}
              to start.
            </p>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="bloom-pill px-5 py-2.5 text-sm font-semibold transition hover:brightness-105 disabled:opacity-50"
          >
            {isSaving ? "Creating…" : "Sign up"}
          </button>
        </form>

        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
        <p className="text-center text-[10px] tracking-wide text-muted/70">
          made by Malia
        </p>
      </main>
    </div>
  );
}
