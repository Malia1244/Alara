/**
 * Discord community invite.
 * Prefer Vercel env: NEXT_PUBLIC_DISCORD_INVITE_URL=https://discord.gg/xxxxx
 * Or paste your invite below as a fallback for local/dev.
 */
const FALLBACK_DISCORD_INVITE = "";

export function getDiscordInviteUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim() ?? "";
  const url = fromEnv || FALLBACK_DISCORD_INVITE.trim();
  if (!url) return null;
  if (!/^https:\/\/(discord\.gg|discord\.com\/invite)\//i.test(url)) {
    return null;
  }
  return url;
}
