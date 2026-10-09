"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AccountMenu from "@/components/AccountMenu";
import AraPrefsControls from "@/components/AraPrefsControls";
import DiscordInviteLink from "@/components/DiscordInviteLink";
import { fetchShopState } from "@/lib/api";
import { syncLookFromShop } from "@/lib/araOutfitCache";
import {
  IconCloset,
  IconHome,
  IconHomework,
  IconLounge,
  IconProgress,
  IconShop,
  IconTeach,
  IconTimer,
} from "@/components/nav-icons";

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/lounge", label: "Lounge", Icon: IconLounge },
  { href: "/timed-study", label: "Timed Study", Icon: IconTimer },
  { href: "/homework", label: "Homework", Icon: IconHomework },
  { href: "/progress", label: "Progress", Icon: IconProgress },
  { href: "/ara", label: "Outfit", Icon: IconCloset },
  { href: "/teach-ara", label: "Teach / Voice", Icon: IconTeach },
  { href: "/shop", label: "Shop", Icon: IconShop },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchShopState()
      .then((data) => {
        if (cancelled) return;
        setPoints(data.points);
        syncLookFromShop(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-hidden border-r border-border/80 bg-surface/90 px-3 py-5 backdrop-blur-md md:flex">
      <Link href="/" className="mb-6 flex items-center gap-3 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-bold tracking-tight text-white shadow-sm shadow-brand/25">
          A
        </span>
        <div className="flex flex-col leading-none">
          <span className="font-display text-xl font-semibold tracking-tight text-ink">
            Alara
          </span>
          <span className="mt-1 text-[11px] font-medium text-muted">
            Study with Ara
          </span>
        </div>
      </Link>

      {points !== null && (
        <Link
          href="/shop"
          className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-panel px-3.5 py-2.5 transition-colors hover:border-brand/35"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Balance
          </span>
          <span className="text-sm font-semibold text-brand-ink">
            {points} pts
          </span>
        </Link>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-soft text-brand-ink"
                    : "text-muted hover:bg-panel hover:text-ink"
                }`}
              >
                <item.Icon className="h-4 w-4 opacity-90" />
                {item.label}
              </Link>
            );
          })}
          <DiscordInviteLink />
        </nav>
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <AraPrefsControls compact />
          <div className="rounded-2xl border border-border bg-panel/80 px-3.5 py-3">
            <p className="text-sm font-semibold text-ink">Today</p>
            <p className="mt-1 text-xs leading-snug text-muted">
              Log notes, quiz, or teach Ara.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 shrink-0">
        <AccountMenu />
      </div>
    </aside>
  );
}
