"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ProfileAvatar from "@/components/ProfileAvatar";
import { IconLogout } from "@/components/nav-icons";

type Props = {
  /** sidebar = stacked in the desktop rail; bar = compact row for mobile */
  variant?: "sidebar" | "bar";
};

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

async function fileToAvatarPayload(file: File) {
  const allowed = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  if (!allowed.has(file.type)) {
    throw new Error("Please choose a JPEG, PNG, WebP, or GIF photo.");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("That photo is too large — try one under 2 MB.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.includes(",") ? dataUrl.split(",", 1)[1] : dataUrl;
  return { image_base64: base64, image_mime: file.type };
}

export default function AccountMenu({ variant = "sidebar" }: Props) {
  const {
    user,
    displayName,
    avatarUrl,
    signOut,
    updateDisplayName,
    updateAvatar,
    clearAvatar,
  } = useAuth();
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNameDraft(displayName);
  }, [displayName]);

  if (!user) return null;

  const email = user.email ?? "Signed in";
  const label = displayName || email;

  async function saveName() {
    setBusy(true);
    setMsg(null);
    const err = await updateDisplayName(nameDraft);
    setBusy(false);
    setMsg(err ?? "Saved");
  }

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    setPhotoBusy(true);
    setMsg(null);
    try {
      const payload = await fileToAvatarPayload(file);
      const err = await updateAvatar(payload);
      setMsg(err ?? "Photo saved");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Couldn't use that photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onRemovePhoto() {
    setPhotoBusy(true);
    setMsg(null);
    const err = await clearAvatar();
    setPhotoBusy(false);
    setMsg(err ?? "Photo removed");
  }

  if (variant === "bar") {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <ProfileAvatar name={label} src={avatarUrl} size="sm" />
          <p className="min-w-0 truncate text-[11px] text-muted">{label}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-ink transition-colors hover:bg-brand-soft"
        >
          <IconLogout className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-[1.25rem] border border-border bg-panel px-3.5 py-3 shadow-[0_8px_20px_-16px_rgba(180,100,130,0.35)]">
        <div className="flex items-center gap-3">
          <ProfileAvatar name={label} src={avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-muted">{email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => fileRef.current?.click()}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold text-brand-ink transition hover:bg-brand-soft disabled:opacity-50"
              >
                {photoBusy ? "Saving…" : avatarUrl ? "Change photo" : "Add photo"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => void onRemovePhoto()}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold text-accent transition hover:bg-accent-soft disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            void onPickPhoto(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Lounge name
          </span>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value.slice(0, 24))}
            maxLength={24}
            placeholder="Display name"
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-brand"
          />
        </label>
        <button
          type="button"
          disabled={busy || nameDraft.trim() === displayName}
          onClick={() => void saveName()}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-brand-ink transition hover:bg-brand-soft disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save name"}
        </button>
        {msg && (
          <p
            className={`mt-1 text-[10px] ${
              msg === "Saved" ||
              msg === "Photo saved" ||
              msg === "Photo removed"
                ? "text-brand-ink"
                : "text-accent"
            }`}
          >
            {msg}
          </p>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-brand-ink transition-colors hover:border-brand/40 hover:bg-brand-soft"
        >
          <IconLogout className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>
      <p className="px-1 text-center text-[10px] tracking-wide text-muted/70">
        made by Malia
      </p>
    </div>
  );
}
