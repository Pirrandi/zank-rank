import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getRankedEntries, getMatchIds, getMatchDetail, getSummonerByPuuid, getActiveGame, type MatchParticipant, type MatchDetail } from "../src/lib/riot";
import { divisionIndex, getLpScore } from "../src/lib/rank-order";
import { tierLabel, TIER_COLORS, UNRANKED_COLOR, WIN_COLOR, LOSS_COLOR, FLAT_COLOR } from "../src/lib/tier-colors";
import { sendRankChangeAlert, sendPredictionRound, closePredictionMessage, sendMatchRecapEmbed, sendGroupMatchRecapEmbed, type PredictionPlayer } from "../src/lib/discord";
import { getChampionDisplayName, getProfileIconUrl } from "../src/lib/ddragon";
import { getChampionEmoji, getItemEmoji, getOrUploadPlayerEmoji, tierLabelWithEmoji } from "../src/lib/discord-emojis";
import { generateRoast } from "../src/lib/groq";
import { resolvePredictions } from "../src/lib/betting";

const prisma = new PrismaClient();
const POLL_DELAY_MS = 120;

const QUEUE_LABELS: Record<string, string> = {
  RANKED_SOLO_5x5: "Solo/Dúo",
  RANKED_FLEX_SR: "Flexible",
};

const RANKED_QUEUE_IDS: Record<string, number> = {
  RANKED_SOLO_5x5: 420,
  RANKED_FLEX_SR: 440,
};

const QUEUE_TYPE_BY_CONFIG_ID: Record<number, string> = {
  420: "RANKED_SOLO_5x5",
  440: "RANKED_FLEX_SR",
};

const ROAST_STYLE_GUIDE =
  "Sos un cabro chileno escribiendo un comentario corto en el Discord de tu grupo de amigos. Hablá natural, como se escribe realmente entre amigos por chat — nada de forzar modismos ni acumular varios juntos en la misma frase (no uses 'po', 'weón' y 'cachai' todos apretados). Como mucho un chilenismo si de verdad suma, y puede que ni haga falta ninguno. Directo, con humor seco, sin sonar a caricatura ni a alguien tratando de sonar chileno.";

