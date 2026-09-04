"use client";

import { useEffect, useState } from "react";
import { useAraPrefs } from "@/components/AraPrefsProvider";
import {
  isThemeUnlocked,
  themeShopId,
  type UiTheme,
} from "@/lib/araPrefs";
import {
  fetchShopState,
  purchaseShopItem,
  type ShopState,
} from "@/lib/api";

type Props = {
  className?: string;
  compact?: boolean;
};

function ToggleRow({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center justify-between gap-3"
      >
        <span className="text-xs font-medium text-stone-600">{label}</span>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            checked ? "bg-brand" : "bg-stone-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </label>
      {hint && <p className="text-[10px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

const THEMES: {
  id: UiTheme;
  label: string;
  priceLabel: string;
}[] = [
  { id: "original", label: "Original", priceLabel: "Free" },
  { id: "sleek", label: "Sleek", priceLabel: "150 pts" },
  { id: "playful", label: "Playful", priceLabel: "150 pts" },
];

export default function AraPrefsControls({
  className = "",
  compact = false,
}: Props) {
  const {
    prefs,
    setMotion,
    setTips,
    setStudyReminders,
    setReminderHour,
    setTheme,
  } = useAraPrefs();
  const [shop, setShop] = useState<ShopState | null>(null);
  const [busyTheme, setBusyTheme] = useState<UiTheme | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchShopState()
      .then((data) => {
        if (!cancelled) setShop(data);
      })
      .catch(() => {
        // Themes stay selectable as Original if shop can't load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If prefs point at a locked theme, fall back to Original.
  useEffect(() => {
    if (!shop) return;
    if (!isThemeUnlocked(prefs.theme, shop.owned_item_ids)) {
      setTheme("original");
    }
  }, [shop, prefs.theme, setTheme]);

  async function handleRemindersToggle(on: boolean) {
    if (on && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch {
          // Still enable in-app reminders even if permission fails.
        }
      }
    }
    setStudyReminders(on);
  }

  async function handleThemeClick(theme: UiTheme) {
    setThemeError(null);
    if (theme === "original") {
      setTheme("original");
      return;
    }
    if (shop && isThemeUnlocked(theme, shop.owned_item_ids)) {
      setTheme(theme);
      return;
    }
    const itemId = themeShopId(theme);
    if (!itemId) return;
    if (!shop) {
      setThemeError("Couldn't reach the shop to unlock themes.");
      return;
    }
    const item = shop.items.find((i) => i.id === itemId);
    const price = item?.price ?? 150;
    if (shop.points < price) {
      setThemeError(`Need ${price} pts to unlock ${theme}.`);
      return;
    }
    setBusyTheme(theme);
    try {
      const updated = await purchaseShopItem(itemId);
      setShop(updated);
      setTheme(theme);
    } catch (err) {
      setThemeError(
        err instanceof Error ? err.message : "Couldn't unlock that theme."
      );
    } finally {
      setBusyTheme(null);
    }
  }

  return (
    <div
      className={`rounded-2xl border border-border bg-white/80 ${
        compact ? "px-3 py-2.5" : "px-3.5 py-3"
      } ${className}`}
    >
      {!compact && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
          Ara options
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        <ToggleRow
          id="ara-motion-toggle"
          label="Animations"
          checked={prefs.motion}
          onChange={setMotion}
        />
        <ToggleRow
          id="ara-tips-toggle"
          label="Coach tips"
          checked={prefs.tips}
          onChange={setTips}
        />
        <ToggleRow
          id="ara-study-reminders-toggle"
          label="Study reminders"
          checked={prefs.studyReminders}
          onChange={(on) => {
            void handleRemindersToggle(on);
          }}
          hint="Ara nudges you to log what you learned — earn shop points when you do."
        />
        {prefs.studyReminders && (
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-stone-600">
              Reminder time
            </span>
            <select
              value={prefs.reminderHour}
              onChange={(e) => setReminderHour(Number(e.target.value))}
              className="rounded-lg border border-border bg-white px-2 py-1 text-xs font-semibold text-ink"
            >
              {Array.from({ length: 24 }, (_, hour) => {
                const label = new Date(2000, 0, 1, hour).toLocaleTimeString(
                  undefined,
                  { hour: "numeric" }
                );
                return (
                  <option key={hour} value={hour}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        <div className="flex flex-col gap-1.5 pt-1">
          <p className="text-xs font-medium text-stone-600">Theme</p>
          <div className="grid grid-cols-3 gap-1.5">
            {THEMES.map((t) => {
              const unlocked =
                t.id === "original" ||
                (shop != null && isThemeUnlocked(t.id, shop.owned_item_ids));
              const active = prefs.theme === t.id;
              const busy = busyTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void handleThemeClick(t.id);
                  }}
                  className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition disabled:opacity-60 ${
                    active
                      ? "bg-brand text-white"
                      : unlocked
                        ? "border border-border bg-white text-stone-600 hover:border-brand/40"
                        : "border border-dashed border-border bg-panel text-muted"
                  }`}
                >
                  <span className="block">{t.label}</span>
                  <span
                    className={`mt-0.5 block text-[10px] font-medium ${
                      active ? "text-white/80" : "text-muted"
                    }`}
                  >
                    {busy
                      ? "…"
                      : unlocked
                        ? t.id === "original"
                          ? "Free"
                          : "Owned"
                        : t.priceLabel}
                  </span>
                </button>
              );
            })}
          </div>
          {themeError && (
            <p className="text-[10px] font-medium text-accent">{themeError}</p>
          )}
          <p className="text-[10px] leading-snug text-muted">
            Unlock Sleek or Playful with shop points, then tap to use.
          </p>
        </div>
      </div>
    </div>
  );
}
