/** Custom Lounge emoji shortcodes → public image paths. */
export const LOUNGE_EMOJIS = [
  {
    id: "malia",
    shortcode: ":malia:",
    src: "/emoji/malia.png",
    label: "Malia",
  },
] as const;

export type LoungeEmoji = (typeof LOUNGE_EMOJIS)[number];

const SHORTCODE_PATTERN = /(:[a-z0-9_]+:)/gi;

export function findLoungeEmoji(shortcode: string): LoungeEmoji | undefined {
  const key = shortcode.toLowerCase();
  return LOUNGE_EMOJIS.find((e) => e.shortcode === key);
}

/** Split message text into plain text and emoji shortcode segments. */
export function splitLoungeEmojiText(text: string): string[] {
  return text.split(SHORTCODE_PATTERN).filter((part) => part.length > 0);
}
