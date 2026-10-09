"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import CharacterStage from "@/components/CharacterStage";
import { useAuth } from "@/components/AuthProvider";

const inputClass =
  "rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-normal text-ink outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[0_0_0_3px_rgba(15,107,92,0.12)]";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    if (message) setError(message);
    setIsSaving(false);
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-14">
      <main className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <CharacterStage size={100} pose="wink" priority pad="md" />
          <h1 className="mt-5 font-display text-3xl font-semibold text-ink">
            Alara
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Sign in to your notes, quizzes, and Ara.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-7 shadow-[0_16px_40px_-28px_rgba(15,26,23,0.45)]"
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
          {error && <p className="text-sm text-accent">{error}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
          >
            {isSaving ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}
