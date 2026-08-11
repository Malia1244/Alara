"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import { isSupabaseConfigured } from "@/lib/supabase";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isSupabaseConfigured) return;
    if (!user && !isPublic) {
      router.replace("/login");
    }
    if (user && isPublic) {
      router.replace("/");
    }
  }, [user, isLoading, isPublic, router]);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="max-w-md rounded-[1.75rem] border border-border bg-surface p-7 text-center">
          <p className="font-display text-xl font-bold text-stone-900">
            Auth not configured
          </p>
          <p className="mt-2 text-sm text-muted">
            Add <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="text-xs">frontend/.env.local</code>, then restart
            the frontend.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || (!user && !isPublic) || (user && isPublic)) {
    return (
      <LoadingScreen
        title="Alara"
        message={
          isLoading ? "Signing you in…" : "Taking you to the right place…"
        }
      />
    );
  }

  return <>{children}</>;
}
