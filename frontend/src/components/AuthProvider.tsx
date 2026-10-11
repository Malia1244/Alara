"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { clearCachedLookSrc } from "@/lib/araOutfitCache";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type SignUpResult = {
  error: string | null;
  /** True when Supabase requires clicking the confirm link in email. */
  needsEmailConfirm: boolean;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  accessToken: string | null;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Only clear on sign-out — clearing on sign-in made Ara flash the default
      // outfit on every session restore / navigation race.
      if (event === "SIGNED_OUT") {
        clearCachedLookSrc();
      }
      setSession(next);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        return { error: error.message, needsEmailConfirm: false };
      }
      // No session yet → email confirmation is required before they can sign in.
      const needsEmailConfirm = !data.session;
      return { error: null, needsEmailConfirm };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        return {
          error:
            "Can't reach Supabase right now. Check that your project is active (not paused) and NEXT_PUBLIC_SUPABASE_URL is correct.",
          needsEmailConfirm: false,
        };
      }
      return { error: msg || "Sign up failed.", needsEmailConfirm: false };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return error?.message ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        return "Can't reach Supabase right now. Check that your project is active (not paused) and NEXT_PUBLIC_SUPABASE_URL is correct.";
      }
      return msg || "Sign in failed.";
    }
  }, []);

  const signOut = useCallback(async () => {
    clearCachedLookSrc();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      accessToken: session?.access_token ?? null,
      signUp,
      signIn,
      signOut,
    }),
    [session, isLoading, signUp, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
