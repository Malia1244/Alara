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

/** Exact pastel Ara reference look — used for every pose until pose variants exist. */
export const ARA_EXACT_SRC = "/ara/ara-exact.jpg";

export const ARA_POSE_SRC: Record<AraPose, string> = {
  wave: ARA_EXACT_SRC,
  cheer: ARA_EXACT_SRC,
  think: ARA_EXACT_SRC,
  encourage: ARA_EXACT_SRC,
  wink: ARA_EXACT_SRC,
  proud: ARA_EXACT_SRC,
  sitConfused: ARA_EXACT_SRC,
  sitClarify: ARA_EXACT_SRC,
  sitUnderstood: ARA_EXACT_SRC,
};
