export type StudyVibeId = "focus" | "beach" | "cafe" | "rain" | "library";

export type StudyVibe = {
  id: StudyVibeId;
  name: string;
  blurb: string;
  /** CSS class applied to the study page shell */
  themeClass: string;
  musicLabel: string;
  /** Full-bleed scene image under the session UI (public path) */
  sceneImage?: string;
  /** Real looping track (public path). Falls back to synthesized ambience. */
  musicSrc?: string;
  musicCredit?: string;
  immersive?: boolean;
};

export const STUDY_VIBES: StudyVibe[] = [
  {
    id: "focus",
    name: "Clear focus",
    blurb: "Bright airy desk — soft light pulse and calm focus.",
    themeClass: "vibe-focus",
    musicLabel: "Soft focus pad",
    sceneImage: "/study-scenes/focus.jpg",
    musicSrc: "/audio/focus-music.mp3",
    musicCredit:
      '"Dream Culture" by Kevin MacLeod (incompetech.com) · CC BY 4.0',
    immersive: true,
  },
  {
    id: "beach",
    name: "Beach day",
    blurb: "Ocean patio view — waves, sparkles, sunny focus.",
    themeClass: "vibe-beach",
    musicLabel: "Bossa beach",
    sceneImage: "/study-scenes/beach.jpg",
    musicSrc: "/audio/beach-music.mp3",
    musicCredit:
      '"Bossa Antigua" by Kevin MacLeod (incompetech.com) · CC BY 4.0',
    immersive: true,
  },
  {
    id: "cafe",
    name: "Cozy café",
    blurb: "Live jazz café room — warm lamps, steam, falling leaves.",
    themeClass: "vibe-cafe",
    musicLabel: "Café jazz",
    sceneImage: "/study-scenes/cafe.jpg",
    musicSrc: "/audio/cafe-jazz.mp3",
    musicCredit:
      '"Jazz Brunch" by Kevin MacLeod (incompetech.com) · CC BY 4.0',
    immersive: true,
  },
  {
    id: "rain",
    name: "Rainy window",
    blurb: "Rainy window nook — streaks on glass, soft storm light.",
    themeClass: "vibe-rain",
    musicLabel: "Rainy soft score",
    sceneImage: "/study-scenes/rain.jpg",
    musicSrc: "/audio/rain-music.mp3",
    musicCredit:
      '"Comfortable Mystery" by Kevin MacLeod (incompetech.com) · CC BY 4.0',
    immersive: true,
  },
  {
    id: "library",
    name: "Quiet library",
    blurb: "Library aisle — gold lamp glow and drifting dust motes.",
    themeClass: "vibe-library",
    musicLabel: "Quiet study score",
    sceneImage: "/study-scenes/library.jpg",
    musicSrc: "/audio/library-music.mp3",
    musicCredit:
      '"Deliberate Thought" by Kevin MacLeod (incompetech.com) · CC BY 4.0',
    immersive: true,
  },
];

export function getVibe(id: StudyVibeId | string | undefined): StudyVibe {
  return STUDY_VIBES.find((v) => v.id === id) ?? STUDY_VIBES[0];
}

/** Vibes that take over the whole app palette during a session. */
export function isImmersiveVibe(id: StudyVibeId | string | undefined): boolean {
  return Boolean(getVibe(id).immersive);
}
