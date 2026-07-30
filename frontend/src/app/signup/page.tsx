"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import AraAvatar from "@/components/AraAvatar";
import { useAuth } from "@/components/AuthProvider";

export default function SignupPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setInfo(null);
    const message = await signUp(email.trim(), password);
    if (message) {
      setError(message);
    } else {
      setInfo(
        "Account created! If email confirmation is on in Supabase, check your inbox — otherwise you’re signed in."
      );
    }
    setIsSaving(false);
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-14">
      <main className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <AraAvatar size={88} pose="cheer" showOutfits={false} priority />
          <h1 className="mt-3 font-display text-3xl font-bold text-stone-900">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your learnings and quizzes stay private to you.
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
          {info && <p className="text-sm text-brand">{info}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {isSaving ? "Creating..." : "Sign up"}
          </button>
        </form>

        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
