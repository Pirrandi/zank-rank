import { getCustomMatchups, getVersusKings } from "@/lib/customs";
import { championIconUrl } from "@/lib/champion-assets";
import { getProfileIconUrl } from "@/lib/ddragon";
import { formatRelativeTime } from "@/lib/relative-time";
import { requireRankingView } from "@/lib/ranking-policy";
import { PrivateRankingGate } from "@/app/private-ranking-gate";
import { RankingShell } from "../_ui/shell/ranking-shell";
import { VersusView } from "../_ui/versus/versus-view";
import type { VersusMatch } from "../_ui/versus/custom-match-card";
import type { VersusKingRow } from "../_ui/versus/versus-kings-card";

export const dynamic = "force-dynamic";

async function safeProfileIcon(profileIconId: number | null): Promise<string | undefined> {
  if (profileIconId === null) return undefined;
  try {
    return await getProfileIconUrl(profileIconId);
  } catch {
    return undefined;
  }
}

export default async function VersusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = `/${slug}/versus`;
  const access = await requireRankingView(slug, path);
  if (!access.canView) {
    return (
      <RankingShell slug={slug} access={access} path={path}>
        <PrivateRankingGate />
      </RankingShell>
    );
  }
  const rankingId = access.ranking.id;

  const [matchups, kings] = await Promise.all([getCustomMatchups(rankingId), getVersusKings(rankingId)]);

  // getCustomMatchups is already newest-first.
  const matches: VersusMatch[] = matchups.map((m) => {
    const toPlayer = (p: (typeof m.teamA)[number]) => ({
      accountId: p.accountId,
      name: p.gameName,
      championName: p.championName,
      iconUrl: championIconUrl(p.championName),
    });
    return {
      matchId: m.matchId,
      format: m.label,
      whenText: formatRelativeTime(m.gameCreation),
      teamA: m.teamA.map(toPlayer),
      teamB: m.teamB.map(toPlayer),
      teamAWon: m.teamA[0]?.win ?? false,
    };
  });

  const kingRows: VersusKingRow[] = await Promise.all(
    kings.map(async (k) => ({
      accountId: k.accountId,
      name: k.gameName,
      iconUrl: await safeProfileIcon(k.profileIconId),
      wins: k.wins,
      losses: k.losses,
    })),
  );

  return (
    <RankingShell slug={slug} access={access} path={path}>
      <VersusView slug={slug} matches={matches} kings={kingRows} />
    </RankingShell>
  );
}
