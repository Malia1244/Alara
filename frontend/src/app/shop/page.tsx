"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import NoticeBanner from "@/components/NoticeBanner";
import {
  equipShopItem,
  fetchShopState,
  purchaseShopItem,
  unequipShopSlot,
  type ShopItem,
  type ShopState,
} from "@/lib/api";

const FREE_STARTER_IDS = new Set(["look-lavender-soft"]);

function outfitPreviewSrc(item: ShopItem): string | null {
  if (item.fullImage) return `/outfits/${item.fullImage}`;
  if (item.image) return `/shop-items/${item.image}`;
  return null;
}

export default function ShopPage() {
  const [shop, setShop] = useState<ShopState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const data = await fetchShopState();
      setShop(data);
    } catch {
      setError(
        "Couldn't reach the server. Is the FastAPI backend running on port 8000?"
      );
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't buy that item.");
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

  const outfits = shop?.items ?? [];

  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
      <NoticeBanner message={notice} onClose={() => setNotice(null)} />
      <main className="flex w-full max-w-4xl flex-col gap-7">
        <header className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Outfit studio
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Shop
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Complete named looks for Ara — hair, top, bottoms, and shoes.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-xl bg-ink px-4 py-2.5 text-white">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/55">
              Balance
            </span>
            <span className="font-display text-sm font-semibold">
              {isLoading ? "…" : shop?.points ?? 0} pts
            </span>
          </div>
        </header>

        <div className="animate-rise-delay flex items-center justify-center rounded-2xl border border-border bg-panel py-6">
          <CharacterStage size={150} pose="wave" shop={shop} pad="md" />
        </div>

        <p className="rounded-xl border border-border bg-brand-soft/50 px-4 py-3 text-xs font-medium text-brand-ink">
          Each card is one full outfit. Lavender Soft Day is free.
        </p>

        {error && <p className="text-center text-sm text-rose-600">{error}</p>}

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-10 w-10 animate-pulse rounded-full bg-brand-soft" />
            <p className="text-sm text-muted">Getting Ara ready…</p>
          </div>
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
                              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-ink"
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
