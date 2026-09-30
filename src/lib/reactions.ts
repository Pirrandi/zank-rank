import { prisma } from "./prisma";

export type ReactionState = { counts: Record<string, number>; mine: string[] };

export async function getReactionStates(targetKeys: string[], userId: string | undefined, rankingId: string): Promise<Record<string, ReactionState>> {
  if (targetKeys.length === 0) return {};
  const rows = await prisma.reaction.findMany({
    where: { targetKey: { in: targetKeys }, rankingId },
  });

  const out: Record<string, ReactionState> = {};
  for (const key of targetKeys) out[key] = { counts: {}, mine: [] };

  for (const row of rows) {
    const state = out[row.targetKey];
    if (!state) continue;
    state.counts[row.label] = (state.counts[row.label] ?? 0) + 1;
    if (userId && row.userId === userId) state.mine.push(row.label);
  }

  return out;
}

export async function toggleReaction(targetKey: string, userId: string, label: string, rankingId: string): Promise<ReactionState> {
  const existing = await prisma.reaction.findUnique({
    where: { rankingId_targetKey_userId_label: { rankingId, targetKey, userId, label } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({ data: { targetKey, userId, label, rankingId } });
  }

  const states = await getReactionStates([targetKey], userId, rankingId);
  return states[targetKey] ?? { counts: {}, mine: [] };
}
