// Queue identities shared by the profile and the walls: the two ranked queues (with their
// snapshot queueType, URL param value and Riot queueId) plus a display label for any stored
// Match.queueId.

export type RankedQueueParam = "solo" | "flex";
export type RankedQueue = { param: RankedQueueParam; type: string; queueId: number; label: string };

export const RANKED_QUEUES: Record<RankedQueueParam, RankedQueue> = {
  solo: { param: "solo", type: "RANKED_SOLO_5x5", queueId: 420, label: "Solo/Dúo" },
  flex: { param: "flex", type: "RANKED_FLEX_SR", queueId: 440, label: "Flexible" },
};

export const CUSTOM_GAME_QUEUE_ID = 0;

// `?cola=` for the walls: Solo/Dúo unless it explicitly asks for Flex.
export function parseRankedQueueParam(value: string | undefined): RankedQueueParam {
  return value === "flex" ? "flex" : "solo";
}

// `?cola=` for the profile's match history: every queue unless it asks for one ranked queue.
export type MatchQueueFilter = "todas" | RankedQueueParam;
export function parseMatchQueueFilter(value: string | undefined): MatchQueueFilter {
  return value === "solo" || value === "flex" ? value : "todas";
}

const QUEUE_LABELS: Record<number, string> = {
  [CUSTOM_GAME_QUEUE_ID]: "Personalizada",
  400: "Normal",
  420: "Solo/Dúo",
  430: "Normal",
  440: "Flexible",
  450: "ARAM",
  480: "Rápida",
  490: "Rápida",
  700: "Clash",
  720: "ARAM Clash",
  900: "URF",
  1020: "Uno para todos",
  1300: "Nexus Blitz",
  1700: "Arena",
  1710: "Arena",
  1900: "URF",
};

// Co-op vs AI queues (830–899) collapse into one label; anything unknown is "Otra".
export function queueLabel(queueId: number): string {
  const known = QUEUE_LABELS[queueId];
  if (known) return known;
  if (queueId >= 830 && queueId < 900) return "Contra IA";
  return "Otra";
}