function buildRoastPrompt(situation: string): string {
  return `${ROAST_STYLE_GUIDE} ${situation} Máximo 18 palabras, sin comillas, sin emojis, solo la frase.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Account = Awaited<ReturnType<typeof prisma.trackedAccount.findMany>>[number];

type NewRankedMatch = {
  matchId: string;
  queueId: number;
  gameDuration: number;
  participant: MatchParticipant;
  enemyParticipant?: MatchParticipant;
};

type PendingRecap = {
  account: { gameName: string; tagLine: string; profileIconId: number | null; rankingId: string };
  match: NewRankedMatch;
  queueLabel: string;
  rankLabel: string | undefined;
  lp: number | undefined;
  lpDelta: number | undefined;
};

type GroupMatchResult = { inserted: number; newRankedMatches: NewRankedMatch[] };

// D9: the same puuid can be tracked as a separate TrackedAccount row in several rankings.
// Match details are fetched at most once per run per matchId (this cache), independent of
// how many rankings' accounts need a participation row for it.
async function ensureMatchDetail(matchId: string, cache: Map<string, MatchDetail>): Promise<MatchDetail> {
  const cached = cache.get(matchId);
  if (cached) return cached;
  const detail = await getMatchDetail(matchId, "americas");
  await sleep(POLL_DELAY_MS);
  cache.set(matchId, detail);
  return detail;
}

// One Riot call for match ids (shared across the whole group, since they track the same
// real puuid). Match rows are global and upserted once; MatchParticipation fans out per
// account row (i.e. per ranking) so isolation stays at the tenant level.
export async function pollGroupMatches(
  group: Account[],
  puuid: string,
  matchDetailCache: Map<string, MatchDetail>
): Promise<Map<string, GroupMatchResult>> {
  const matchIds = await getMatchIds(puuid, "americas", 10);
  await sleep(POLL_DELAY_MS);

  const existingByAccount = new Map<string, Set<string>>();
  for (const acc of group) {
    const existing = await prisma.matchParticipation.findMany({
      where: { accountId: acc.id, matchId: { in: matchIds } },
      select: { matchId: true },
    });
    existingByAccount.set(acc.id, new Set(existing.map((e) => e.matchId)));
  }

  const resultByAccount = new Map<string, GroupMatchResult>();
  for (const acc of group) resultByAccount.set(acc.id, { inserted: 0, newRankedMatches: [] });

  for (const matchId of matchIds) {
    const accountsNeeding = group.filter((a) => !existingByAccount.get(a.id)!.has(matchId));
    if (accountsNeeding.length === 0) continue; // every tracked row in this group already has it

    const detail = await ensureMatchDetail(matchId, matchDetailCache);
    const participant = detail.info.participants.find((p) => p.puuid === puuid);
    if (!participant) continue;

    await prisma.match.upsert({
      where: { id: matchId },
      update: {},
      create: {
        id: matchId,
        queueId: detail.info.queueId,
        gameCreation: new Date(detail.info.gameCreation),
        gameDuration: detail.info.gameDuration,
      },
    });

    const isRanked = Object.values(RANKED_QUEUE_IDS).includes(detail.info.queueId);
    const enemyParticipant = isRanked
      ? detail.info.participants.find(
          (p) => p.teamId !== participant.teamId && p.teamPosition === participant.teamPosition
        )
      : undefined;

    for (const acc of accountsNeeding) {
      await prisma.matchParticipation.create({
        data: {
          matchId,
          accountId: acc.id,
          championName: participant.championName,
          championId: participant.championId,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          win: participant.win,
          teamId: participant.teamId,
          doubleKills: participant.doubleKills,
          tripleKills: participant.tripleKills,
          quadraKills: participant.quadraKills,
          pentaKills: participant.pentaKills,
          epicSteals: participant.challenges?.epicMonsterSteals ?? 0,
          rankingId: acc.rankingId,
        },
      });

      const res = resultByAccount.get(acc.id)!;
      res.inserted++;
      if (isRanked) {
        res.newRankedMatches.push({
          matchId,
          queueId: detail.info.queueId,
          gameDuration: detail.info.gameDuration,
          participant,
          enemyParticipant,
        });
      }
    }
  }

  return resultByAccount;
}

function formatGameDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

async function sendRecapForMatch(
  account: { gameName: string; tagLine: string; profileIconId: number | null; rankingId: string },
  match: NewRankedMatch,
  queueLabel: string,
  rankLabel: string | undefined,
  lp: number | undefined,
  lpDelta: number | undefined
): Promise<void> {
  const { participant, enemyParticipant } = match;

  const [championName, enemyChampionName, profileIconUrl] = await Promise.all([
    getChampionDisplayName(participant.championId),
    enemyParticipant ? getChampionDisplayName(enemyParticipant.championId) : Promise.resolve(undefined),
    account.profileIconId !== null ? getProfileIconUrl(account.profileIconId) : Promise.resolve(undefined),
  ]);

  const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
  const csPerMin = match.gameDuration > 0 ? cs / (match.gameDuration / 60) : 0;
  const killParticipationPct = participant.challenges?.killParticipation
    ? participant.challenges.killParticipation * 100
    : undefined;

  const itemIds = [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
  ].filter((id) => id > 0);
  const itemEmojis = itemIds.map((id) => getItemEmoji(id)).filter((e): e is string => Boolean(e));

  const highlightBits: string[] = [];
  if (participant.pentaKills > 0) highlightBits.push(`una PENTAKILL`);
  else if (participant.quadraKills > 0) highlightBits.push(`una quadrakill`);
  else if (participant.tripleKills > 0) highlightBits.push(`una triple kill`);
  if ((participant.challenges?.epicMonsterSteals ?? 0) > 0) highlightBits.push(`robó un objetivo épico`);
  if (killParticipationPct !== undefined && killParticipationPct >= 70) highlightBits.push(`${Math.round(killParticipationPct)}% de participación en kills`);

  const situation =
    highlightBits.length > 0
      ? `Escribí una línea corta y punchy destacando que ${account.gameName}#${account.tagLine} tuvo ${highlightBits.join(" y ")} jugando ${championName ?? participant.championName}, en una partida que ${participant.win ? "ganó" : "perdió"}.`
      : `Escribí una línea corta y punchy resumiendo la partida de ${account.gameName}#${account.tagLine} con ${championName ?? participant.championName} (${participant.kills}/${participant.deaths}/${participant.assists}), que ${participant.win ? "ganó" : "perdió"}.`;

  const footerText = await generateRoast(buildRoastPrompt(situation));

  try {
    await sendMatchRecapEmbed(account.rankingId, {
      gameName: account.gameName,
      tagLine: account.tagLine,
      profileIconUrl: profileIconUrl ?? "",
      win: participant.win,
      queueLabel,
      gameDurationLabel: formatGameDuration(match.gameDuration),
      championEmoji: getChampionEmoji(participant.championId),
      championName: championName ?? participant.championName,
      enemyChampionEmoji: enemyParticipant ? getChampionEmoji(enemyParticipant.championId) : undefined,
      enemyChampionName,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      killParticipationPct,
      cs,
      csPerMin,
      damage: participant.totalDamageDealtToChampions,
      rankLabel,
      lp,
      lpDelta,
      itemEmojis,
      footerText,
    });
  } catch (err) {
    console.error(`Failed to send match recap for ${account.gameName}#${account.tagLine} (${match.matchId}):`, err);
  }
}

