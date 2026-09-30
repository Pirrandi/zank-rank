import { prisma } from "./prisma";
import { Prediction } from "@prisma/client";

export const STARTING_BALANCE = 100;
const MIN_PAYOUT_NO_STAKE = 20;
const WIN_MULTIPLIER = 2;
export const PREDICTION_WINDOW_MINUTES = 5;
const PREDICTION_WINDOW_MS = PREDICTION_WINDOW_MINUTES * 60 * 1000;

// Parses the raw text typed into the wager modal into a whole, non-negative amount capped to
// what's actually available. Shared by placeBet and the admin's fake test-bet flow so both
// interpret "1o0", "", "-5", "999999" etc. identically.
export function parseWagerAmount(rawAmountText: string, availableBalance: number): number {
  const parsed = Number(rawAmountText.trim().replace(/[^0-9]/g, ""));
  const requested = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  return Math.min(requested, availableBalance);
}

// PR10 (design D9/D12): `Bettor` is keyed per ranking `(rankingId, discordUserId)` — the bot
// now resolves the ranking per guild (D12), so the same Discord user holds an independent
// balance in every ranking whose guild they bet in. Callers resolve the ranking themselves:
// the interactions route uses the bot's guild resolution when opening a bet modal, and
// `placeBet`/`resolvePredictions` below use the prediction round's own `rankingId`.

// Same window placeBet enforces; exposed so the web can render "Apuestas cerradas" without
// offering controls that would only bounce.
export function isRoundWindowOpen(roundCreatedAt: Date, nowMs: number): boolean {
  return nowMs - roundCreatedAt.getTime() <= PREDICTION_WINDOW_MS;
}

// What a correct prediction pays out (see resolvePredictions): x2 the stake, or a fixed
// consolation amount for a free (0-stake) bet.
export function potentialPayout(amount: number): number {
  return amount > 0 ? amount * WIN_MULTIPLIER : MIN_PAYOUT_NO_STAKE;
}

export async function getOrCreateBettor(rankingId: string, discordUserId: string, discordUsername: string) {
  return prisma.bettor.upsert({
    where: { rankingId_discordUserId: { rankingId, discordUserId } },
    update: { discordUsername },
    create: { discordUserId, discordUsername, balance: STARTING_BALANCE, rankingId },
  });
}

export const DAILY_BONUS_AMOUNT = 50;
const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Shared by claimDailyBonus and both UIs (bot + web) so "can I claim?" is computed identically.
export function nextDailyBonusClaimAt(lastFreeClaimAt: Date | null): Date | null {
  return lastFreeClaimAt ? new Date(lastFreeClaimAt.getTime() + DAILY_BONUS_COOLDOWN_MS) : null;
}

export type ClaimDailyBonusResult =
  | { ok: true; amount: number; balanceAfter: number }
  | { ok: false; nextClaimAt: Date };

// Bono gratis por cuenta de Discord y por ranking (mismo modelo que el saldo de apuestas):
// reclamar en un ranking no da fichas en otro. Transacción para que dos clics simultáneos
// (bot + web, o doble clic) no den el bono dos veces.
export async function claimDailyBonus(
  rankingId: string,
  discordUserId: string,
  discordUsername: string
): Promise<ClaimDailyBonusResult> {
  const bettorKey = { rankingId_discordUserId: { rankingId, discordUserId } };

  return prisma.$transaction(async (tx) => {
    const bettor = await tx.bettor.upsert({
      where: bettorKey,
      update: { discordUsername },
      create: { discordUserId, discordUsername, balance: STARTING_BALANCE, rankingId },
    });

    const now = new Date();
    const nextClaimAt = nextDailyBonusClaimAt(bettor.lastFreeClaimAt);
    if (nextClaimAt && now < nextClaimAt) {
      return { ok: false, nextClaimAt };
    }

    const updated = await tx.bettor.update({
      where: bettorKey,
      data: { balance: { increment: DAILY_BONUS_AMOUNT }, lastFreeClaimAt: now },
    });

    return { ok: true, amount: DAILY_BONUS_AMOUNT, balanceAfter: updated.balance };
  });
}

// "2h 14min" / "38min" — usado por el bot y la web para decir cuánto falta para el próximo bono.
export function formatCountdown(target: Date, nowMs: number): string {
  const ms = Math.max(0, target.getTime() - nowMs);
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export type PlaceBetResult =
  | { ok: true; amount: number; balanceAfter: number }
  | { ok: false; error: string };

export async function placeBet(
  roundId: string,
  discordUserId: string,
  discordUsername: string,
  guess: boolean,
  rawAmountText: string
): Promise<PlaceBetResult> {
  const round = await prisma.predictionRound.findUnique({ where: { id: roundId } });
  if (!round || round.status !== "open") {
    return { ok: false, error: "Esta apuesta ya cerró." };
  }
  if (!isRoundWindowOpen(round.createdAt, Date.now())) {
    return { ok: false, error: "Se pasó la ventana de 5 minutos para apostar en esta partida." };
  }

  const rankingId = round.rankingId;
  const bettorKey = { rankingId_discordUserId: { rankingId, discordUserId } };

  return prisma.$transaction(async (tx) => {
    // Una sola apuesta por ronda y por cuenta de Discord, sin importar si se cargó desde el
    // bot o desde la web (las fichas están atadas a la cuenta, no al canal por el que se
    // entra): la primera que se registra queda firme, no se puede pisar ni cambiar de idea
    // después de ver más de la partida.
    const existing = await tx.prediction.findUnique({
      where: { roundId_discordUserId: { roundId, discordUserId } },
    });
    if (existing) {
      return { ok: false, error: "Ya apostaste en esta partida." };
    }

    const bettor = await tx.bettor.upsert({
      where: bettorKey,
      update: { discordUsername },
      create: { discordUserId, discordUsername, balance: STARTING_BALANCE, rankingId },
    });

    const amount = parseWagerAmount(rawAmountText, bettor.balance);

    await tx.bettor.update({
      where: bettorKey,
      data: { balance: { decrement: amount } },
    });
    await tx.prediction.create({
      data: { roundId, discordUserId, discordUsername, guess, amount, rankingId: round.rankingId },
    });

    return { ok: true, amount, balanceAfter: bettor.balance - amount };
  });
}

export async function resolvePredictions(
  predictions: Prediction[],
  result: boolean,
  rankingId: string
): Promise<{ correct: (Prediction & { payout: number })[]; wrong: Prediction[] }> {
  const correct: (Prediction & { payout: number })[] = [];
  const wrong: Prediction[] = [];

  for (const p of predictions) {
    if (p.guess === result) {
      const payout = potentialPayout(p.amount);
      await prisma.bettor.update({
        where: { rankingId_discordUserId: { rankingId, discordUserId: p.discordUserId } },
        data: { balance: { increment: payout } },
      });
      correct.push({ ...p, payout });
    } else {
      wrong.push(p);
    }
  }

  return { correct, wrong };
}
