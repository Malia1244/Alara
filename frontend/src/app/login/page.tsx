"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import AraAvatar from "@/components/AraAvatar";
import { useAuth } from "@/components/AuthProvider";

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
          <AraAvatar size={88} pose="wink" showOutfits={false} priority />
          <h1 className="mt-3 font-display text-3xl font-bold text-stone-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to see only your notes, quizzes, and Ara outfits.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-surface p-7"
        >
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-stone-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-2xl border border-border px-4 py-2.5 text-sm font-normal outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-stone-700">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-2xl border border-border px-4 py-2.5 text-sm font-normal outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
            />
          </label>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {isSaving ? "Signing in..." : "Sign in"}
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
