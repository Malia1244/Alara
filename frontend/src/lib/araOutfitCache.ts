/** Shared equipped look — one in-memory source of truth for the whole app. */

import type { AraGender } from "@/lib/araPrefs";

const STORAGE_KEY = "alara-equipped-look-src";
const CHANGE_EVENT = "alara-outfit-changed";

/** OG Ara = floral cottage dress (PNG). Keep in sync with backend classic art. */
export const GIRL_DEFAULT_LOOK_SRC = "/outfits/looks/look-floral-cottage.png";
export const BOY_DEFAULT_LOOK_SRC = "/outfits/looks/look-boy-zip-og.png";
export const DEFAULT_LOOK_SRC = GIRL_DEFAULT_LOOK_SRC;
export const OG_OUTFIT_ID = "look-lavender-soft";
export const OG_BOY_OUTFIT_ID = "look-lavender-soft-boy";

export function defaultLookSrc(gender: AraGender = "girl"): string {
  return gender === "boy" ? BOY_DEFAULT_LOOK_SRC : GIRL_DEFAULT_LOOK_SRC;
}

export function defaultOutfitId(gender: AraGender = "girl"): string {
  return gender === "boy" ? OG_BOY_OUTFIT_ID : OG_OUTFIT_ID;
}

type ShopLike = {
  equipped: Record<string, string | null>;
  items: {
    id: string;
    slot: string;
    fullImage: string | null;
    gender?: string | null;
  }[];
};

function itemMatchesGender(
  gender: AraGender | undefined,
  itemGender: string | null | undefined
): boolean {
  if (!gender) return true;
  const g = itemGender || "girl";
  return g === "any" || g === gender;
}

/** Survives remounts; avoids SSR default → cache flash. */
let memoryLookSrc: string | null = null;

function migrateLookSrc(raw: string): string {
  if (
    raw.includes("look-lavender-soft.webp") ||
    raw.includes("look-pastel-beret") ||
    raw.includes("look-floral-dress")
  ) {
    return DEFAULT_LOOK_SRC;
  }
  // All shop looks are transparent PNGs now.
  if (raw.includes("/outfits/looks/") && /\.jpg$/i.test(raw)) {
    return raw.replace(/\.jpg$/i, ".png");
  }
  return raw;
}

export function readCachedLookSrc(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || !raw.startsWith("/outfits/")) return null;
    return migrateLookSrc(raw);
  } catch {
    return null;
  }
}

/** Current look for every Ara avatar. Memory first, then localStorage, then OG. */
export function getActiveLookSrc(): string {
  if (memoryLookSrc && memoryLookSrc.startsWith("/outfits/")) {
    memoryLookSrc = migrateLookSrc(memoryLookSrc);
    return memoryLookSrc;
  }
  const cached = readCachedLookSrc();
  memoryLookSrc = cached || DEFAULT_LOOK_SRC;
  return memoryLookSrc;
}

export function writeCachedLookSrc(src: string | null) {
  if (typeof window === "undefined") return;
  const next =
    src && src.startsWith("/outfits/")
      ? migrateLookSrc(src)
      : DEFAULT_LOOK_SRC;
  const prev = getActiveLookSrc();
  memoryLookSrc = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore quota / private mode.
  }
  if (prev !== next) {
    notifyLookChanged(next);
  }
}

export function clearCachedLookSrc() {
  memoryLookSrc = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notifyLookChanged(DEFAULT_LOOK_SRC);
}

export function lookSrcFromShop(
  shop: ShopLike,
  gender: AraGender = "girl"
): string {
  const byId = Object.fromEntries(shop.items.map((item) => [item.id, item]));
  const outfitId = shop.equipped.outfit;
  const outfit = outfitId ? byId[outfitId] : null;
  if (outfit?.fullImage && itemMatchesGender(gender, outfit.gender)) {
    return migrateLookSrc(`/outfits/${outfit.fullImage}`);
  }
  // Wrong-gender outfit equipped — fall back to that Ara's default look.
  if (outfit && !itemMatchesGender(gender, outfit.gender)) {
    return defaultLookSrc(gender);
  }
  // Equipped id present but catalog row missing — keep current look, don't snap to OG.
  if (outfitId) return getActiveLookSrc();

  for (const id of Object.values(shop.equipped)) {
    if (!id) continue;
    const item = byId[id];
    if (item?.fullImage && itemMatchesGender(gender, item.gender)) {
      return migrateLookSrc(`/outfits/${item.fullImage}`);
    }
  }
  return defaultLookSrc(gender);
}

/** Persist shop equip state and broadcast so every Ara avatar updates. */
export function syncLookFromShop(
  shop: ShopLike,
  gender: AraGender = "girl"
): string {
  const src = lookSrcFromShop(shop, gender);
  writeCachedLookSrc(src);
  return getActiveLookSrc();
}

function notifyLookChanged(src: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, { detail: { src } })
  );
}

/** Subscribe to outfit changes (equip/unequip/shop sync). */
export function subscribeLookSrc(
  listener: (src: string) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ src: string }>).detail;
    listener(detail?.src || getActiveLookSrc());
  };
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
