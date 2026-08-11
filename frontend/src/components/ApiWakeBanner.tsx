"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import { wakeApi } from "@/lib/api";

/**
 * Free Render backends sleep when idle. Show a full loading page while
 * waking so other devices don't look stuck on a blank screen.
 */
export default function ApiWakeBanner() {
  const [phase, setPhase] = useState<"checking" | "slow" | "ready">("checking");

  useEffect(() => {
    let cancelled = false;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;

    slowTimer = setTimeout(() => {
      if (!cancelled) setPhase("slow");
    }, 1200);

    wakeApi().finally(() => {
      if (slowTimer) clearTimeout(slowTimer);
      if (!cancelled) setPhase("ready");
    });

    return () => {
      cancelled = true;
      if (slowTimer) clearTimeout(slowTimer);
    };
  }, []);

  if (phase !== "slow") return null;

  return (
    <div className="fixed inset-0 z-[70] flex bg-[var(--background)]">
      <LoadingScreen
        title="Waking Ara up"
        message="The free server went to sleep. This can take about 30–60 seconds the first time — hang tight."
      />
    </div>
  );
}
