"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import AuthGate from "@/components/AuthGate";
import { AraPrefsProvider } from "@/components/AraPrefsProvider";
import ApiWakeBanner from "@/components/ApiWakeBanner";
import StudyMusicBridge from "@/components/StudyMusicBridge";
import StudySessionBar from "@/components/StudySessionBar";
import {
  STUDY_SESSION_EVENT,
  activeStudySceneTheme,
  applyStudySceneTheme,
  readStudySession,
} from "@/lib/studySession";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.has(pathname);

  // Whole-app vibe palette while a café study session is open.
  useEffect(() => {
    const sync = () => {
      applyStudySceneTheme(
        activeStudySceneTheme(readStudySession(), pathname)
      );
    };
    sync();
    window.addEventListener(STUDY_SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STUDY_SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [pathname]);

  useEffect(() => {
    return () => applyStudySceneTheme(null);
  }, []);

  return (
    <AuthGate>
      <AraPrefsProvider>
        <ApiWakeBanner />
        <div
          className={
            isPublic
              ? "relative z-10 flex min-h-full flex-1 flex-col"
              : "relative z-10 flex min-h-full flex-1 flex-col pb-20 md:pb-0 md:pl-64"
          }
        >
          {!isPublic && <StudyMusicBridge />}
          {!isPublic && <Sidebar />}
          {!isPublic && <StudySessionBar />}
          {children}
          {!isPublic && <BottomNav />}
        </div>
      </AraPrefsProvider>
    </AuthGate>
  );
}
