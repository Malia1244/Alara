"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AuthAraPair from "@/components/AuthAraPair";
import CutFlowerScatter from "@/components/CutFlowers";
import { useAuth } from "@/components/AuthProvider";

const inputClass =
  "rounded-full border border-border bg-white px-5 py-2.5 text-sm font-normal text-ink outline-none transition-[border-color,box-shadow] shadow-[0_8px_22px_-16px_rgba(140,100,115,0.28)] focus:border-brand focus:shadow-[0_0_0_3px_rgba(201,160,171,0.28)]";

export default function ResetPasswordPage() {
  const { user, isLoading, passwordRecovery, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 2500);
    return () => window.clearTimeout(id);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don’t match.");
      return;
    }
    setIsSaving(true);
    setError(null);
    const message = await updatePassword(password);
    if (message) {
      setError(message);
      setIsSaving(false);
      return;
    }
    setDone(true);
    setIsSaving(false);
    window.setTimeout(() => router.replace("/"), 1200);
  }

  const ready = Boolean(user) && (passwordRecovery || waited);

  if (done) {
    return (
      <div className="relative flex flex-1 justify-center px-4 py-14">
        <CutFlowerScatter variant="auth" />
        <main className="relative z-[1] flex w-full max-w-md flex-col gap-6 overflow-visible">
          <div className="flex flex-col items-center text-center">
            <AuthAraPair girlPose="cheer" boyPose="wave" />
            <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
              Password updated
            </h1>
            <p className="mt-1.5 text-sm text-muted">Taking you home…</p>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading || (!ready && !waited)) {
    return (
      <div className="relative flex flex-1 justify-center px-4 py-14">
        <CutFlowerScatter variant="auth" />
        <main className="relative z-[1] flex w-full max-w-md flex-col gap-6 overflow-visible">
          <div className="bloom-card p-7 text-center text-sm text-muted">
            Opening your reset link…
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex flex-1 justify-center px-4 py-14">
        <CutFlowerScatter variant="auth" />
        <main className="relative z-[1] flex w-full max-w-md flex-col gap-6 overflow-visible">
          <div className="flex flex-col items-center text-center">
            <AuthAraPair girlPose="wave" boyPose="wave" />
            <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
              Link expired
            </h1>
          </div>
          <div className="bloom-card flex flex-col gap-3 p-7 text-center">
            <p className="text-sm leading-relaxed text-muted">
              That reset link isn’t valid anymore. Request a new one and try
              again.
            </p>
            <Link
              href="/forgot-password"
              className="bloom-pill mt-1 px-5 py-2.5 text-sm font-semibold"
            >
              Forgot password
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold text-brand hover:underline"
            >
              Back to sign in
            </Link>
          </div>
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
            New password
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Choose something you’ll remember.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bloom-card flex flex-col gap-4 p-7"
        >
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            New password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Confirm password
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </label>
          {error && <p className="text-sm text-accent">{error}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="bloom-pill px-5 py-2.5 text-sm font-semibold transition hover:brightness-105 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save password"}
          </button>
        </form>
      </main>
    </div>
  );
}
