"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import AraPrefsControls from "@/components/AraPrefsControls";
import { fetchShopState } from "@/lib/api";
import { lookSrcFromShop, writeCachedLookSrc } from "@/lib/araOutfitCache";
import {
  IconCloset,
  IconHome,
  IconHomework,
  IconProgress,
  IconShop,
  IconTeach,
  IconTimer,
} from "@/components/nav-icons";

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/timed-study", label: "Timed Study", Icon: IconTimer },
  { href: "/homework", label: "Homework", Icon: IconHomework },
  { href: "/progress", label: "Progress", Icon: IconProgress },
  { href: "/ara", label: "Outfit", Icon: IconCloset },
  { href: "/teach-ara", label: "Teach / Voice", Icon: IconTeach },
  { href: "/shop", label: "Shop", Icon: IconShop },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchShopState()
      .then((data) => {
        if (cancelled) return;
        setPoints(data.points);
        writeCachedLookSrc(lookSrcFromShop(data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold tracking-tight text-white">
          A
        </span>
        <div className="flex flex-col leading-none">
          <span className="font-display text-xl font-semibold tracking-tight text-brand-ink">
            Alara
          </span>
          <span className="mt-1 text-[11px] font-medium text-muted">
            Study workspace
          </span>
        </div>
      </Link>

      {points !== null && (
        <Link
          href="/shop"
          className="mb-5 flex items-center justify-between rounded-xl border border-brand/25 bg-brand-soft px-3.5 py-2.5 transition-colors hover:border-brand/50"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-ink/70">
            Balance
          </span>
          <span className="font-display text-sm font-semibold text-brand">
            {points} pts
          </span>
        </Link>
      )}

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-brand-soft hover:text-brand-ink"
              }`}
            >
              <item.Icon className="h-4 w-4 opacity-90" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <AraPrefsControls compact />
        <div className="rounded-xl border border-border bg-panel px-3.5 py-3">
          <p className="text-sm font-semibold text-ink">Today</p>
          <p className="mt-1 text-xs leading-snug text-muted">
            Log notes, run a quiz, or teach Ara what you studied.
          </p>
        </div>
        {user?.email && (
          <div className="px-1">
            <p className="truncate text-[11px] text-muted">{user.email}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 text-xs font-semibold text-brand-ink hover:underline"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
