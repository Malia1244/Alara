"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import NoticeBanner from "@/components/NoticeBanner";
import {
  equipShopItem,
  fetchShopState,
  unequipShopSlot,
  type ShopItem,
  type ShopState,
} from "@/lib/api";

const HAT_PIGTAILS_NOTICE = "Hats only work with pigtails.";

const SLOT_LABELS: Record<string, string> = {
  hair: "Hair",
  head: "Hats",
  top: "Tops",
  pants: "Pants",
};

const SLOT_ORDER = ["hair", "head", "top", "pants"];

const CUSTOM_HAIR_IDS = new Set([
  "hair-space-buns",
  "hair-halfup-bow",
  "hair-messy-bun",
  "hair-side-braid",
]);

const FREE_STARTER_IDS = new Set(["hair-pigtails", "top-classic-lavender"]);

export default function AraPage() {
  const [shop, setShop] = useState<ShopState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchShopState()
      .then((data) => {
        if (!cancelled) setShop(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't load Ara's closet. Is the backend running?");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ownedItems = useMemo(() => {
    if (!shop) return [] as ShopItem[];
    const owned = new Set([...shop.owned_item_ids, ...FREE_STARTER_IDS]);
    return shop.items.filter((item) => owned.has(item.id));
  }, [shop]);

  const ownedBySlot = useMemo(() => {
    const groups = new Map<string, ShopItem[]>();
    for (const item of ownedItems) {
      const list = groups.get(item.slot) ?? [];
      list.push(item);
      groups.set(item.slot, list);
    }
    return SLOT_ORDER.filter((slot) => groups.has(slot)).map(
      (slot) => [slot, groups.get(slot)!] as const
    );
  }, [ownedItems]);

  async function handleEquip(itemId: string) {
    const item = shop?.items.find((i) => i.id === itemId);
    if (
      item?.slot === "head" &&
      CUSTOM_HAIR_IDS.has(shop?.equipped.hair ?? "")
    ) {
      setNotice(HAT_PIGTAILS_NOTICE);
      return;
    }

    setBusyId(itemId);
    setError(null);
    try {
      setShop(await equipShopItem(itemId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't equip that.";
      if (message.toLowerCase().includes("pigtail")) {
        setNotice(HAT_PIGTAILS_NOTICE);
      } else {
        setError(message);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnequip(slot: string, itemId: string) {
    setBusyId(itemId);
    setError(null);
    try {
      setShop(await unequipShopSlot(slot));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't take that off.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-8 sm:px-8 sm:py-10">
      <NoticeBanner message={notice} onClose={() => setNotice(null)} />
      <main className="flex w-full max-w-4xl flex-col gap-6">
        <header className="animate-rise flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Character
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Dressing room
            </h1>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
              Everything you own for Ara — try looks on, take them off, then open
              the shop for something new.
            </p>
          </div>
          <Link
            href="/shop"
            className="self-start rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-soft/50"
          >
            Go to shop →
          </Link>
        </header>

        <section className="animate-rise-delay flex flex-col items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-8">
          <CharacterStage
            size={200}
            pose="wave"
            shop={shop}
            priority
            pad="lg"
          />
          <p className="rounded-lg border border-border bg-surface px-4 py-1.5 text-xs font-semibold text-brand-ink">
            {isLoading
              ? "Loading closet…"
              : ownedItems.length === 0
                ? "Closet is empty — shop for outfits"
                : "Tap an item below to wear or take off"}
          </p>
        </section>

        {error && (
          <p className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
            {error}
          </p>
        )}

        {isLoading && (
          <p className="text-center text-sm text-muted">Loading closet…</p>
        )}

        {!isLoading && ownedItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-8 text-center">
            <p className="font-display text-lg font-semibold text-ink">
              Nothing in the closet yet
            </p>
            <p className="mt-1 text-sm text-muted">
              Earn points from quizzes, then buy hats and tops in the shop.
            </p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-ink"
            >
              Open shop
            </Link>
          </div>
        )}

        {shop &&
          ownedBySlot.map(([slot, items]) => (
            <section key={slot} className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                {SLOT_LABELS[slot] ?? slot}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {items.map((item) => {
                  const isEquipped = shop.equipped[item.slot] === item.id;
                  const isBusy = busyId === item.id;
                  const hatBlockedByHair =
                    item.slot === "head" &&
                    CUSTOM_HAIR_IDS.has(shop.equipped.hair ?? "");
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (hatBlockedByHair && !isEquipped) {
                          setNotice(HAT_PIGTAILS_NOTICE);
                          return;
                        }
                        if (isEquipped && item.id === "hair-pigtails") {
                          return;
                        }
                        void (isEquipped
                          ? handleUnequip(item.slot, item.id)
                          : handleEquip(item.id));
                      }}
                      className={`interactive-tile flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition disabled:opacity-60 ${
                        isEquipped
                          ? "border-brand bg-brand-soft/70"
                          : "border-border bg-surface hover:border-brand/40"
                      }`}
                    >
                      {item.image ? (
                        <Image
                          src={`/shop-items/${item.image}`}
                          alt=""
                          width={48}
                          height={48}
                          className="h-12 w-12 object-contain"
                        />
                      ) : (
                        <span className="text-3xl">{item.emoji}</span>
                      )}
                      <p className="text-sm font-semibold text-ink">
                        {item.name}
                      </p>
                      <span
                        className={`rounded-xl px-3 py-1 text-[11px] font-semibold ${
                          isEquipped
                            ? "bg-brand text-white"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {isBusy
                          ? "…"
                          : isEquipped
                            ? item.id === "hair-pigtails"
                              ? "Wearing"
                              : "Wearing · tap off"
                            : hatBlockedByHair
                              ? "Needs pigtails"
                              : "Tap to wear"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
      </main>
    </div>
  );
}
