/** Shared equipped look — every Ara on the site reads/writes this. */

const STORAGE_KEY = "alara-equipped-look-src";
const CHANGE_EVENT = "alara-outfit-changed";

/** OG Ara = floral cottage dress (PNG). Keep in sync with backend classic art. */
export const DEFAULT_LOOK_SRC = "/outfits/looks/look-floral-cottage.png";
export const OG_OUTFIT_ID = "look-lavender-soft";

type ShopLike = {
  equipped: Record<string, string | null>;
  items: { id: string; slot: string; fullImage: string | null }[];
};

export function readCachedLookSrc(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || !raw.startsWith("/outfits/")) return null;
    // Migrate older default looks to OG floral cottage PNG.
    if (
      raw.includes("look-lavender-soft.webp") ||
      raw.includes("look-pastel-beret") ||
      raw.includes("look-floral-dress")
    ) {
      return DEFAULT_LOOK_SRC;
    }
    return raw;
  } catch {
    return null;
  }
}

export function writeCachedLookSrc(src: string | null) {
  if (typeof window === "undefined") return;
  const next =
    src && src.startsWith("/outfits/") ? src : DEFAULT_LOOK_SRC;
  const prev = readCachedLookSrc() || DEFAULT_LOOK_SRC;
  try {
    if (!src || !src.startsWith("/outfits/")) {
      window.localStorage.setItem(STORAGE_KEY, DEFAULT_LOOK_SRC);
    } else {
      window.localStorage.setItem(STORAGE_KEY, src);
    }
  } catch {
    // Ignore quota / private mode.
  }
  if (prev !== next) {
    notifyLookChanged(next);
  }
}

export function clearCachedLookSrc() {
  writeCachedLookSrc(null);
}

export function lookSrcFromShop(shop: ShopLike): string {
  const byId = Object.fromEntries(shop.items.map((item) => [item.id, item]));
  const outfitId = shop.equipped.outfit;
  const outfit = outfitId ? byId[outfitId] : null;
  if (outfit?.fullImage) return `/outfits/${outfit.fullImage}`;

  for (const id of Object.values(shop.equipped)) {
    if (!id) continue;
    const item = byId[id];
    if (item?.fullImage) return `/outfits/${item.fullImage}`;
  }
  return DEFAULT_LOOK_SRC;
}

/** Persist shop equip state and broadcast so every Ara avatar updates. */
export function syncLookFromShop(shop: ShopLike): string {
  const src = lookSrcFromShop(shop);
  writeCachedLookSrc(src);
  return src;
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
    listener(detail?.src || readCachedLookSrc() || DEFAULT_LOOK_SRC);
  };
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
