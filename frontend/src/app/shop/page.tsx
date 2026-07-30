"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import AraAvatar from "@/components/AraAvatar";
import {
  equipShopItem,
  fetchShopState,
  purchaseShopItem,
  unequipShopSlot,
  type ShopItem,
  type ShopState,
} from "@/lib/api";

const SLOT_LABELS: Record<string, string> = {
  head: "Hats",
  top: "Tops",
  face: "Face",
  neck: "Neck",
  back: "Back",
  effect: "Effects",
};

const SLOT_ORDER = ["head", "top", "face", "neck", "back", "effect"];

function groupBySlot(items: ShopItem[]): [string, ShopItem[]][] {
  const groups = new Map<string, ShopItem[]>();
  for (const item of items) {
    const list = groups.get(item.slot) ?? [];
    list.push(item);
    groups.set(item.slot, list);
  }
  return SLOT_ORDER.filter((slot) => groups.has(slot)).map((slot) => [
    slot,
    groups.get(slot)!,
  ]);
}

export default function ShopPage() {
  const [shop, setShop] = useState<ShopState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
      <main className="flex w-full max-w-4xl flex-col gap-7">
        <header className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              Outfit studio
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Shop
            </h1>
            <p className="mt-1 text-sm text-muted">
              Spend quiz points on looks for Ara.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-2xl bg-stone-900 px-4 py-2.5 text-white">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Balance
            </span>
            <span className="font-display text-sm font-bold">
              {isLoading ? "…" : shop?.points ?? 0} pts
            </span>
          </div>
        </header>

        <div className="animate-rise-delay flex items-center justify-center py-4">
          <AraAvatar size={150} pose="wave" shop={shop} />
        </div>

        <p className="rounded-2xl border border-border bg-brand-soft/50 px-4 py-3 text-xs font-medium text-brand-ink">
          Earn 10 points for every quiz question you get right. Hats and tops
          are separate — she can wear one of each.
        </p>

        {error && <p className="text-center text-sm text-rose-600">{error}</p>}

        {isLoading && (
          <p className="text-center text-sm text-muted">Loading shop...</p>
        )}

        {shop &&
          groupBySlot(shop.items).map(([slot, items]) => (
            <section key={slot} className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                {SLOT_LABELS[slot] ?? slot}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((item) => {
                  const isOwned = shop.owned_item_ids.includes(item.id);
                  const isEquipped = shop.equipped[item.slot] === item.id;
                  const canAfford = shop.points >= item.price;
                  const isBusy = busyId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`interactive-tile flex flex-col items-center gap-2 rounded-[1.5rem] border p-5 text-center ${
                        isEquipped
                          ? "border-brand bg-brand-soft/70"
                          : isOwned
                            ? "border-border bg-surface"
                            : "border-border bg-surface"
                      }`}
                    >
                      {item.image ? (
                        <Image
                          src={`/shop-items/${item.image}`}
                          alt=""
                          width={48}
                          height={48}
                          className={`h-12 w-12 object-contain ${!isOwned && !canAfford ? "opacity-40" : ""}`}
                        />
                      ) : (
                        <span
                          className={`text-3xl ${!isOwned && !canAfford ? "opacity-40" : ""}`}
                        >
                          {item.emoji}
                        </span>
                      )}
                      <p className="text-sm font-bold text-stone-800">
                        {item.name}
                      </p>

                      {isEquipped ? (
                        <div className="mt-1 flex flex-col items-center gap-1">
                          <span className="rounded-xl bg-brand px-3 py-1 text-xs font-semibold text-white">
                            Equipped
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnequip(item.slot, item.id)}
                            disabled={isBusy}
                            className="text-[11px] font-semibold text-muted underline-offset-2 hover:text-brand hover:underline disabled:opacity-50"
                          >
                            Take off
                          </button>
                        </div>
                      ) : isOwned ? (
                        <button
                          type="button"
                          onClick={() => handleEquip(item.id)}
                          disabled={isBusy}
                          className="mt-1 rounded-xl bg-brand-soft px-4 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Equipping..." : "Equip"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBuy(item.id)}
                          disabled={!canAfford || isBusy}
                          className="mt-1 rounded-xl bg-brand px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                        >
                          {isBusy ? "Buying..." : `${item.price} pts`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

        <p className="text-center text-xs text-muted">
          Everything you equip shows up on Ara across the app.
        </p>
      </main>
    </div>
  );
}
