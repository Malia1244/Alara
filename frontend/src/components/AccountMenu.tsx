"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { IconLogout } from "@/components/nav-icons";

type Props = {
  /** sidebar = stacked in the desktop rail; bar = compact row for mobile */
  variant?: "sidebar" | "bar";
};

export default function AccountMenu({ variant = "sidebar" }: Props) {
  const { user, displayName, signOut, updateDisplayName } = useAuth();
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setNameDraft(displayName);
  }, [displayName]);

  if (!user) return null;

  const email = user.email ?? "Signed in";
  const label = displayName || email;

  async function saveName() {
    setBusy(true);
    setMsg(null);
    const err = await updateDisplayName(nameDraft);
    setBusy(false);
    setMsg(err ?? "Saved");
  }

  if (variant === "bar") {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5">
        <p className="min-w-0 truncate text-[11px] text-muted">{label}</p>
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
    <div className="flex flex-col gap-2">
      <div className="rounded-[1.25rem] border border-border bg-panel px-3.5 py-3 shadow-[0_8px_20px_-16px_rgba(180,100,130,0.35)]">
        <p className="truncate text-[11px] text-muted">{email}</p>
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Lounge name
          </span>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value.slice(0, 24))}
            maxLength={24}
            placeholder="Display name"
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-brand"
          />
        </label>
        <button
          type="button"
          disabled={busy || nameDraft.trim() === displayName}
          onClick={() => void saveName()}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-brand-ink transition hover:bg-brand-soft disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save name"}
        </button>
        {msg && (
          <p
            className={`mt-1 text-[10px] ${
              msg === "Saved" ? "text-brand-ink" : "text-accent"
            }`}
          >
            {msg}
          </p>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-brand-ink transition-colors hover:border-brand/40 hover:bg-brand-soft"
        >
          <IconLogout className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>
      <p className="px-1 text-center text-[10px] tracking-wide text-muted/70">
        made by Malia
      </p>
    </div>
  );
}