async function sendGroupRecapForMatch(recaps: PendingRecap[]): Promise<void> {
  const first = recaps[0];
  const gameDurationLabel = formatGameDuration(first.match.gameDuration);

  const players = await Promise.all(
    recaps.map(async (r) => {
      const p = r.match.participant;
      const [championName, profileIconEmoji] = await Promise.all([
        getChampionDisplayName(p.championId),
        getOrUploadPlayerEmoji(r.account.profileIconId),
      ]);
      const itemIds = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((id) => id > 0);
      return {
        gameName: r.account.gameName,
        tagLine: r.account.tagLine,
        win: p.win,
        profileIconEmoji,
        championEmoji: getChampionEmoji(p.championId),
        championName: championName ?? p.championName,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        damage: p.totalDamageDealtToChampions,
        rankLabel: r.rankLabel,
        lpDelta: r.lpDelta,
        itemEmojis: itemIds.map((id) => getItemEmoji(id)).filter((e): e is string => Boolean(e)),
      };
    })
  );

  const allWon = recaps.every((r) => r.match.participant.win);
  const allLost = recaps.every((r) => !r.match.participant.win);
  const colorHex = allWon ? WIN_COLOR : allLost ? LOSS_COLOR : FLAT_COLOR;
  const resultLabel = allWon ? "VICTORIA" : allLost ? "DERROTA" : "RESULTADO MIXTO";

  const winners = recaps.filter((r) => r.match.participant.win).map((r) => r.account.gameName);
  const losers = recaps.filter((r) => !r.match.participant.win).map((r) => r.account.gameName);

  const kdaScore = (p: MatchParticipant) => (p.deaths === 0 ? p.kills + p.assists : (p.kills + p.assists) / p.deaths);
  const standout = recaps.reduce((best, r) =>
    kdaScore(r.match.participant) > kdaScore(best.match.participant) ? r : best
  , recaps[0]);
  const pentaPlayer = recaps.find((r) => r.match.participant.pentaKills > 0);

  const situationBits: string[] = [];
  if (allWon) situationBits.push(`el grupo ganó completo`);
  else if (allLost) situationBits.push(`el grupo perdió completo`);
  else situationBits.push(`resultado mixto: ganaron ${winners.join(", ")} y perdieron ${losers.join(", ")}`);
  if (pentaPlayer) situationBits.push(`${pentaPlayer.account.gameName} hizo una PENTAKILL`);

  const situation = `Escribí una línea corta y punchy sobre una partida en grupo de ${recaps.length} amigos jugando juntos: ${situationBits.join(", ")}. El que mejor la rompió fue ${standout.account.gameName} con ${standout.match.participant.kills}/${standout.match.participant.deaths}/${standout.match.participant.assists}.`;

  const roast = await generateRoast(buildRoastPrompt(situation));
  const fallbackFooter = allWon
    ? `¡${recaps.length} del grupo ganaron juntos! 🏆`
    : allLost
      ? `${recaps.length} del grupo cayeron juntos en esta 💀`
      : `Resultado mixto para el grupo en esta partida.`;

  try {
    await sendGroupMatchRecapEmbed(first.account.rankingId, {
      queueLabel: first.queueLabel,
      gameDurationLabel,
      resultLabel,
      players,
      colorHex,
      footerText: roast ?? fallbackFooter,
    });
  } catch (err) {
    console.error(`Failed to send group match recap for match ${first.match.matchId}:`, err);
  }
}

