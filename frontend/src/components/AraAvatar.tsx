"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchShopState, type ShopItem, type ShopState } from "@/lib/api";
import { ARA_POSE_SRC, type AraPose } from "@/lib/araPoses";

// Where emoji / small sticker items sit on Ara, as a percentage of her box.
const OUTFIT_POSITIONS: Record<
  string,
  { top: string; left: string; scale: number; rotate?: string }
> = {
  partyhat: { top: "2%", left: "50%", scale: 0.26 },
  bow: { top: "8%", left: "72%", scale: 0.18, rotate: "-10deg" },
  sunglasses: { top: "34%", left: "49%", scale: 0.24 },
  scarf: { top: "47%", left: "49%", scale: 0.22 },
  backpack: { top: "50%", left: "85%", scale: 0.24 },
  sparkles: { top: "15%", left: "88%", scale: 0.18 },
};

const DEFAULT_SLOT_POSITIONS: Record<
  string,
  { top: string; left: string; scale: number; rotate?: string }
> = {
  head: { top: "18%", left: "50%", scale: 0.48 },
  face: { top: "34%", left: "49%", scale: 0.24 },
  neck: { top: "47%", left: "49%", scale: 0.22 },
  back: { top: "50%", left: "85%", scale: 0.24 },
  effect: { top: "15%", left: "88%", scale: 0.18 },
};

type Props = {
  size: number;
  className?: string;
  priority?: boolean;
  showOutfits?: boolean;
  // Expression / body pose. Outfit portraits only exist for the wave pose,
  // so non-wave poses skip full-body outfit swaps.
  pose?: AraPose;
  // Live shop state from a parent (Shop page) so equip updates Ara instantly.
  shop?: ShopState | null;
};

export default function AraAvatar({
  size,
  className = "",
  priority = false,
  showOutfits = true,
  pose = "wave",
  shop = null,
}: Props) {
  const [equippedIds, setEquippedIds] = useState<string[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, ShopItem>>({});

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
  const headItem = equippedItems.find(
    (item) => item?.slot === "head" && item.fullImage
  );

  // Outfit portrait selection (wave pose only — baked outfit art matches wave).
  let baseSrc = ARA_POSE_SRC[pose];
  const bakedIds = new Set<string>();

  if (pose === "wave") {
    if (topItem?.fullImage && headItem?.fullImage) {
      baseSrc = `/outfits/combos/${topItem.id}__${headItem.id}.png`;
      bakedIds.add(topItem.id);
      bakedIds.add(headItem.id);
    } else if (topItem?.fullImage) {
      baseSrc = `/outfits/${topItem.fullImage}`;
      bakedIds.add(topItem.id);
    } else if (headItem?.fullImage) {
      baseSrc = `/outfits/${headItem.fullImage}`;
      bakedIds.add(headItem.id);
    }
  } else {
    // Stickers on other poses would sit wrong — skip full-image outfit ids.
    if (topItem) bakedIds.add(topItem.id);
    if (headItem) bakedIds.add(headItem.id);
  }

  return (
    <div
      className={`relative inline-block shrink-0 overflow-visible bg-transparent ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={baseSrc}
        alt="Ara, your study companion"
        fill
        priority={priority}
        sizes={`${size}px`}
        className="object-contain"
        unoptimized
      />

      {showOutfits &&
        pose === "wave" &&
        equippedIds.map((id) => {
          const item = itemsById[id];
          if (!item) return null;
          if (bakedIds.has(id)) return null;

          const position =
            OUTFIT_POSITIONS[id] ?? DEFAULT_SLOT_POSITIONS[item.slot ?? ""];
          if (!position) return null;
          const boxSize = size * position.scale;
          const rotate = position.rotate ? `rotate(${position.rotate})` : "";

          // Skip other fullImage items — they're portrait swaps, not stickers.
          if (item.fullImage) return null;

          if (item.image) {
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
                  transform: `translate(-50%, -50%) ${rotate}`,
                }}
              >
                <Image
                  src={`/shop-items/${item.image}`}
                  alt=""
                  fill
                  sizes={`${boxSize}px`}
                  className="object-contain"
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
                transform: `translate(-50%, -50%) ${rotate}`,
              }}
            >
              {item.emoji}
            </span>
          );
        })}
    </div>
  );
}
