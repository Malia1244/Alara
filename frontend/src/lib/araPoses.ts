import type { AraGender } from "@/lib/araPrefs";
import {
  BOY_DEFAULT_LOOK_SRC,
  DEFAULT_LOOK_SRC,
  GIRL_DEFAULT_LOOK_SRC,
} from "@/lib/araOutfitCache";

export type AraPose =
  | "wave"
  | "cheer"
  | "think"
  | "encourage"
  | "wink"
  | "proud"
  | "sitConfused"
  | "sitClarify"
  | "sitUnderstood";

export const ARA_POSES: AraPose[] = [
  "wave",
  "cheer",
  "think",
  "encourage",
  "wink",
  "proud",
  "sitConfused",
  "sitClarify",
  "sitUnderstood",
];

/** Legacy single-map fallback (girl OG). Prefer araPoseSrc(gender, pose). */
export const ARA_EXACT_SRC = DEFAULT_LOOK_SRC;

export const ARA_POSE_SRC: Record<AraPose, string> = {
  wave: "/ara/poses/girl/wave.png",
  cheer: "/ara/poses/girl/cheer.png",
  think: "/ara/poses/girl/think.png",
  encourage: "/ara/poses/girl/encourage.png",
  wink: "/ara/poses/girl/wink.png",
  proud: "/ara/poses/girl/proud.png",
  sitConfused: "/ara/poses/girl/sitConfused.png",
  sitClarify: "/ara/poses/girl/sitClarify.png",
  sitUnderstood: "/ara/poses/girl/sitUnderstood.png",
};

/** Separate girl / boy pose sheets under public/ara/poses/{gender}/ */
export function araPoseSrc(gender: AraGender, pose: AraPose): string {
  return `/ara/poses/${gender}/${pose}.png`;
}

export function isOgLookSrc(src: string | null | undefined): boolean {
  if (!src) return true;
  return (
    src.endsWith("look-floral-cottage.png") ||
    src.endsWith("look-floral-cottage-boy.png") ||
    src.endsWith("look-boy-zip-og.png") ||
    src.includes("/ara/poses/")
  );
}

export function defaultPoseFallback(gender: AraGender): string {
  return gender === "boy" ? BOY_DEFAULT_LOOK_SRC : GIRL_DEFAULT_LOOK_SRC;
}
