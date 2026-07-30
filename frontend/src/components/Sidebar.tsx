"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { fetchShopState } from "@/lib/api";
import { ARA_POSE_SRC } from "@/lib/araPoses";
import { IconHome, IconProgress, IconShop } from "@/components/nav-icons";

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/progress", label: "Progress", Icon: IconProgress },
  { href: "/ara", label: "Ara", Icon: null },
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
        if (!cancelled) setPoints(data.points);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/80 bg-surface/90 px-5 py-7 backdrop-blur-md md:flex">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Image
          src={ARA_POSE_SRC.wink}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
          unoptimized
        />
        <div className="flex flex-col leading-none">
          <span className="font-display text-xl font-bold tracking-tight text-brand-ink">
            Alara
          </span>
          <span className="mt-1 text-[11px] font-medium text-muted">
            Study, play, repeat
          </span>
        </div>
      </Link>

      {points !== null && (
        <Link
          href="/shop"
          className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-brand-soft/60 px-3.5 py-2.5 transition-colors hover:bg-brand-soft"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-ink/70">
            Points
          </span>
          <span className="font-display text-sm font-bold text-brand">
            {points}
          </span>
        </Link>
      )}

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
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-brand text-white shadow-[0_8px_20px_-12px_rgba(15,118,110,0.8)]"
                  : "text-stone-500 hover:bg-stone-100 hover:text-brand-ink"
              }`}
            >
              {item.Icon ? (
                <item.Icon className="h-5 w-5" />
              ) : (
                <Image
                  src={ARA_POSE_SRC.wink}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                  unoptimized
                />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-brand-soft/80 to-white p-4">
          <div className="flex items-center gap-3">
            <Image
              src={ARA_POSE_SRC.encourage}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
              unoptimized
            />
            <div>
              <p className="font-display text-sm font-bold text-brand-ink">
                Keep going
              </p>
              <p className="text-xs leading-snug text-muted">
                Log today&apos;s notes — Ara&apos;s ready when you are.
              </p>
            </div>
          </div>
        </div>
        {user?.email && (
          <div className="px-1">
            <p className="truncate text-[11px] text-muted">{user.email}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 text-xs font-semibold text-brand hover:underline"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
