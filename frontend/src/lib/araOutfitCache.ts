/** Last equipped complete-look portrait — avoids flashing default Ara on load. */

const STORAGE_KEY = "alara-equipped-look-src";

/** OG Ara mascot (cute beret dress girl). Keep in sync with backend CLASSIC art. */
export const DEFAULT_LOOK_SRC = "/outfits/looks/look-pastel-beret.jpg";
export const OG_OUTFIT_ID = "look-lavender-soft";

export function readCachedLookSrc(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || !raw.startsWith("/outfits/")) return null;
    // Migrate old classic lavender cache to the exact pastel Ara look.
    if (raw.includes("look-lavender-soft")) {
      return DEFAULT_LOOK_SRC;
    }
    // Looks were compressed from PNG → WebP; rewrite old cache entries only.
    if (raw.includes("/outfits/looks/") && raw.endsWith(".png")) {
      const asWebp = raw.replace(/\.png$/, ".webp");
      if (asWebp.includes("look-lavender-soft")) return DEFAULT_LOOK_SRC;
      return asWebp;
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

export function clearCachedLookSrc() {
  writeCachedLookSrc(null);
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
  // New accounts / empty equip → exact pastel Ara look.
  return DEFAULT_LOOK_SRC;
}
