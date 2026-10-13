/**
 * Custom Lounge emojis.
 * To add more: drop a square PNG in /public/emoji/, then add an entry here.
 */
export type LoungeEmoji = {
  id: string;
  shortcode: string;
  src: string;
  label: string;
};

export const LOUNGE_EMOJIS: LoungeEmoji[] = [
  {
    id: "sideeye",
    shortcode: ":sideeye:",
    src: "/emoji/sideeye.png",
    label: "Side eye",
  },
];

const SHORTCODE_PATTERN = /(:[a-z0-9_]+:)/gi;

export function findLoungeEmoji(shortcode: string): LoungeEmoji | undefined {
  const key = shortcode.toLowerCase();
  return LOUNGE_EMOJIS.find((e) => e.shortcode === key);
}

/** Split message text into plain text and emoji shortcode segments. */
export function splitLoungeEmojiText(text: string): string[] {
  return text.split(SHORTCODE_PATTERN).filter((part) => part.length > 0);
}
