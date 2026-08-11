"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconHome,
  IconHomework,
  IconProgress,
  IconShop,
  IconTeach,
  IconTimer,
} from "@/components/nav-icons";

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/timed-study", label: "Focus", Icon: IconTimer },
  { href: "/homework", label: "Help", Icon: IconHomework },
  { href: "/progress", label: "Stats", Icon: IconProgress },
  { href: "/teach-ara", label: "Teach", Icon: IconTeach },
  { href: "/shop", label: "Shop", Icon: IconShop },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md md:hidden">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-around gap-0.5 px-1 py-2 sm:px-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-colors sm:min-w-[4.5rem] sm:px-3 sm:text-[11px] ${
                isActive
                  ? "bg-brand-soft text-brand-ink"
                  : "text-muted hover:text-brand-ink"
              }`}
            >
              <item.Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