async function resolveOpenPredictionRounds(accountId: string, gameName: string, tagLine: string): Promise<void> {
  const account = await prisma.trackedAccount.findUnique({ where: { id: accountId } });
  if (!account) return;

  const openRounds = await prisma.predictionRound.findMany({
    where: { accountId, status: "open", gameId: { not: null } },
    include: { predictions: true },
  });

  for (const round of openRounds) {
    const expectedMatchId = `${account.platform.toUpperCase()}_${round.gameId}`;
    const finishedMatch = await prisma.matchParticipation.findFirst({
      where: { accountId, matchId: expectedMatchId },
    });
    if (!finishedMatch) continue;

    const result = finishedMatch.win;
    await prisma.predictionRound.update({
      where: { id: round.id },
      data: { status: "resolved", result, resolvedAt: new Date(), matchId: finishedMatch.matchId },
    });

    await resolvePredictions(round.predictions, result, round.rankingId);
    const outcomeLabel = result ? "GANÓ 🎉" : "PERDIÓ 💀";
    const tag = `${gameName}#${tagLine}`;

    try {
      await closePredictionMessage(round.messageId, round.rankingId, `Apuestas cerradas — ${tag} ${outcomeLabel}`);
    } catch (err) {
      console.error(`Failed to close prediction message for ${tag}:`, err);
    }
  }
}

export function groupKey(account: Pick<Account, "puuid" | "platform">): string {
  return `${account.puuid}:${account.platform}`;
}

// Exported for isolated verification (no Riot/DB access): groups tracked accounts by
// (puuid, platform) so callers can assert the same real player tracked in several rankings
// collapses into a single group before any Riot API call is made.
export function buildAccountGroups<T extends Pick<Account, "puuid" | "platform">>(accounts: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const account of accounts) {
    const key = groupKey(account);
    const list = groups.get(key) ?? [];
    list.push(account);
    groups.set(key, list);
  }
  return groups;
}

