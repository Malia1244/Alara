"use client";

import AraAvatar from "@/components/AraAvatar";
import type { ShopState } from "@/lib/api";
import type { AraPose } from "@/lib/araPoses";

type Props = {
  size?: number;
  pose?: AraPose;
  motion?: "idle" | "react" | "dance" | "none";
  priority?: boolean;
  label?: string;
  className?: string;
  /** Extra padding around the character art */
  pad?: "sm" | "md" | "lg";
  shop?: ShopState | null;
};

const PAD = {
  sm: "p-2.5 pt-8",
  md: "p-3.5 pt-9",
  lg: "p-5 pt-10",
} as const;

/**
 * Frames Ara as a product mascot / study character,
 * not as a person chatting in the UI.
 */
export default function CharacterStage({
  size = 96,
  pose = "wave",
  motion = "idle",
  priority = false,
  label = "Ara",
  className = "",
  pad = "md",
  shop = null,
}: Props) {
  return (
    <div
      className={`character-stage shrink-0 ${PAD[pad]} ${className}`}
      style={{ minWidth: size + 24, minHeight: size + 28 }}
    >
      <span className="character-stage__label">{label}</span>
      <div className="character-stage__inner">
        <AraAvatar
          size={size}
          pose={pose}
          motion={motion}
          priority={priority}
          shop={shop}
        />
      </div>
    </div>
  );
}
