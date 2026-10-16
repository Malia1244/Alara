"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import AuthAraPair from "@/components/AuthAraPair";
import CutFlowerScatter from "@/components/CutFlowers";
import { useAuth } from "@/components/AuthProvider";

const inputClass =
  "rounded-full border border-border bg-white px-5 py-2.5 text-sm font-normal text-ink outline-none transition-[border-color,box-shadow] shadow-[0_8px_22px_-16px_rgba(140,100,115,0.28)] focus:border-brand focus:shadow-[0_0_0_3px_rgba(201,160,171,0.28)]";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    const message = await requestPasswordReset(email.trim());
    if (message) {
      setError(message);
    } else {
      setSent(true);
    }
    setIsSaving(false);
  }

  if (sent) {
    return (
      <div className="relative flex flex-1 justify-center px-4 py-14">
        <CutFlowerScatter variant="auth" />
        <main className="relative z-[1] flex w-full max-w-md flex-col gap-6 overflow-visible">
          <div className="flex flex-col items-center text-center">
            <AuthAraPair girlPose="wave" boyPose="wave" />
            <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
              Check your email
            </h1>
          </div>
          <div className="bloom-card flex flex-col gap-3 p-7 text-center">
            <p className="text-sm leading-relaxed text-ink">
              If an account exists for{" "}
              <span className="font-semibold">{email.trim()}</span>, we sent a
              reset link.
            </p>
            <ol className="mt-1 space-y-2 text-left text-sm leading-relaxed text-muted">
              <li>1. Open your email app</li>
              <li>2. Find the message from Alara / Supabase</li>
              <li>3. Tap the reset link</li>
              <li>4. Choose a new password</li>
            </ol>
            <p className="text-xs leading-relaxed text-muted">
              Don’t see it? Check spam / promotions. It can take a minute.
            </p>
            <Link
              href="/login"
              className="bloom-pill mt-2 px-5 py-2.5 text-sm font-semibold"
            >
              Back to sign in
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
          <AuthAraPair girlPose="wink" boyPose="wave" />
          <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
            Forgot password
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            We’ll email you a link to choose a new one.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bloom-card flex flex-col gap-4 p-7"
        >
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
          {error && <p className="text-sm text-accent">{error}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="bloom-pill px-5 py-2.5 text-sm font-semibold transition hover:brightness-105 disabled:opacity-50"
          >
            {isSaving ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="text-center text-sm text-muted">
          Remembered it?{" "}
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
