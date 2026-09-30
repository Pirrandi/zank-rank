import { prisma } from "./prisma";
import { updatePredictionMessageContent } from "./discord";

// Re-renders the "N personas apostaron — X fichas en juego" footer on a round's Discord
// message. Shared by the Discord modal flow and the web bet action so both keep the channel
// message in sync after a bet.
export async function refreshRoundStatsMessage(roundId: string): Promise<void> {
  const round = await prisma.predictionRound.findUnique({ where: { id: roundId } });
  if (!round) return;

  const stats = await prisma.prediction.aggregate({
    where: { roundId },
    _count: true,
    _sum: { amount: true },
  });
  const count = stats._count;
  const total = stats._sum.amount ?? 0;
  const statsLine = `📊 **${count}** ${count === 1 ? "persona apostó" : "personas apostaron"} — **${total}** fichas en juego`;

  // round.content ahora suele estar vacío (todo lo demás vive en el embed): sin esto, el
  // mensaje quedaba con dos saltos de línea en blanco antes de las estadísticas.
  const parts = [round.content, statsLine].filter((s) => s.trim().length > 0);
  await updatePredictionMessageContent(round.messageId, round.rankingId, parts.join("\n\n"));
}
