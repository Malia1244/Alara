/** Last equipped complete-look portrait — avoids flashing default Ara on load. */

const STORAGE_KEY = "alara-equipped-look-src";

export function readCachedLookSrc(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || !raw.startsWith("/outfits/")) return null;
    // Looks were compressed from PNG → WebP; rewrite old cache entries.
    if (raw.includes("/outfits/looks/") && raw.endsWith(".png")) {
      return raw.replace(/\.png$/, ".webp");
    }
    return raw;
  } catch {
    return null;
  }
}

export function writeCachedLookSrc(src: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!src || !src.startsWith("/outfits/")) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, src);
  } catch {
    // Ignore quota / private mode.
  }
}

export function lookSrcFromShop(shop: {
  equipped: Record<string, string | null>;
  items: { id: string; slot: string; fullImage: string | null }[];
}): string | null {
  const byId = Object.fromEntries(shop.items.map((item) => [item.id, item]));
  const outfitId = shop.equipped.outfit;
  const outfit = outfitId ? byId[outfitId] : null;
  if (outfit?.fullImage) return `/outfits/${outfit.fullImage}`;

  for (const id of Object.values(shop.equipped)) {
    if (!id) continue;
    const item = byId[id];
    if (item?.fullImage) return `/outfits/${item.fullImage}`;
  }
  return null;
}
