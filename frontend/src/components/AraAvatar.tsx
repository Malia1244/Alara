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
import type { AraGender } from "@/lib/araPrefs";
import {
  araPoseSrc,
  isOgLookSrc,
  type AraPose,
} from "@/lib/araPoses";

type Props = {
  size: number;
  className?: string;
  priority?: boolean;
  showOutfits?: boolean;
  pose?: AraPose;
  /** Soft idle bob / one-shot react bounce / celebration dance */
  motion?: "idle" | "react" | "dance" | "none";
  /** Live shop state from Shop/Outfit pages so equip updates instantly. */
  shop?: ShopState | null;
  /** Force a specific portrait (e.g. login girl + boy pair). */
  lookSrc?: string | null;
  /** Force gender for pose sheets / fallbacks (ignores saved prefs). */
  gender?: AraGender;
};

export default function AraAvatar({
  size,
  className = "",
  priority = false,
  pose = "wave",
  motion = "idle",
  shop = null,
  lookSrc = null,
  gender: genderOverride,
}: Props) {
  const { prefs } = useAraPrefs();
  const motionEnabled = prefs.motion;
  const gender = genderOverride ?? prefs.gender;
  const look = useAraLook();
  const [shopLookSrc, setShopLookSrc] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (lookSrc || !shop) {
      setShopLookSrc(null);
      return;
    }
    setShopLookSrc(syncLookFromShop(shop, gender));
  }, [shop, gender, lookSrc]);

  const activeLook =
    lookSrc ||
    shopLookSrc ||
    look.lookSrc ||
    getActiveLookSrc() ||
    defaultLookSrc(gender);

  const isBoyAsset = (src: string) =>
    src.includes("/ara/poses/boy/") ||
    /look-boy-|cottage-boy|zip-og/i.test(src);

  const lookMatchesGender =
    gender === "boy" ? isBoyAsset(activeLook) : !isBoyAsset(activeLook);

  // Custom shop outfits stay as full portraits; OG / wrong-gender cache uses pose sheets.
  const usePoseSheet =
    !lookSrc && (isOgLookSrc(activeLook) || !lookMatchesGender);
  const preferred = lookSrc
    ? lookSrc
    : usePoseSheet
      ? araPoseSrc(gender, pose)
      : activeLook;

  const [src, setSrc] = useState(preferred);
  const ready = Boolean(lookSrc) || look.ready || Boolean(shopLookSrc);

  useLayoutEffect(() => {
    setSrc(preferred);
  }, [preferred]);

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
          const poseFallback = araPoseSrc(gender, "wave");
          const og = defaultLookSrc(gender);
          // Never snap a boy Ara selection back to the girl OG.
          if (src !== poseFallback) setSrc(poseFallback);
          else if (src !== og) setSrc(og);
          else if (gender === "girl" && src !== DEFAULT_LOOK_SRC) {
            setSrc(DEFAULT_LOOK_SRC);
          }
        }}
      />
    </div>
  );
}
