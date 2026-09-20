"use client";

import { useAuth } from "@/components/AuthProvider";
import { IconLogout } from "@/components/nav-icons";

type Props = {
  /** sidebar = stacked in the desktop rail; bar = compact row for mobile */
  variant?: "sidebar" | "bar";
};

export default function AccountMenu({ variant = "sidebar" }: Props) {
  const { user, signOut } = useAuth();
  if (!user) return null;

  const email = user.email ?? "Signed in";

  if (variant === "bar") {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5">
        <p className="min-w-0 truncate text-[11px] text-muted">{email}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-ink transition-colors hover:bg-brand-soft"
        >
          <IconLogout className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-panel px-3.5 py-3">
      <p className="truncate text-[11px] text-muted">{email}</p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-brand-ink transition-colors hover:border-brand/40 hover:bg-brand-soft"
      >
        <IconLogout className="h-3.5 w-3.5" />
        Log out
      </button>
    </div>
  );
}
