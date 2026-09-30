"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRankingAccess } from "@/lib/ranking-access";
import { placeBet, claimDailyBonus, formatCountdown } from "@/lib/betting";
import { refreshRoundStatsMessage } from "@/lib/prediction-stats-message";
import { isWebStake, type WebStake } from "@/lib/web-bet";

export type WebBetResult = { ok: true } | { ok: false; error: string };

// Discord user ids are snowflakes. Session users that don't carry one (the legacy password
// admin's placeholder identity) can't hold a Bettor balance the bot would recognize.
const DISCORD_SNOWFLAKE = /^\d{15,21}$/;

// Web counterpart of the Discord bet modal. Identity always comes from the session cookie,
// never from the client: session user -> Discord id -> Bettor row of the round's ranking.
// Validation, the 5-minute window and balance handling are placeBet's, exactly like the bot.
export async function placeWebBetAction(slug: string, roundId: string, guess: boolean, stake: WebStake): Promise<WebBetResult> {
  if (typeof slug !== "string" || typeof roundId !== "string" || typeof guess !== "boolean" || !isWebStake(stake)) {
    return { ok: false, error: "Apuesta inválida." };
  }

  let access;
  try {
    access = await getRankingAccess(slug);
  } catch {
    return { ok: false, error: "No pudimos verificar tu sesión." };
  }
  if (!access || !access.canView) return { ok: false, error: "Ranking no encontrado." };
  if (!access.user) return { ok: false, error: "Entrá con Discord para apostar." };
  if (!access.canInteract) return { ok: false, error: "No podés apostar en este ranking." };
  if (!DISCORD_SNOWFLAKE.test(access.user.discordId)) {
    return { ok: false, error: "Tu sesión no está vinculada a una cuenta de Discord." };
  }

  // The round must belong to the ranking in the URL, or a member of one ranking could bet
  // into another's round.
  const round = await prisma.predictionRound.findUnique({ where: { id: roundId }, select: { rankingId: true } });
  if (!round || round.rankingId !== access.ranking.id) return { ok: false, error: "Esta apuesta ya no existe." };

  // "All-in": placeBet clamps the request to the available balance (current balance plus
  // any stake already on this round), so asking for the maximum bets everything.
  const amountText = stake === "all" ? String(Number.MAX_SAFE_INTEGER) : String(stake);
  const result = await placeBet(roundId, access.user.discordId, access.user.username, guess, amountText);
  if (!result.ok) return { ok: false, error: result.error };

  try {
    await refreshRoundStatsMessage(roundId);
  } catch (err) {
    console.error(`Failed to refresh prediction stats message for round ${roundId}:`, err);
  }

  revalidatePath(`/${slug}/en-vivo`);
  return { ok: true };
}

export type ClaimBonusResult = { ok: true; amount: number; balanceAfter: number } | { ok: false; error: string };

// Web counterpart of the /reclamar bot command. Same identity resolution as placeWebBetAction;
// claimDailyBonus owns the 24h cooldown so both channels share one clock per Discord account.
export async function claimDailyBonusAction(slug: string): Promise<ClaimBonusResult> {
  if (typeof slug !== "string") return { ok: false, error: "Solicitud inválida." };

  let access;
  try {
    access = await getRankingAccess(slug);
  } catch {
    return { ok: false, error: "No pudimos verificar tu sesión." };
  }
  if (!access || !access.canView) return { ok: false, error: "Ranking no encontrado." };
  if (!access.user) return { ok: false, error: "Entrá con Discord para reclamar tu bono." };
  if (!access.canInteract) return { ok: false, error: "No podés reclamar en este ranking." };
  if (!DISCORD_SNOWFLAKE.test(access.user.discordId)) {
    return { ok: false, error: "Tu sesión no está vinculada a una cuenta de Discord." };
  }

  const result = await claimDailyBonus(access.ranking.id, access.user.discordId, access.user.username);
  if (!result.ok) {
    return { ok: false, error: `Ya reclamaste tu bono hoy. Volvé en ${formatCountdown(result.nextClaimAt, Date.now())}.` };
  }

  revalidatePath(`/${slug}/en-vivo`);
  return { ok: true, amount: result.amount, balanceAfter: result.balanceAfter };
}
