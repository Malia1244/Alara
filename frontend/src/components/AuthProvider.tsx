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
import { deleteAvatar, uploadAvatar } from "@/lib/api";
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
  displayName: string;
  avatarUrl: string | null;
  /** True after the user opens a password-reset email link. */
  passwordRecovery: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  updateDisplayName: (name: string) => Promise<string | null>;
  updateAvatar: (file: {
    image_base64: string;
    image_mime: string;
  }) => Promise<string | null>;
  clearAvatar: () => Promise<string | null>;
};

function readDisplayName(user: User | null | undefined): string {
  if (!user) return "";
  const raw = user.user_metadata?.display_name;
  return typeof raw === "string" ? raw.trim().slice(0, 24) : "";
}

function readAvatarPath(user: User | null | undefined): string | null {
  if (!user) return null;
  const raw = user.user_metadata?.avatar_path;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function publicAvatarUrl(path: string | null): string | null {
  if (!path) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) return null;
  const parts = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/avatars/${parts}`;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

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
        setPasswordRecovery(false);
      }
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
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
    setPasswordRecovery(false);
    await supabase.auth.signOut();
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const cleaned = email.trim();
    if (!cleaned) return "Enter the email for your account.";
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(cleaned, {
        redirectTo,
      });
      return error?.message ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        return "Can't reach Supabase right now. Try again in a moment.";
      }
      return msg || "Couldn't send a reset email.";
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (password.length < 6) {
      return "Use at least 6 characters.";
    }
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return error.message;
      setPasswordRecovery(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Couldn't update that password.";
    }
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    const cleaned = name.trim().replace(/\s+/g, " ").slice(0, 24);
    if (cleaned.length < 2) {
      return "Pick a name at least 2 characters.";
    }
    if (!/^[\w .'-]+$/u.test(cleaned)) {
      return "Use letters, numbers, spaces, or . _ ' - only.";
    }
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { display_name: cleaned },
      });
      if (error) return error.message;
      if (data.user) {
        setSession((prev) =>
          prev ? { ...prev, user: data.user } : prev
        );
      }
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Couldn't save that name.";
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setSession((prev) => (prev ? { ...prev, user: data.user! } : prev));
    }
  }, []);

  const updateAvatar = useCallback(
    async (file: { image_base64: string; image_mime: string }) => {
      try {
        await uploadAvatar(file);
        await refreshUser();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Couldn't save that photo.";
      }
    },
    [refreshUser]
  );

  const clearAvatar = useCallback(async () => {
    try {
      await deleteAvatar();
      await refreshUser();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Couldn't remove that photo.";
    }
  }, [refreshUser]);

  const user = session?.user ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      accessToken: session?.access_token ?? null,
      displayName: readDisplayName(user),
      avatarUrl: publicAvatarUrl(readAvatarPath(user)),
      passwordRecovery,
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateDisplayName,
      updateAvatar,
      clearAvatar,
    }),
    [
      user,
      session,
      isLoading,
      passwordRecovery,
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateDisplayName,
      updateAvatar,
      clearAvatar,
    ]
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
