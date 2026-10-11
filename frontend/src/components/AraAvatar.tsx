"use client";

import Image from "next/image";
import { useLayoutEffect, useState } from "react";
import { useAraLook } from "@/components/AraLookProvider";
import { useAraPrefs } from "@/components/AraPrefsProvider";
import type { ShopState } from "@/lib/api";
import {
  DEFAULT_LOOK_SRC,
  defaultLookSrc,
  getActiveLookSrc,
  syncLookFromShop,
} from "@/lib/araOutfitCache";
import type { AraPose } from "@/lib/araPoses";

type Props = {
  size: number;
  className?: string;
  priority?: boolean;
  showOutfits?: boolean;
  /** Kept for call-site compatibility; outfit portrait does not change by pose. */
  pose?: AraPose;
  /** Soft idle bob / one-shot react bounce / celebration dance */
  motion?: "idle" | "react" | "dance" | "none";
  /** Live shop state from Shop/Outfit pages so equip updates instantly. */
  shop?: ShopState | null;
};

export default function AraAvatar({
  size,
  className = "",
  priority = false,
  motion = "idle",
  shop = null,
}: Props) {
  const { prefs } = useAraPrefs();
  const motionEnabled = prefs.motion;
  const gender = prefs.gender;
  const look = useAraLook();
  // Local override only while a parent passes live shop (equip preview).
  const [shopLookSrc, setShopLookSrc] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!shop) {
      setShopLookSrc(null);
      return;
    }
    setShopLookSrc(syncLookFromShop(shop, gender));
  }, [shop, gender]);

  const preferred =
    shopLookSrc || look.lookSrc || getActiveLookSrc() || defaultLookSrc(gender);
  // If cached look is the other Ara's OG, snap to this gender's default.
  const genderedPreferred =
    gender === "boy" && preferred.endsWith("look-floral-cottage.png")
      ? defaultLookSrc("boy")
      : gender === "girl" && preferred.endsWith("look-floral-cottage-boy.png")
        ? defaultLookSrc("girl")
        : preferred;
  const [src, setSrc] = useState(genderedPreferred);
  const ready = look.ready || Boolean(shopLookSrc);

  useLayoutEffect(() => {
    setSrc(genderedPreferred);
  }, [genderedPreferred]);

  const motionClass =
    motionEnabled && motion === "idle"
      ? "ara-idle"
      : motionEnabled && motion === "react"
        ? "ara-react"
        : motionEnabled && motion === "dance"
          ? "ara-dance"
          : "";

  return (
    <div
      className={`relative inline-block shrink-0 overflow-visible bg-transparent [background:transparent] ${motionClass} ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "transparent",
        visibility: ready ? "visible" : "hidden",
      }}
    >
      <Image
        src={src}
        alt="Ara, your study companion"
        fill
        priority={priority}
        sizes={`${size}px`}
        className="relative z-[1] bg-transparent object-contain"
        style={{ backgroundColor: "transparent" }}
        unoptimized
        onError={() => {
          const fallback = defaultLookSrc(gender);
          if (src !== fallback) setSrc(fallback);
          else if (src !== DEFAULT_LOOK_SRC) setSrc(DEFAULT_LOOK_SRC);
        }}
      />
    </div>
  );
}
