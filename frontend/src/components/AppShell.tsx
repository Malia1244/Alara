"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import AuthGate from "@/components/AuthGate";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.has(pathname);

  return (
    <AuthGate>
      <div
        className={
          isPublic
            ? "flex min-h-full flex-1 flex-col"
            : "flex min-h-full flex-1 flex-col pb-20 md:pb-0 md:pl-64"
        }
      >
        {!isPublic && <Sidebar />}
        {children}
        {!isPublic && <BottomNav />}
      </div>
    </AuthGate>
  );
}
