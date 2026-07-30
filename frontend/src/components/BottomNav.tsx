"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ARA_POSE_SRC } from "@/lib/araPoses";
import { IconHome, IconProgress, IconShop } from "@/components/nav-icons";

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/progress", label: "Progress", Icon: IconProgress },
  { href: "/ara", label: "Ara", Icon: null },
  { href: "/shop", label: "Shop", Icon: IconShop },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-surface/95 backdrop-blur-md md:hidden">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-around px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                isActive
                  ? "bg-brand-soft text-brand"
                  : "text-stone-400 hover:text-brand-ink"
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
                  className={`h-5 w-5 object-contain ${
                    isActive ? "opacity-100" : "opacity-60"
                  }`}
                  unoptimized
                />
              )}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
