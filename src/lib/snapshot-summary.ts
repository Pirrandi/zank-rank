import { Prisma, type RankSnapshot } from "@prisma/client";
import { prisma } from "./prisma";
import { getLpScore } from "./rank-order";

// RankSnapshot grows without bound (one row per account/queue per poll), so pages must never
// load the whole series. These helpers fetch only the few rows the derived stats need, each
// through the (accountId, queueType, capturedAt) index, and return a small ascending array
// that the existing derive.ts / queue-stats.ts functions consume unchanged.

// Cap on how many sparkline points are returned per (account, queue).
const SPARKLINE_MAX_POINTS = 60;
// How long a ranking's sparkline series is reused before being recomputed in the background.
const SPARKLINE_TTL_MS = 5 * 60 * 1000;

function startOfToday(): Date {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
}

// De-duplicates by id (so reference equality checks like `baseline === latest` in
// lpDeltaToday still hold) and sorts ascending by capture time.
function toAscending(rows: (RankSnapshot | null | undefined)[]): RankSnapshot[] {
  const byId = new Map<string, RankSnapshot>();
  for (const row of rows) {
    if (row && !byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
}

// Ascending, at most [first, baseline, previous, latest]; empty when there are no snapshots.
// Feed it to buildQueueStats(reversed) / lpDeltaToday / totalLpGained / rankMove.
export type QueueSnapshotSummary = { ascending: RankSnapshot[] };

// Everything the derived stats need for one (account, queue): the first snapshot (total LP
// gained), the last two (rank move, latest fields) and the latest one before today (LP delta
// today).
export async function getQueueSnapshotSummary(accountId: string, queueType: string): Promise<QueueSnapshotSummary> {
  const where = { accountId, queueType };
  const [first, baseline, lastTwoDesc] = await Promise.all([
    prisma.rankSnapshot.findFirst({ where, orderBy: { capturedAt: "asc" } }),
    prisma.rankSnapshot.findFirst({ where: { ...where, capturedAt: { lt: startOfToday() } }, orderBy: { capturedAt: "desc" } }),
    prisma.rankSnapshot.findMany({ where, orderBy: { capturedAt: "desc" }, take: 2 }),
  ]);
  return { ascending: toAscending([first, baseline, lastTwoDesc[1], lastTwoDesc[0]]) };
}

// Same as the summary above but for every account of a ranking and the given queues, in
// parallel. Keyed `${accountId}:${queueType}`.
export async function getQueueSnapshotSummaries(
  accountIds: string[],
  queueTypes: string[]
): Promise<Map<string, QueueSnapshotSummary>> {
  const pairs = accountIds.flatMap((accountId) => queueTypes.map((queueType) => ({ accountId, queueType })));
  const results = await Promise.all(pairs.map((p) => getQueueSnapshotSummary(p.accountId, p.queueType)));
  return new Map(pairs.map((p, i) => [`${p.accountId}:${p.queueType}`, results[i]]));
}

// Latest snapshot per queue for one account, or undefined when the queue has none.
export function getLatestSnapshot(accountId: string, queueType: string): Promise<RankSnapshot | null> {
  return prisma.rankSnapshot.findFirst({ where: { accountId, queueType }, orderBy: { capturedAt: "desc" } });
}

// Ascending [reference, latest] for the LP move over a trailing window: the latest snapshot
// plus the earliest one still inside the window. Feed it to lpDropOverWindow unchanged; it
// returns undefined when no other snapshot falls inside the window.
export async function getWindowSnapshots(accountId: string, queueType: string, windowMs: number, now: number = Date.now()): Promise<RankSnapshot[]> {
  const [reference, latest] = await Promise.all([
    prisma.rankSnapshot.findFirst({ where: { accountId, queueType, capturedAt: { gte: new Date(now - windowMs) } }, orderBy: { capturedAt: "asc" } }),
    getLatestSnapshot(accountId, queueType),
  ]);
  return toAscending([reference, latest]);
}

type SparklineEntry = { at: number; data?: Map<string, number[]>; loading?: Promise<Map<string, number[]>> };
const sparklineCache = new Map<string, SparklineEntry>();

async function loadSparklines(rankingId: string, queueTypes: string[]): Promise<Map<string, number[]>> {
  // Only rows where the rank/LP differs from the previous snapshot of the same series are kept
  // (polls that saw no change are the vast majority), newest SPARKLINE_MAX_POINTS per series.
  // The window scan reads every snapshot of the ranking, so callers go through the cache below.
  const rows = await prisma.$queryRaw<{ accountId: string; queueType: string; tier: string; rank: string; leaguePoints: number }[]>`
    SELECT accountId, queueType, tier, rank, leaguePoints FROM (
      SELECT accountId, queueType, tier, rank, leaguePoints,
             ROW_NUMBER() OVER (PARTITION BY accountId, queueType ORDER BY capturedAt DESC) AS rn
      FROM (
        SELECT accountId, queueType, tier, rank, leaguePoints, capturedAt,
               LAG(tier) OVER w AS prevTier, LAG(rank) OVER w AS prevRank, LAG(leaguePoints) OVER w AS prevLp
        FROM RankSnapshot
        WHERE workspaceId = ${rankingId} AND queueType IN (${Prisma.join(queueTypes)})
        WINDOW w AS (PARTITION BY accountId, queueType ORDER BY capturedAt)
      ) WHERE prevTier IS NULL OR prevTier <> tier OR prevRank <> rank OR prevLp <> leaguePoints
    ) WHERE rn <= ${SPARKLINE_MAX_POINTS}
    ORDER BY accountId, queueType, rn DESC`;

  const out = new Map<string, number[]>();
  for (const row of rows) {
    const key = `${row.accountId}:${row.queueType}`;
    const list = out.get(key) ?? [];
    list.push(getLpScore({ tier: row.tier, rank: row.rank, leaguePoints: Number(row.leaguePoints) }));
    out.set(key, list);
  }
  return out;
}

// LP-score series (oldest to newest, one point per real change) per `${accountId}:${queueType}`
// of a ranking, for the ladder sparklines. Stale-while-revalidate: after the first load it is
// served from memory and refreshed in the background once older than the TTL, because building
// it scans the whole ranking's history and a sparkline is decorative, not live data.
export async function getSparklines(rankingId: string, queueTypes: string[]): Promise<Map<string, number[]>> {
  const cacheKey = `${rankingId}|${queueTypes.join(",")}`;
  const entry = sparklineCache.get(cacheKey);
  const refresh = () => {
    const loading = loadSparklines(rankingId, queueTypes).then(
      (data) => {
        sparklineCache.set(cacheKey, { at: Date.now(), data });
        return data;
      },
      (err) => {
        // Keep serving the previous series (if any) and retry on the next request.
        const prev = sparklineCache.get(cacheKey);
        sparklineCache.set(cacheKey, { at: prev?.at ?? 0, data: prev?.data });
        throw err;
      }
    );
    sparklineCache.set(cacheKey, { at: entry?.at ?? 0, data: entry?.data, loading });
    return loading;
  };

  if (!entry) return refresh();
  if (entry.data && Date.now() - entry.at < SPARKLINE_TTL_MS) return entry.data;
  if (entry.loading) return entry.data ?? entry.loading;
  const loading = refresh();
  if (entry.data) {
    loading.catch(() => {});
    return entry.data;
  }
  return loading;
}
