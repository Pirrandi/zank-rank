import { prisma } from "./prisma";
import { tierLabel } from "./tier-colors";
import { winrate } from "./queue-stats";

const SOLO_QUEUE_TYPE = "RANKED_SOLO_5x5";

// PR10: the ranking is always resolved by the caller now — the bot preview route resolves it
// from `?ws=<slug>`, and the Discord bot interactions endpoint resolves it from the interacting
// guild's link (design D12, src/lib/bot-ranking.ts). No more root-ranking fallback here.
export async function buildRankReply(jugador: string, rankingId: string): Promise<string> {
  const separatorIndex = jugador.lastIndexOf("#");
  if (separatorIndex === -1) {
    return `No entendí a quién buscás. Usá el formato \`nombre#tag\`.`;
  }
  const gameName = jugador.slice(0, separatorIndex);
  const tagLine = jugador.slice(separatorIndex + 1);

  const account = await prisma.trackedAccount.findFirst({
    where: { gameName, tagLine, rankingId },
  });

  if (!account) {
    return `No encontré a **${jugador}** en el ranking. Fijate que esté bien escrito.`;
  }

  const snapshot = await prisma.rankSnapshot.findFirst({
    where: { accountId: account.id, queueType: SOLO_QUEUE_TYPE, rankingId },
    orderBy: { capturedAt: "desc" },
  });

  if (!snapshot) {
    return `**${account.gameName}#${account.tagLine}** todavía no tiene datos de Solo/Dúo. Que juegue algo primero.`;
  }

  const label = tierLabel(snapshot.tier, snapshot.rank);
  const wr = winrate(snapshot.wins, snapshot.losses);

  return (
    `📊 **${account.gameName}#${account.tagLine}** — Solo/Dúo\n` +
    `**${label}** · ${snapshot.leaguePoints} LP\n` +
    `${snapshot.wins}W ${snapshot.losses}L · ${wr} winrate`
  );
}
