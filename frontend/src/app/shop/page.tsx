"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { CutFlower } from "@/components/CutFlowers";
import NoticeBanner from "@/components/NoticeBanner";
import { useAraPrefs } from "@/components/AraPrefsProvider";
import {
  equipShopItem,
  fetchGiftCards,
  fetchShopState,
  purchaseShopItem,
  redeemGiftCard,
  unequipShopSlot,
  apiUnreachableMessage,
  type GiftCardCatalog,
  type ShopItem,
  type ShopState,
} from "@/lib/api";

const FREE_STARTER_IDS = new Set([
  "look-lavender-soft",
  "look-lavender-soft-boy",
]);

function outfitPreviewSrc(item: ShopItem): string | null {
  if (item.fullImage) return `/outfits/${item.fullImage}`;
  if (item.image) return `/shop-items/${item.image}`;
  return null;
}

export default function ShopPage() {
  const { prefs } = useAraPrefs();
  const [shop, setShop] = useState<ShopState | null>(null);
  const [giftCards, setGiftCards] = useState<GiftCardCatalog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const data = await fetchShopState();
      setShop(data);
      try {
        setGiftCards(await fetchGiftCards());
      } catch (err) {
        // Shop outfits still work if gift-card migration isn't run yet.
        setGiftCards(null);
        if (err instanceof Error && /gift cards aren't set up/i.test(err.message)) {
          setError(err.message);
        }
      }
    } catch {
      setError(apiUnreachableMessage());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    load();
  }, []);

  async function handleBuy(itemId: string) {
    setBusyId(itemId);
    setError(null);
    try {
      const updated = await purchaseShopItem(itemId);
      setShop(updated);
      if (giftCards) {
        setGiftCards({ ...giftCards, points: updated.points });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't buy that item.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRedeemGiftCard(offerId: string, name: string, points: number) {
    const ok = window.confirm(
      `Spend ${points} points for a ${name}?\n\nWe'll send it to your account email after Malia fulfills the claim.`
    );
    if (!ok) return;
    setBusyId(offerId);
    setError(null);
    try {
      const updated = await redeemGiftCard(offerId);
      setGiftCards(updated);
      setShop((prev) => (prev ? { ...prev, points: updated.points } : prev));
      setNotice(
        `Claimed! ${name} is pending — watch your email for the code.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't redeem that gift card."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleEquip(itemId: string) {
    setBusyId(itemId);
    setError(null);
    try {
      const updated = await equipShopItem(itemId);
      setShop(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't equip that item.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnequip(slot: string, itemId: string) {
    setBusyId(itemId);
    setError(null);
    try {
      const updated = await unequipShopSlot(slot);
      setShop(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unequip that item.");
    } finally {
      setBusyId(null);
    }
  }

  const outfits = (shop?.items ?? [])
    .filter((item) => item.slot === "outfit")
    .filter((item) => {
      const g = item.gender || "girl";
      return g === "any" || g === prefs.gender;
    })
    .slice()
    .sort((a, b) => {
      // OG Ara (free starter) always first.
      if (FREE_STARTER_IDS.has(a.id) && !FREE_STARTER_IDS.has(b.id)) return -1;
      if (!FREE_STARTER_IDS.has(a.id) && FREE_STARTER_IDS.has(b.id)) return 1;
      return a.price - b.price || a.name.localeCompare(b.name);
    });
  const themes = (shop?.items ?? []).filter((item) => item.slot === "theme");

  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
      <NoticeBanner message={notice} onClose={() => setNotice(null)} />
      <main className="flex w-full max-w-4xl flex-col gap-7">
        <header className="animate-rise relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Outfit studio
            </p>
            <h1 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-tight text-brand-ink sm:text-4xl">
              Shop
              <CutFlower kind="swirlPink" size={36} rotate={10} />
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Buy looks for Ara and unlock themes — plus brand-new gift cards
              you can redeem with points.
            </p>
          </div>

          <div className="bloom-card relative flex items-center gap-2 self-start rounded-full px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Balance
            </span>
            <span className="text-sm font-semibold text-brand-ink">
              {isLoading ? "…" : shop?.points ?? giftCards?.points ?? 0} pts
            </span>
          </div>
        </header>

        <div className="animate-rise-delay flex items-center justify-center py-2">
          <CharacterStage size={168} pose="wave" shop={shop} pad="lg" />
        </div>

        <p className="text-center text-xs text-muted">
          Outfits dress Ara. Themes change the app look — unlock, then switch in
          Ara options.
        </p>

        {error && <p className="text-center text-sm text-rose-600">{error}</p>}

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-10 w-10 animate-pulse rounded-full bg-brand-soft" />
            <p className="text-sm text-muted">Getting Ara ready…</p>
          </div>
        )}

        {giftCards && giftCards.offers.length > 0 && (
          <section className="animate-rise relative flex flex-col gap-4 overflow-hidden rounded-[1.75rem] border border-brand/40 bg-gradient-to-br from-brand-soft/90 via-surface to-panel p-4 shadow-[0_18px_40px_-24px_rgba(180,100,130,0.45)] sm:p-5">
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-brand/15 blur-2xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                    New
                  </span>
                  <h2 className="font-display text-xl font-semibold tracking-tight text-brand-ink sm:text-2xl">
                    Gift cards are here
                  </h2>
                </div>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink/80">
                  Earn points from logging and quizzes, then redeem a real $5
                  card — The Stil or Blue Cow. Amazon is coming soon.
                </p>
              </div>
              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand">
                500 pts each
              </p>
            </div>
            <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {giftCards.offers.map((offer) => {
                const available = offer.available !== false;
                const canAfford = giftCards.points >= offer.points;
                const hasPending = giftCards.pending_count > 0;
                const isBusy = busyId === offer.id;
                const logo = offer.image
                  ? `/gift-cards/${offer.image}`
                  : null;
                return (
                  <div
                    key={offer.id}
                    className={`relative flex gap-3 rounded-2xl border bg-surface p-3.5 text-left sm:flex-col sm:gap-3 ${
                      available
                        ? "border-brand/35 shadow-[0_10px_24px_-18px_rgba(180,100,130,0.5)]"
                        : "border-border/70 bg-panel/50"
                    }`}
                  >
                    {available && (
                      <span className="absolute right-2.5 top-2.5 rounded-md bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                        New
                      </span>
                    )}
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-panel sm:h-28 sm:w-full">
                      {logo ? (
                        <Image
                          src={logo}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 80px, 200px"
                          className="object-contain p-2"
                        />
                      ) : (
                        <span className="text-3xl">{offer.emoji}</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="font-display text-base font-semibold text-ink pr-10 sm:pr-0">
                        {offer.name}
                      </p>
                      <p className="text-[11px] leading-snug text-muted">
                        {offer.blurb}
                      </p>
                      <p className="text-xs font-semibold text-brand-ink">
                        {available ? `${offer.points} pts` : "Coming soon"}
                      </p>
                      <div className="mt-auto pt-1">
                        {available ? (
                          <button
                            type="button"
                            disabled={isBusy || !canAfford || hasPending}
                            onClick={() =>
                              void handleRedeemGiftCard(
                                offer.id,
                                offer.name,
                                offer.points
                              )
                            }
                            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-ink disabled:opacity-40"
                          >
                            {isBusy
                              ? "…"
                              : hasPending
                                ? "Claim pending"
                                : canAfford
                                  ? "Redeem"
                                  : "Need points"}
                          </button>
                        ) : (
                          <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted">
                            Coming soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {giftCards.redemptions.length > 0 && (
              <ul className="flex flex-col gap-2 rounded-2xl border border-border bg-panel/50 px-4 py-3">
                {giftCards.redemptions.slice(0, 5).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="min-w-0 truncate text-ink">
                      {row.name} · {row.points_spent} pts
                    </span>
                    <span
                      className={`shrink-0 font-semibold uppercase tracking-wide ${
                        row.status === "fulfilled"
                          ? "text-brand-ink"
                          : row.status === "pending"
                            ? "text-amber-700"
                            : "text-muted"
                      }`}
                    >
                      {row.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {shop && themes.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              App themes
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {themes.map((item: ShopItem) => {
                const isOwned = shop.owned_item_ids.includes(item.id);
                const canAfford = shop.points >= item.price;
                const isBusy = busyId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`interactive-tile flex gap-4 rounded-2xl border p-4 text-left ${
                      isOwned
                        ? "border-brand bg-brand-soft/70"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-xl bg-panel text-3xl">
                      {item.emoji}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="font-display text-base font-semibold text-ink">
                        {item.name}
                      </p>
                      {item.pieces && (
                        <p className="text-[11px] leading-snug text-muted">
                          {item.pieces}
                        </p>
                      )}
                      <p className="text-xs text-muted">
                        {item.price === 0 ? "Free" : `${item.price} pts`}
                      </p>
                      <div className="mt-auto pt-1">
                        {isOwned ? (
                          <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted">
                            Unlocked · use in Ara options
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy || !canAfford}
                            onClick={() => handleBuy(item.id)}
                            className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            {isBusy ? "…" : canAfford ? "Unlock" : "Need points"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {shop && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Complete outfits
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {outfits.map((item: ShopItem) => {
                const isOwned =
                  shop.owned_item_ids.includes(item.id) ||
                  FREE_STARTER_IDS.has(item.id);
                const isEquipped = shop.equipped.outfit === item.id;
                const canAfford = shop.points >= item.price;
                const isBusy = busyId === item.id;
                const preview = outfitPreviewSrc(item);

                return (
                  <div
                    key={item.id}
                    className={`interactive-tile flex gap-4 rounded-2xl border p-4 text-left ${
                      isEquipped
                        ? "border-brand bg-brand-soft/70"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div
                      className={`relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-panel ${
                        !isOwned && !canAfford ? "opacity-40" : ""
                      }`}
                    >
                      {preview ? (
                        <Image
                          src={preview}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-contain object-bottom"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-3xl">
                          {item.emoji}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="font-display text-base font-semibold text-ink">
                        {item.name}
                      </p>
                      {FREE_STARTER_IDS.has(item.id) && (
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
                          Original mascot
                        </p>
                      )}
                      {item.pieces && (
                        <p className="text-[11px] leading-snug text-muted">
                          {item.pieces}
                        </p>
                      )}
                      <p className="text-xs text-muted">
                        {FREE_STARTER_IDS.has(item.id)
                          ? "OG · Free"
                          : item.price === 0
                            ? "Free"
                            : `${item.price} pts`}
                      </p>
                      <div className="mt-auto pt-1">
                        {isOwned ? (
                          isEquipped ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUnequip(item.slot, item.id)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-panel"
                            >
                              {isBusy ? "…" : "Wearing"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleEquip(item.id)}
                              className="bloom-pill px-3 py-1.5 text-xs font-semibold hover:brightness-105"
                            >
                              {isBusy ? "…" : "Wear"}
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy || !canAfford}
                            onClick={() => handleBuy(item.id)}
                            className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            {isBusy ? "…" : canAfford ? "Buy" : "Need points"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
