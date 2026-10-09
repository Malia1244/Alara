import { DEFAULT_LOOK_SRC } from "@/lib/araOutfitCache";

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

/**
 * Pose ids still exist for API compatibility, but every pose uses the
 * currently selected outfit portrait (via AraAvatar), falling back to OG.
 */
export const ARA_EXACT_SRC = DEFAULT_LOOK_SRC;

export const ARA_POSE_SRC: Record<AraPose, string> = {
  wave: DEFAULT_LOOK_SRC,
  cheer: DEFAULT_LOOK_SRC,
  think: DEFAULT_LOOK_SRC,
  encourage: DEFAULT_LOOK_SRC,
  wink: DEFAULT_LOOK_SRC,
  proud: DEFAULT_LOOK_SRC,
  sitConfused: DEFAULT_LOOK_SRC,
  sitClarify: DEFAULT_LOOK_SRC,
  sitUnderstood: DEFAULT_LOOK_SRC,
};
