"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import CharacterStage from "@/components/CharacterStage";
import CutFlowerScatter from "@/components/CutFlowers";
import { useAuth } from "@/components/AuthProvider";

const inputClass =
  "rounded-full border border-border bg-white px-5 py-2.5 text-sm font-normal text-ink outline-none transition-[border-color,box-shadow] shadow-[0_8px_22px_-16px_rgba(140,100,115,0.28)] focus:border-brand focus:shadow-[0_0_0_3px_rgba(201,160,171,0.28)]";

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
    <div className="relative flex flex-1 justify-center px-4 py-14">
      <CutFlowerScatter variant="auth" />
      <main className="relative z-[1] flex w-full max-w-md flex-col gap-6 overflow-visible">
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
            className="bloom-pill px-5 py-2.5 text-sm font-semibold transition hover:brightness-105 disabled:opacity-50"
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
        <p className="text-center text-[10px] tracking-wide text-muted/70">
          made by Malia
        </p>
      </main>
    </div>
  );
}
