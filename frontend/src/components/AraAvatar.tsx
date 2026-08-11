"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAraPrefs } from "@/components/AraPrefsProvider";
import { fetchShopState, type ShopItem, type ShopState } from "@/lib/api";
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
  const [srcIndex, setSrcIndex] = useState(0);
  const [hatOverlayFallback, setHatOverlayFallback] = useState(false);

  useEffect(() => {
    if (!showOutfits) return;

    if (shop) {
      setEquippedIds(
        Object.values(shop.equipped).filter((id): id is string => Boolean(id))
      );
      setItemsById(
        Object.fromEntries(shop.items.map((item) => [item.id, item]))
      );
      return;
    }

    let cancelled = false;
    fetchShopState()
      .then((data) => {
        if (cancelled) return;
        setEquippedIds(
          Object.values(data.equipped).filter((id): id is string => Boolean(id))
        );
        setItemsById(
          Object.fromEntries(data.items.map((item) => [item.id, item]))
        );
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

  const topItem = equippedItems.find(
    (item) => item?.slot === "top" && item.fullImage
  );
  const pantsItem = equippedItems.find(
    (item) => item?.slot === "pants" && item.fullImage
  );
  const headItem = equippedItems.find(
    (item) => item?.slot === "head" && item.fullImage
  );
  const hairItem = equippedItems.find(
    (item) => item?.slot === "hair" && item.fullImage
  );

  const topId = topItem?.id;
  const pantsId = pantsItem?.id;
  const hatId = headItem?.id;
  const hairId = hairItem?.id;
  const hasBakedClothes = Boolean(topItem || pantsItem || headItem || hairItem);

  // Outfit portraits are wave-only. Prefer clothes over pose art everywhere
  // (including Teach Ara sit poses) so equipped outfits show sitewide.
  const useOutfitBody = hasBakedClothes;

  const srcCandidates: string[] = [];
  const bakedIds = new Set<string>();

  if (useOutfitBody) {
    // Custom updos mix with tops/pants via prebaked hair__top__pants portraits.
    // Hats stay classic-pigtails-only (blocked separately).
    const isCustomHair = Boolean(hairId && hairId !== "hair-pigtails");

    if (isCustomHair && hairId) {
      if (topId && pantsId) {
        srcCandidates.push(
          `/outfits/combos/${hairId}__${topId}__${pantsId}.png`
        );
      }
      if (topId && !pantsId) {
        srcCandidates.push(`/outfits/combos/${hairId}__${topId}.png`);
      }
      if (pantsId && !topId) {
        srcCandidates.push(`/outfits/combos/${hairId}__${pantsId}.png`);
      }
      // Fallbacks when combo art is missing (e.g. Vercel size-limited deploys).
      if (topItem?.fullImage) {
        srcCandidates.push(`/outfits/${topItem.fullImage}`);
      }
      if (pantsItem?.fullImage) {
        srcCandidates.push(`/outfits/${pantsItem.fullImage}`);
      }
      if (hairItem?.fullImage) {
        srcCandidates.push(`/outfits/${hairItem.fullImage}`);
      }
    } else {
      // Classic pigtails (or no hair item): tops + pants + hats all mix.
      if (topId && pantsId && hatId) {
        srcCandidates.push(
          `/outfits/combos/${topId}__${pantsId}__${hatId}.png`
        );
      }
      if (pantsId && hatId && !topId) {
        srcCandidates.push(`/outfits/combos/${pantsId}__${hatId}.png`);
      }
      if (topId && pantsId) {
        srcCandidates.push(`/outfits/combos/${topId}__${pantsId}.png`);
      }
      if (topId && hatId && !pantsId) {
        srcCandidates.push(`/outfits/combos/${topId}__${hatId}.png`);
      }
      // Always keep single-piece portraits as fallbacks after combos.
      if (topItem?.fullImage) {
        srcCandidates.push(`/outfits/${topItem.fullImage}`);
      }
      if (pantsItem?.fullImage) {
        srcCandidates.push(`/outfits/${pantsItem.fullImage}`);
      }
      if (headItem?.fullImage) {
        srcCandidates.push(`/outfits/${headItem.fullImage}`);
      }
      if (hairItem?.fullImage) {
        srcCandidates.push(`/outfits/${hairItem.fullImage}`);
      }
    }
  }

  srcCandidates.push(ARA_POSE_SRC[pose]);

  const candidateKey = srcCandidates.join("|");
  useEffect(() => {
    setSrcIndex(0);
    setHatOverlayFallback(false);
  }, [candidateKey]);

  const motionClass =
    motionEnabled && motion === "idle"
      ? "ara-idle"
      : motionEnabled && motion === "react"
        ? "ara-react"
        : "";

  const safeIndex = Math.min(srcIndex, srcCandidates.length - 1);
  const baseSrc = srcCandidates[safeIndex] ?? ARA_POSE_SRC[pose];
  const showingOutfitPortrait =
    useOutfitBody && baseSrc !== ARA_POSE_SRC[pose];

  if (showingOutfitPortrait) {
    const chosen = baseSrc;
    const isComboPath = chosen.includes("/outfits/combos/");
    const isSinglePath = chosen.includes("/outfits/") && !isComboPath;

    if (isComboPath) {
      if (hairId && chosen.includes(hairId)) bakedIds.add(hairId);
      if (topId && chosen.includes(topId)) bakedIds.add(topId);
      if (pantsId && chosen.includes(pantsId)) bakedIds.add(pantsId);
      if (hatId && chosen.includes(hatId)) bakedIds.add(hatId);
    } else if (isSinglePath) {
      if (topItem?.fullImage && chosen.endsWith(`/${topItem.fullImage}`)) {
        bakedIds.add(topId!);
      }
      if (pantsItem?.fullImage && chosen.endsWith(`/${pantsItem.fullImage}`)) {
        bakedIds.add(pantsId!);
      }
      if (headItem?.fullImage && chosen.endsWith(`/${headItem.fullImage}`)) {
        bakedIds.add(hatId!);
      }
      if (hairItem?.fullImage && chosen.endsWith(`/${hairItem.fullImage}`)) {
        bakedIds.add(hairId!);
      }
    }
  }

  // Hats only layer with classic pigtails — never on custom updos.
  const wearingCustomHair = Boolean(hairId && hairId !== "hair-pigtails");
  const showHatOverlay =
    Boolean(hatId && headItem && !bakedIds.has(hatId)) &&
    showingOutfitPortrait &&
    !wearingCustomHair;

  const stickerItems = showOutfits
    ? equippedIds
        .map((id) => {
          const item = itemsById[id];
          if (!item || bakedIds.has(id)) return null;
          // Full-body hat / hair portraits are handled by bake / hat overlay.
          if (item.fullImage && (item.slot === "head" || item.slot === "hair")) {
            return null;
          }
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
      style={{ width: size, height: size, backgroundColor: "transparent" }}
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
        unoptimized
        onError={() => {
          setSrcIndex((i) => (i + 1 < srcCandidates.length ? i + 1 : i));
        }}
      />

      {showHatOverlay && headItem && hatId && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[4] select-none"
        >
          <Image
            src={
              hatOverlayFallback
                ? `/overlays/${hatId}.png`
                : `/overlays/onhead/${hatId}.png`
            }
            alt=""
            fill
            sizes={`${size}px`}
            className="object-contain"
            unoptimized
            onError={() => setHatOverlayFallback(true)}
          />
        </div>
      )}

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
