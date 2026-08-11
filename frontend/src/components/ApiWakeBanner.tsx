"use client";

import { useEffect, useState } from "react";
import { wakeApi } from "@/lib/api";

/**
 * Free Render backends sleep when idle. The first request can take 30–60s.
 * Ping /health on load and show a short notice while waiting.
 */
export default function ApiWakeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;

    slowTimer = setTimeout(() => {
      if (!cancelled) setShow(true);
    }, 2500);

    wakeApi().finally(() => {
      if (slowTimer) clearTimeout(slowTimer);
      if (!cancelled) setShow(false);
    });

    return () => {
      cancelled = true;
      if (slowTimer) clearTimeout(slowTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-3">
      <p className="rounded-xl border border-border bg-surface/95 px-4 py-2 text-center text-xs font-medium text-ink shadow-sm backdrop-blur">
        Waking up the server — free hosting can take about 30–60 seconds the
        first time…
      </p>
    </div>
  );
}
