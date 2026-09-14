"use client";

import { getDiscordInviteUrl } from "@/lib/discord";
import { IconDiscord } from "@/components/nav-icons";

type Props = {
  /** Compact = sidebar / inline; banner = home page callout */
  variant?: "nav" | "banner";
};

export default function DiscordInviteLink({ variant = "nav" }: Props) {
  const url = getDiscordInviteUrl();
  if (!url) return null;

  if (variant === "banner") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-brand/40"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <IconDiscord className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Join the Discord</p>
            <p className="text-xs text-muted">
              Chat with other Alara students
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-semibold text-brand">Open →</span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
    >
      <IconDiscord className="h-4 w-4 opacity-90" />
      Discord
    </a>
  );
}