async function processGroup(
  group: Account[],
  allAccounts: Account[],
  matchDetailCache: Map<string, MatchDetail>,
  pendingRecapsByMatch: Map<string, PendingRecap[]>,
  keyExpiredLoggedRef: { value: boolean }
): Promise<void> {
  const representative = group[0];
  const { puuid, platform } = representative;

  // One profile-icon fetch per unique player group, applied to every ranking's row.
  if (group.some((a) => a.profileIconId === null)) {
    try {
      const summoner = await getSummonerByPuuid(puuid, platform);
      await sleep(POLL_DELAY_MS);
      await prisma.trackedAccount.updateMany({
        where: { id: { in: group.map((a) => a.id) } },
        data: { profileIconId: summoner.profileIconId },
      });
      for (const a of group) a.profileIconId = summoner.profileIconId;
    } catch (err) {
      console.error(`Failed to fetch profile icon for ${representative.gameName}#${representative.tagLine}:`, err);
    }
  }

  // One active-game check per group; predictions still fan out per ranking below.
  try {
    const activeGame = await getActiveGame(puuid, platform);
    await sleep(POLL_DELAY_MS);
    const isInGame = activeGame !== null;

    if (isInGame && !representative.inGame) {
      const queueType = activeGame && QUEUE_TYPE_BY_CONFIG_ID[activeGame.gameQueueConfigId];
      if (queueType) {
        for (const account of group) {
          try {
            const me = activeGame!.participants.find((p) => p.puuid === puuid);
            if (!me) continue;
            const gameId = String(activeGame!.gameId);

            // Friend-group matching stays scoped to the same ranking so a prediction round
            // never mixes players from two different tenants that happen to share a game.
            const matchedAccounts = allAccounts.filter(
              (a) => a.rankingId === account.rankingId && activeGame!.participants.some((p) => p.puuid === a.puuid)
            );

            const existingOpen = await prisma.predictionRound.findFirst({
              where: { gameId, status: "open", rankingId: account.rankingId },
            });
            if (existingOpen) {
              // Una ronda por partida y por ranking, no una por jugador seguido — evita mandar
              // el mismo aviso de apuestas una vez por cada amigo que entró a la misma partida.
              // Si el dueño de esa ronda quedó en el equipo contrario, esta cuenta arma su
              // propia ronda con la perspectiva de su equipo en vez de reusar la ajena.
              const ownerAccount = matchedAccounts.find((a) => a.id === existingOpen.accountId);
              const ownerParticipant = ownerAccount
                ? activeGame!.participants.find((p) => p.puuid === ownerAccount.puuid)
                : undefined;
              if (!ownerParticipant || ownerParticipant.teamId === me.teamId) continue;
            }

            const queueLabel = QUEUE_LABELS[queueType] ?? queueType;
            const matchedSnapshots = await Promise.all(
              matchedAccounts.map((a) =>
                prisma.rankSnapshot.findFirst({
                  where: { accountId: a.id, queueType },
                  orderBy: { capturedAt: "desc" },
                })
              )
            );
            const snapshot = matchedSnapshots[matchedAccounts.findIndex((a) => a.id === account.id)];
            const accentColor = snapshot
              ? (TIER_COLORS[snapshot.tier.toUpperCase()] ?? UNRANKED_COLOR).fg
              : "#E9FF1F";

            const ownTeam = activeGame!.participants.filter((p) => p.teamId === me.teamId).map((p) => p.championId);
            const enemyTeam = activeGame!.participants.filter((p) => p.teamId !== me.teamId).map((p) => p.championId);

            const allPlayers: {
              championId: number;
              tracked: boolean;
              name?: string;
              tag?: string;
            }[] = activeGame!.participants.map((p) => {
              const trackedAccount = matchedAccounts.find((a) => a.puuid === p.puuid);
              return trackedAccount
                ? { championId: p.championId, tracked: true, name: trackedAccount.gameName, tag: trackedAccount.tagLine }
                : { championId: p.championId, tracked: false };
            });

            // Cada campeón resuelve su emoji (mapa estático) y nombre (data dragon, cacheado) una
            // sola vez, sin generar ninguna imagen — mismo estilo liviano que los recaps.
            const toPredictionPlayers = (championIds: number[]): Promise<PredictionPlayer[]> =>
              Promise.all(
                championIds.map(async (championId) => {
                  const info = allPlayers.find((p) => p.championId === championId);
                  return {
                    championEmoji: getChampionEmoji(championId),
                    championName: await getChampionDisplayName(championId),
                    tracked: info?.tracked ?? false,
                    name: info?.name,
                    tag: info?.tag,
                  };
                })
              );
            const [team1, team2] = await Promise.all([
              toPredictionPlayers(ownTeam),
              toPredictionPlayers(enemyTeam),
            ]);

            const roundId = randomUUID();
            const messageId = await sendPredictionRound(account.rankingId, {
              accentColorHex: accentColor,
              queueLabel,
              team1,
              team2,
              winCustomId: `predict:win:${roundId}`,
              loseCustomId: `predict:lose:${roundId}`,
            });

            if (messageId) {
              await prisma.predictionRound.create({
                data: {
                  id: roundId,
                  accountId: account.id,
                  gameId,
                  queueType,
                  championId: me.championId,
                  messageId,
                  rankingId: account.rankingId,
                },
              });
            }
          } catch (err) {
            console.error(`Failed to start prediction round for ${account.gameName}#${account.tagLine}:`, err);
          }
        }
      }
    }

    if (isInGame !== representative.inGame) {
      await prisma.trackedAccount.updateMany({
        where: { id: { in: group.map((a) => a.id) } },
        data: { inGame: isInGame },
      });
    }
  } catch (err) {
    console.error(`Failed to check active game for ${representative.gameName}#${representative.tagLine}:`, err);
  }

  // One Riot call for match ids/details per group; writes fan out per account (ranking) below.
  let matchResultsByAccount: Map<string, GroupMatchResult>;
  try {
    matchResultsByAccount = await pollGroupMatches(group, puuid, matchDetailCache);
  } catch (err) {
    console.error(`Failed to poll matches for ${representative.gameName}#${representative.tagLine}:`, err);
    if (!keyExpiredLoggedRef.value && err instanceof Error && err.message.includes("401")) {
      console.error("RIOT KEY EXPIRED - regenerate at https://developer.riotgames.com/");
      keyExpiredLoggedRef.value = true;
    }
    return;
  }

  // One ranked-entries fetch per group; each ranking still gets its own RankSnapshot row.
  let entries: Awaited<ReturnType<typeof getRankedEntries>>;
  try {
    entries = await getRankedEntries(puuid, platform);
    await sleep(POLL_DELAY_MS);
  } catch (err) {
    console.error(`Failed to fetch ranked entries for ${representative.gameName}#${representative.tagLine}:`, err);
    return;
  }

  for (const account of group) {
    const { inserted: insertedMatches, newRankedMatches } = matchResultsByAccount.get(account.id) ?? { inserted: 0, newRankedMatches: [] };
    console.log(`  Matches for ${account.gameName}#${account.tagLine}: ${insertedMatches} new`);

    if (insertedMatches > 0) {
      await resolveOpenPredictionRounds(account.id, account.gameName, account.tagLine);
    }

    for (const entry of entries) {
      const previous = await prisma.rankSnapshot.findFirst({
        where: { accountId: account.id, queueType: entry.queueType },
        orderBy: { capturedAt: "desc" },
      });

      await prisma.rankSnapshot.create({
        data: {
          accountId: account.id,
          queueType: entry.queueType,
          tier: entry.tier,
          rank: entry.rank,
          leaguePoints: entry.leaguePoints,
          wins: entry.wins,
          losses: entry.losses,
          hotStreak: entry.hotStreak,
          rankingId: account.rankingId,
        },
      });

      const matchesForQueue = newRankedMatches.filter((m) => m.queueId === RANKED_QUEUE_IDS[entry.queueType]);
      for (const match of matchesForQueue) {
        // Keyed by (matchId, rankingId) — not matchId alone — so a group recap never mixes
        // players from different rankings even when the same puuid is tracked in several (D9)
        // or several unrelated rankings' friends happen to play the same custom game.
        const recapKey = `${match.matchId}:${account.rankingId}`;
        const list = pendingRecapsByMatch.get(recapKey) ?? [];
        list.push({
          account,
          match,
          queueLabel: QUEUE_LABELS[entry.queueType] ?? entry.queueType,
          rankLabel: tierLabelWithEmoji(entry.tier, entry.rank),
          lp: entry.leaguePoints,
          lpDelta: previous ? getLpScore(entry) - getLpScore(previous) : undefined,
        });
        pendingRecapsByMatch.set(recapKey, list);
      }

      if (previous && divisionIndex(entry) > divisionIndex(previous)) {
        const queueLabel = QUEUE_LABELS[entry.queueType] ?? entry.queueType;
        try {
          let lastMatchChampionId: number | undefined;
          try {
            const freshMatchIds = await getMatchIds(puuid, "americas", 1, RANKED_QUEUE_IDS[entry.queueType]);
            await sleep(POLL_DELAY_MS);
            if (freshMatchIds[0]) {
              const detail = await ensureMatchDetail(freshMatchIds[0], matchDetailCache);
              lastMatchChampionId = detail.info.participants.find((p) => p.puuid === puuid)?.championId;
            }
          } catch {
            const lastMatch = await prisma.matchParticipation.findFirst({
              where: { accountId: account.id, match: { queueId: RANKED_QUEUE_IDS[entry.queueType] } },
              include: { match: true },
              orderBy: { match: { gameCreation: "desc" } },
            });
            lastMatchChampionId = lastMatch?.championId;
          }

          const championDisplayName =
            lastMatchChampionId !== undefined ? await getChampionDisplayName(lastMatchChampionId) : undefined;

          const hype = await generateRoast(
            buildRoastPrompt(
              `Escribí una frase de hype celebrando que ${account.gameName}#${account.tagLine} subió a ${tierLabel(entry.tier, entry.rank)} en ${queueLabel}${championDisplayName ? ` jugando ${championDisplayName}` : ""}.`
            )
          );

          await sendRankChangeAlert(account.rankingId, {
            gameName: account.gameName,
            tagLine: account.tagLine,
            profileIconUrl: account.profileIconId !== null ? await getProfileIconUrl(account.profileIconId) : undefined,
            up: true,
            queueLabel,
            championEmoji: lastMatchChampionId !== undefined ? getChampionEmoji(lastMatchChampionId) : undefined,
            championName: championDisplayName,
            rankLabel: tierLabelWithEmoji(entry.tier, entry.rank),
            lp: entry.leaguePoints,
            summary: hype ?? `Subió a ${tierLabel(entry.tier, entry.rank)}.`,
          });
        } catch (err) {
          console.error(`Failed to send Discord rank-up alert for ${account.gameName}#${account.tagLine}:`, err);
        }
      }

      if (previous && divisionIndex(entry) < divisionIndex(previous)) {
        const queueLabel = QUEUE_LABELS[entry.queueType] ?? entry.queueType;
        const newLabel = tierLabel(entry.tier, entry.rank);
        try {
          const roast = await generateRoast(
            buildRoastPrompt(
              `Escribí un roast picante pero sin insultos graves ni groserías fuertes, buleando amistosamente a ${account.gameName}#${account.tagLine} porque bajó de rango a ${newLabel} en ${queueLabel}.`
            )
          );
          const fallback = `Bajó a **${newLabel}**. Qué vergüenza.`;
          await sendRankChangeAlert(account.rankingId, {
            gameName: account.gameName,
            tagLine: account.tagLine,
            profileIconUrl: account.profileIconId !== null ? await getProfileIconUrl(account.profileIconId) : undefined,
            up: false,
            queueLabel,
            rankLabel: tierLabelWithEmoji(entry.tier, entry.rank),
            lp: entry.leaguePoints,
            summary: roast ?? fallback,
          });
        } catch (err) {
          console.error(`Failed to send Discord derank alert for ${account.gameName}#${account.tagLine}:`, err);
        }
      }
    }

    console.log(`Polled ${account.gameName}#${account.tagLine}: ${entries.length} queue entr${entries.length === 1 ? "y" : "ies"}`);
  }
}

