"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useState } from "react";
import { useAraPrefs } from "@/components/AraPrefsProvider";
import { fetchShopState, type ShopItem, type ShopState } from "@/lib/api";
import {
  lookSrcFromShop,
  readCachedLookSrc,
  writeCachedLookSrc,
} from "@/lib/araOutfitCache";
import { ARA_POSE_SRC, type AraPose } from "@/lib/araPoses";

type OverlayPos = {
  top: string;
  left: string;
  scale: number;
  rotate?: string;
  /** Render behind Ara (wings / backpack straps feel) */
  behind?: boolean;
  zIndex?: number;
};

// Tuned so stickers sit on her face/head/body — not floating product shots.
const OUTFIT_POSITIONS: Record<string, OverlayPos> = {
  partyhat: { top: "10%", left: "52%", scale: 0.3, rotate: "-8deg", zIndex: 5 },
  bow: { top: "16%", left: "72%", scale: 0.2, rotate: "-12deg", zIndex: 5 },
  sunglasses: { top: "34%", left: "49%", scale: 0.34, zIndex: 6 },
  scarf: { top: "46%", left: "50%", scale: 0.38, zIndex: 4 },
  backpack: { top: "54%", left: "80%", scale: 0.3, behind: true, zIndex: 0 },
  sparkles: { top: "16%", left: "84%", scale: 0.24, zIndex: 7 },
  "acc-cat-headphones": {
    top: "22%",
    left: "50%",
    scale: 0.52,
    zIndex: 5,
  },
  "acc-pink-glasses": { top: "34%", left: "49%", scale: 0.38, zIndex: 6 },
  "acc-heart-choker": { top: "43%", left: "49%", scale: 0.26, zIndex: 4 },
  "acc-fairy-wings": {
    top: "50%",
    left: "50%",
    scale: 0.88,
    behind: true,
    zIndex: 0,
  },
  "acc-hearts-float": { top: "18%", left: "78%", scale: 0.28, zIndex: 7 },
};

const DEFAULT_SLOT_POSITIONS: Record<string, OverlayPos> = {
  head: { top: "18%", left: "50%", scale: 0.48, zIndex: 5 },
  face: { top: "34%", left: "49%", scale: 0.34, zIndex: 6 },
  neck: { top: "44%", left: "49%", scale: 0.28, zIndex: 4 },
  back: { top: "52%", left: "80%", scale: 0.32, behind: true, zIndex: 0 },
  effect: { top: "16%", left: "84%", scale: 0.24, zIndex: 7 },
};

type Props = {
  size: number;
  className?: string;
  priority?: boolean;
  showOutfits?: boolean;
  // Expression / body pose. Baked outfit art is wave-only — when clothes are
  // equipped, that portrait is used so outfits show on every page.
  pose?: AraPose;
  /** Soft idle bob / one-shot react bounce */
  motion?: "idle" | "react" | "none";
  // Live shop state from a parent (Shop page) so equip updates Ara instantly.
  shop?: ShopState | null;
};

function StickerOverlay({
  id,
  item,
  size,
  position,
  src,
}: {
  id: string;
  item: ShopItem;
  size: number;
  position: OverlayPos;
  src?: string;
}) {
  const boxSize = size * position.scale;
  const rotate = position.rotate ? `rotate(${position.rotate})` : "";
  const z = position.zIndex ?? (position.behind ? 0 : 3);
  const imageSrc = src ?? (item.image ? `/shop-items/${item.image}` : null);

  if (imageSrc) {
    return (
      <div
        key={id}
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{
          top: position.top,
          left: position.left,
          width: boxSize,
          height: boxSize,
          zIndex: z,
          transform: `translate(-50%, -50%) ${rotate}`,
        }}
      >
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes={`${Math.ceil(boxSize)}px`}
          className="object-contain drop-shadow-[0_1px_2px_rgba(28,25,23,0.2)]"
          unoptimized
        />
      </div>
    );
  }

  if (!item.emoji) return null;
  return (
    <span
      key={id}
      aria-hidden
      className="pointer-events-none absolute select-none"
      style={{
        top: position.top,
        left: position.left,
        fontSize: boxSize,
        lineHeight: 1,
        zIndex: z,
        transform: `translate(-50%, -50%) ${rotate}`,
      }}
    >
      {item.emoji}
    </span>
  );
}

function applyShopState(data: ShopState) {
  const equippedIds = Object.values(data.equipped).filter(
    (id): id is string => Boolean(id)
  );
  const itemsById = Object.fromEntries(
    data.items.map((item) => [item.id, item])
  );
  writeCachedLookSrc(lookSrcFromShop(data));
  return { equippedIds, itemsById };
}

