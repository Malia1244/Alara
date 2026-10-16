"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchLoungeMessages } from "@/lib/api";
import {
  hasLoungeUnread,
  latestLoungeActivity,
  markLoungeSeen,
  notifyLoungeUnread,
  readLoungeLastSeen,
  subscribeLoungeUnread,
} from "@/lib/loungeUnread";

const POLL_MS = 12000;

let sharedHasUnread = false;
let pollTimer: number | null = null;
let pollSubscribers = 0;
let onLoungePages = 0;

async function refreshLoungeUnread(forceSeen: boolean) {
  try {
    const messages = await fetchLoungeMessages();
    if (forceSeen || onLoungePages > 0) {
      markLoungeSeen(latestLoungeActivity(messages));
      sharedHasUnread = false;
      notifyLoungeUnread(false);
      return;
    }
    sharedHasUnread = hasLoungeUnread(messages, readLoungeLastSeen());
    notifyLoungeUnread(sharedHasUnread);
  } catch {
    // Keep previous badge state if lounge API is asleep.
  }
}

function startSharedPoll() {
  if (pollTimer !== null) return;
  void refreshLoungeUnread(false);
  pollTimer = window.setInterval(() => {
    void refreshLoungeUnread(false);
  }, POLL_MS);
}

function stopSharedPoll() {
  if (pollSubscribers > 0) return;
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function useLoungeUnread() {
  const pathname = usePathname();
  const onLounge = pathname.startsWith("/lounge");
  const [hasUnread, setHasUnread] = useState(sharedHasUnread);

  useEffect(() => subscribeLoungeUnread(setHasUnread), []);

  useEffect(() => {
    pollSubscribers += 1;
    startSharedPoll();
    return () => {
      pollSubscribers -= 1;
      stopSharedPoll();
    };
  }, []);

  useEffect(() => {
    if (onLounge) {
      onLoungePages += 1;
      void refreshLoungeUnread(true);
      return () => {
        onLoungePages = Math.max(0, onLoungePages - 1);
      };
    }
    void refreshLoungeUnread(false);
  }, [onLounge]);

  return hasUnread && !onLounge;
}