async function main() {
  // Per-ranking players (design D9): poll every tracked account across every ranking by
  // default, or only one ranking's accounts when invoked with `--ranking <id>` (used by the
  // manual per-ranking sync trigger in PR9). Accounts are grouped by (puuid, platform) so
  // Riot API calls for a shared real player happen once per run, no matter how many rankings
  // track them; writes and alerts still fan out per ranking below.
  const rankingArgIndex = process.argv.indexOf("--ranking");
  const rankingFilter = rankingArgIndex !== -1 ? process.argv[rankingArgIndex + 1] : undefined;

  const accounts = await prisma.trackedAccount.findMany(
    rankingFilter ? { where: { rankingId: rankingFilter } } : undefined
  );

  const groups = buildAccountGroups(accounts);

  const matchDetailCache = new Map<string, MatchDetail>();
  const pendingRecapsByMatch = new Map<string, PendingRecap[]>();
  const keyExpiredLoggedRef = { value: false };

  for (const group of groups.values()) {
    try {
      await processGroup(group, accounts, matchDetailCache, pendingRecapsByMatch, keyExpiredLoggedRef);
    } catch (err) {
      console.error(`Failed to poll group for puuid ${group[0].puuid}:`, err);
    }
  }

  for (const [matchId, recaps] of pendingRecapsByMatch) {
    try {
      if (recaps.length === 1) {
        const r = recaps[0];
        await sendRecapForMatch(r.account, r.match, r.queueLabel, r.rankLabel, r.lp, r.lpDelta);
      } else {
        await sendGroupRecapForMatch(recaps);
      }
    } catch (err) {
      console.error(`Failed to send recap(s) for match ${matchId}:`, err);
    }
  }
}

// Guard so verification scripts can `import` the pure/DB helpers above (buildAccountGroups,
// pollGroupMatches) without triggering a real poll run against Riot.
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
