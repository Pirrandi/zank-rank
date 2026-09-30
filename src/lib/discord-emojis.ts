import emojiMap from "../../data/discord-emojis.json";
import { uploadProfileIconEmoji } from "./discord-emoji-upload";
import { getProfileIconUrl } from "./ddragon";
import { tierLabel } from "./tier-colors";

type EmojiMap = {
  champions: Record<string, string>;
  items: Record<string, string>;
  profileIcons?: Record<string, string>;
  ranks?: Record<string, string>;
};

const map = emojiMap as EmojiMap;

export function getChampionEmoji(championId: number): string | undefined {
  return map.champions[String(championId)];
}

export function getItemEmoji(itemId: number): string | undefined {
  return map.items[String(itemId)];
}

// Uploaded once via scripts/upload-discord-emojis.ts from the same public/emblems/*.png the
// website uses, one per tier (no sub-division: Bronce I-IV share one emblem, same as the site).
export function getRankEmoji(tier: string): string | undefined {
  return map.ranks?.[tier.toUpperCase()];
}

// tierLabel() prefixed with the rank's emblem emoji when we have one uploaded — every Discord
// message that shows a rank should go through this instead of bare tierLabel, so the icon
// requirement (design ask: "el rango se muestre con el icono también") can't be forgotten at a
// new call site. Never used by the website itself, which renders the real <img> via
// tierEmblemUrl() instead of a Discord emoji string.
export function tierLabelWithEmoji(tier: string, rank: string): string {
  const emoji = getRankEmoji(tier);
  const label = tierLabel(tier, rank);
  return emoji ? `${emoji} ${label}` : label;
}

/**
 * Returns the cached emoji for a profile icon, uploading it on the fly the first time a
 * given icon id is seen (e.g. a player changed their profile picture). Never throws — a
 * failed upload just means the recap card renders without that player's icon.
 */
export async function getOrUploadPlayerEmoji(profileIconId: number | null | undefined): Promise<string | undefined> {
  if (profileIconId === null || profileIconId === undefined) return undefined;
  const cached = map.profileIcons?.[String(profileIconId)];
  if (cached) return cached;

  try {
    const iconUrl = await getProfileIconUrl(profileIconId);
    return await uploadProfileIconEmoji(profileIconId, iconUrl);
  } catch (err) {
    console.error(`Failed to upload profile icon emoji for iconId=${profileIconId}:`, err);
    return undefined;
  }
}
