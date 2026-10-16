"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountMenu from "@/components/AccountMenu";
import { useLoungeUnread } from "@/hooks/useLoungeUnread";
import {
  IconCalendar,
  IconHome,
  IconHomework,
  IconLounge,
  IconProgress,
  IconShop,
  IconTimer,
} from "@/components/nav-icons";

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/lounge", label: "Lounge", Icon: IconLounge },
  { href: "/timed-study", label: "Focus", Icon: IconTimer },
  { href: "/homework", label: "Help", Icon: IconHomework },
  { href: "/progress", label: "Stats", Icon: IconProgress },
  { href: "/shop", label: "Shop", Icon: IconShop },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const loungeUnread = useLoungeUnread();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-surface/90 shadow-[0_-12px_36px_-20px_rgba(180,100,130,0.35)] backdrop-blur-xl md:hidden">
      <div className="mx-auto w-full max-w-3xl">
        <AccountMenu variant="bar" />
      </div>
      <div className="mx-auto flex w-full max-w-3xl items-center justify-around gap-0.5 px-1 py-2 sm:px-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const showDot = item.href === "/lounge" && loungeUnread;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold transition-all sm:min-w-[4.5rem] sm:px-3 sm:text-[11px] ${
                isActive
                  ? "rounded-2xl border border-[#c5d4e2]/70 bg-[#e8f0f7] text-brand-ink shadow-[0_8px_18px_-10px_rgba(120,145,170,0.4)]"
                  : "rounded-2xl text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              <span className="relative">
                <item.Icon className="h-5 w-5" />
                {showDot && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-surface"
                    aria-hidden
                  />
                )}
              </span>
              {item.label}
              {showDot && <span className="sr-only">New messages</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
