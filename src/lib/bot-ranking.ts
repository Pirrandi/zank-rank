// Bot ranking resolution (design D12, PR10). A Discord slash command carries the interacting
// guild's id; that guild resolves to at most one Ranking via `discordGuildId` (D1b: one guild
// maps to one ranking, enforced by a unique constraint). Hosted edition never guesses: a guild
// with no link, or a DM with no guild at all, gets an ephemeral "how to link" reply instead of
// silently falling back — and reads/writes nothing. Self-hosted edition has no guild-linking UI
// at all (D7), so it always resolves to the root ranking regardless of guild.
//
// Bet buttons (predict/bet_modal) do NOT go through this — they resolve their ranking from the
// PredictionRound they belong to (see src/lib/betting.ts), since that round already fixes which
// ranking's game/channel it came from.

import { prisma } from "./prisma";
import { isSelfHosted } from "./edition";
import { ROOT_SLUG, getRankingBySlug } from "./ranking";
import type { Ranking } from "@prisma/client";

export type BotRankingResolution = { ok: true; ranking: Ranking } | { ok: false };

export async function resolveBotRanking(guildId: string | undefined): Promise<BotRankingResolution> {
  if (isSelfHosted()) {
    const root = await getRankingBySlug(ROOT_SLUG);
    if (!root) return { ok: false };
    return { ok: true, ranking: root };
  }


  // Unreachable in self-hosted (isSelfHosted() is always true there, so the branch above always
  // returns) — kept only so control flow type-checks once the hosted lookup above is stripped.
  return { ok: false };
}

export const RANKING_NOT_LINKED_MESSAGE =
  "Este servidor no está vinculado a ningún ranking. Un OWNER/ADMIN puede vincularlo en zank.lol/<tu-ranking>/admin/acceso.";
