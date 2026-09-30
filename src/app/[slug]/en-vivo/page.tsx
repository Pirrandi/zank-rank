import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveGame, type ActiveGame } from "@/lib/riot";
import { getChampionDisplayName, getChampionIconUrl, getChampionSplashUrl } from "@/lib/ddragon";
import { isRoundWindowOpen, potentialPayout, nextDailyBonusClaimAt, formatCountdown } from "@/lib/betting";
import { requireRankingView } from "@/lib/ranking-policy";
import type { RankingAccess } from "@/lib/ranking-access";
import { PrivateRankingGate } from "@/app/private-ranking-gate";
import { RankingShell } from "../_ui/shell/ranking-shell";
import { LiveView, type LiveBalance, type LiveClaimState } from "../_ui/live/live-view";
import type { LiveBetState, LiveCardData } from "../_ui/live/live-card";

export const dynamic = "force-dynamic";

const QUEUE_LABELS: Record<number, string> = {
  420: "Solo/Dúo",
  440: "Flexible",
  400: "Normal (Draft)",
  430: "Normal (Ciego)",
  490: "Normal (Rápida)",
  450: "ARAM",
  700: "Clash",
  0: "Personalizada",
};

async function safe<T>(p: Promise<T>): Promise<T | undefined> {
  try {
    return await p;
  } catch {
    return undefined;
  }
}

// Resolves what the viewer can do with this game's open round (if any). Pure read: the only
// write path is placeWebBetAction.
//
// Several tracked friends in the same live game share one PredictionRound (poll.ts creates just
// one per game+team+ranking, not one per player), so every one of their cards must resolve to
// the SAME round — betting from any card locks it everywhere. If tracked friends ended up split
// across teams, each side got its own round; match by team so a card never shows the enemy's bet.
async function resolveBetState(
  access: RankingAccess,
  puuidByAccountId: Map<string, string>,
  participants: ActiveGame["participants"],
  teamId: number,
  gameId: string,
  loginHref: string,
  nowMs: number,
): Promise<LiveBetState> {
  const openRounds = await prisma.predictionRound.findMany({
    where: { gameId, status: "open", rankingId: access.ranking.id },
    orderBy: { createdAt: "desc" },
  });
  const round =
    openRounds.find((r) => {
      const ownerPuuid = puuidByAccountId.get(r.accountId);
      return participants.find((p) => p.puuid === ownerPuuid)?.teamId === teamId;
    }) ?? openRounds[0];
  if (!round) return { kind: "none" };

  const user: User | null = access.user;
  if (user) {
    const existing = await prisma.prediction.findUnique({
      where: { roundId_discordUserId: { roundId: round.id, discordUserId: user.discordId } },
    });
    if (existing) {
      return { kind: "placed", amount: existing.amount, guess: existing.guess, payout: potentialPayout(existing.amount) };
    }
  }
  if (!isRoundWindowOpen(round.createdAt, nowMs)) return { kind: "closed" };
  if (!user) return { kind: "login", loginHref };
  if (!access.canInteract) return { kind: "blocked", reason: "No podés apostar en este ranking." };
  return { kind: "open", roundId: round.id };
}

export default async function EnVivoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = `/${slug}/en-vivo`;
  const access = await requireRankingView(slug, path);
  if (!access.canView) {
    return (
      <RankingShell slug={slug} access={access} path={path}>
        <PrivateRankingGate />
      </RankingShell>
    );
  }
  const rankingId = access.ranking.id;
  const loginHref = `/api/auth/discord?next=${encodeURIComponent(path)}`;
  const nowMs = Date.now();

  const accounts = await prisma.trackedAccount.findMany({ where: { rankingId } });
  const inGame = accounts.filter((a) => a.inGame);
  const puuidByAccountId = new Map(accounts.map((a) => [a.id, a.puuid]));

  // Sequential on purpose: spectator calls share the Riot key's rate limit with the poller.
  const games = new Map<string, ActiveGame | null>();
  for (const a of inGame) {
    try {
      games.set(a.id, await getActiveGame(a.puuid, a.platform));
    } catch (err) {
      console.error(`Failed to load live game for ${a.gameName}#${a.tagLine}:`, err);
      games.set(a.id, null);
    }
  }

  const cards: LiveCardData[] = [];
  for (const account of inGame) {
    const game = games.get(account.id);
    if (!game) continue;
    const me = game.participants.find((p) => p.puuid === account.puuid);
    if (!me) continue;

    const withNames: string[] = [];
    const vsNames: string[] = [];
    for (const p of game.participants) {
      if (p.puuid === account.puuid) continue;
      const friend = accounts.find((a) => a.puuid === p.puuid);
      if (!friend) continue;
      (p.teamId === me.teamId ? withNames : vsNames).push(friend.gameName);
    }

    const [championName, iconUrl, splashUrl, bet] = await Promise.all([
      safe(getChampionDisplayName(me.championId)),
      safe(getChampionIconUrl(me.championId)),
      safe(getChampionSplashUrl(me.championId)),
      resolveBetState(access, puuidByAccountId, game.participants, me.teamId, String(game.gameId), loginHref, nowMs),
    ]);

    cards.push({
      accountId: account.id,
      name: account.gameName,
      championName: championName ?? "Campeón desconocido",
      iconUrl,
      splashUrl,
      queueLabel: QUEUE_LABELS[game.gameQueueConfigId] ?? "Otra cola",
      // Spectator reports 0 while the game is still loading.
      startedAtMs: game.gameStartTime && game.gameStartTime > 0 ? game.gameStartTime : null,
      withNames,
      vsNames,
      bet,
    });
  }

  let balance: LiveBalance = { kind: "login", loginHref };
  let claim: LiveClaimState = { kind: "login", loginHref };
  if (access.user) {
    const bettor = await prisma.bettor.findUnique({
      where: { rankingId_discordUserId: { rankingId, discordUserId: access.user.discordId } },
    });
    balance = bettor ? { kind: "value", amount: bettor.balance } : { kind: "none" };

    if (!access.canInteract) {
      claim = { kind: "blocked" };
    } else {
      const nextClaimAt = nextDailyBonusClaimAt(bettor?.lastFreeClaimAt ?? null);
      claim =
        !nextClaimAt || nowMs >= nextClaimAt.getTime()
          ? { kind: "available" }
          : { kind: "cooldown", remaining: formatCountdown(nextClaimAt, nowMs) };
    }
  }

  return (
    <RankingShell slug={slug} access={access} path={path}>
      <LiveView slug={slug} cards={cards} balance={balance} claim={claim} renderedAtMs={nowMs} />
    </RankingShell>
  );
}
