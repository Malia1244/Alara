"use client";

import AraAvatar from "@/components/AraAvatar";

type Props = {
  title?: string;
  message?: string;
};

export default function LoadingScreen({
  title = "Alara",
  message = "Getting things ready…",
}: Props) {
  return (
    <div className="relative z-10 flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="animate-rise">
          <AraAvatar
            size={120}
            pose="wave"
            showOutfits={false}
            motion="idle"
            priority
          />
        </div>
        <div className="animate-rise-delay space-y-2">
          <p className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
            {title}
          </p>
          <p className="text-sm leading-relaxed text-muted">{message}</p>
        </div>
        <div
          className="h-1.5 w-40 overflow-hidden rounded-full bg-brand-soft"
          aria-hidden
        >
          <div className="alara-loading-bar h-full w-1/2 rounded-full bg-brand" />
        </div>
      </div>
    </div>
  );
}