export default function AraAvatar({
  size,
  className = "",
  priority = false,
  showOutfits = true,
  pose = "wave",
  motion = "idle",
  shop = null,
}: Props) {
  const { prefs } = useAraPrefs();
  const motionEnabled = prefs.motion;
  const [equippedIds, setEquippedIds] = useState<string[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, ShopItem>>({});
  const [cachedLookSrc, setCachedLookSrc] = useState<string | null>(null);
  const [outfitReady, setOutfitReady] = useState(!showOutfits);
  const [srcIndex, setSrcIndex] = useState(0);

  // Apply last-worn look before paint so home doesn't flash default purple Ara.
  useLayoutEffect(() => {
    if (!showOutfits) {
      setOutfitReady(true);
      return;
    }
    if (shop) {
      const applied = applyShopState(shop);
      setEquippedIds(applied.equippedIds);
      setItemsById(applied.itemsById);
      setCachedLookSrc(lookSrcFromShop(shop));
      setOutfitReady(true);
      return;
    }
    const cached = readCachedLookSrc();
    if (cached) setCachedLookSrc(cached);
    setOutfitReady(true);
  }, [showOutfits, shop]);

  useEffect(() => {
    if (!showOutfits) return;
    if (shop) return;

    let cancelled = false;
    fetchShopState()
      .then((data) => {
        if (cancelled) return;
        const applied = applyShopState(data);
        setEquippedIds(applied.equippedIds);
        setItemsById(applied.itemsById);
        setCachedLookSrc(lookSrcFromShop(data));
      })
      .catch(() => {
        // Not worth showing an error just for the dress-up overlays.
      });
    return () => {
      cancelled = true;
    };
  }, [showOutfits, shop]);

  const equippedItems = showOutfits
    ? equippedIds.map((id) => itemsById[id]).filter(Boolean)
    : [];

  // One complete look at a time (no mix-and-match combos).
  const lookItem =
    equippedItems.find((item) => item?.slot === "outfit" && item.fullImage) ??
    equippedItems.find((item) => item?.slot === "top" && item.fullImage) ??
    equippedItems.find((item) => item?.slot === "hair" && item.fullImage) ??
    equippedItems.find((item) => item?.slot === "pants" && item.fullImage) ??
    equippedItems.find((item) => item?.slot === "head" && item.fullImage) ??
    null;

  const liveLookSrc = lookItem?.fullImage
    ? `/outfits/${lookItem.fullImage}`
    : null;

  const srcCandidates: string[] = [];
  if (liveLookSrc) {
    srcCandidates.push(liveLookSrc);
  } else if (cachedLookSrc && showOutfits) {
    srcCandidates.push(cachedLookSrc);
  }
  srcCandidates.push(ARA_POSE_SRC[pose]);

  const candidateKey = srcCandidates.join("|");
  useEffect(() => {
    setSrcIndex(0);
  }, [candidateKey]);

  const motionClass =
    motionEnabled && motion === "idle"
      ? "ara-idle"
      : motionEnabled && motion === "react"
        ? "ara-react"
        : "";

  const safeIndex = Math.min(srcIndex, srcCandidates.length - 1);
  const baseSrc = srcCandidates[safeIndex] ?? ARA_POSE_SRC[pose];

  const stickerItems = showOutfits
    ? equippedIds
        .map((id) => {
          const item = itemsById[id];
          if (!item || item.id === lookItem?.id) return null;
          // Complete looks already replace the whole portrait.
          if (item.fullImage) return null;
          const position =
            OUTFIT_POSITIONS[id] ?? DEFAULT_SLOT_POSITIONS[item.slot ?? ""];
          if (!position) return null;
          if (!item.image && !item.emoji) return null;
          return { id, item, position };
        })
        .filter(Boolean) as {
        id: string;
        item: ShopItem;
        position: OverlayPos;
      }[]
    : [];

  const behind = stickerItems.filter((s) => s.position.behind);
  const front = stickerItems.filter((s) => !s.position.behind);

  return (
    <div
      className={`relative inline-block shrink-0 overflow-visible bg-transparent [background:transparent] ${motionClass} ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "transparent",
        visibility: outfitReady ? "visible" : "hidden",
      }}
    >
      {behind.map(({ id, item, position }) => (
        <StickerOverlay
          key={id}
          id={id}
          item={item}
          size={size}
          position={position}
        />
      ))}

      <Image
        src={baseSrc}
        alt="Ara, your study companion"
        fill
        priority={priority}
        sizes={`${size}px`}
        className="relative z-[1] bg-transparent object-contain"
        style={{ backgroundColor: "transparent" }}
        onError={() => {
          setSrcIndex((i) => (i + 1 < srcCandidates.length ? i + 1 : i));
        }}
      />

      {front.map(({ id, item, position }) => (
        <StickerOverlay
          key={id}
          id={id}
          item={item}
          size={size}
          position={position}
        />
      ))}
    </div>
  );
}
