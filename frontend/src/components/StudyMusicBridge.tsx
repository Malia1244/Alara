"use client";

import { useEffect } from "react";
import { getSharedAmbientPlayer } from "@/lib/ambientAudio";
import {
  STUDY_SESSION_EVENT,
  readStudySession,
} from "@/lib/studySession";

/**
 * Keeps study-scene music playing across the whole Alara app while a
 * session is active and musicOn is true. Mute stays muted everywhere.
 */
export default function StudyMusicBridge() {
  useEffect(() => {
    const player = getSharedAmbientPlayer();

    const sync = () => {
      const session = readStudySession();
      if (session?.status === "active" && session.musicOn) {
        void player.start(session.vibe);
        return;
      }
      // Ended, cleared, or muted — stop the bed (ding still works separately).
      player.stop();
    };

    sync();
    window.addEventListener(STUDY_SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STUDY_SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
      // App shell unmounting (e.g. leave app) — stop audio.
      player.stop();
    };
  }, []);

  return null;
}
