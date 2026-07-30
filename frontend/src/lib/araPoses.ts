export type AraPose =
  | "wave"
  | "cheer"
  | "think"
  | "encourage"
  | "wink"
  | "proud";

export const ARA_POSE_SRC: Record<AraPose, string> = {
  wave: "/ara-mascot-v2.png",
  cheer: "/ara/cheer.png",
  think: "/ara/think.png",
  encourage: "/ara/encourage.png",
  wink: "/ara/wink.png",
  proud: "/ara/proud.png",
};
