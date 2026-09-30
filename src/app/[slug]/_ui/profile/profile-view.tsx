import Link from "next/link";
import type { Badge } from "@/lib/player-profile";
import type { LpPoint } from "@/lib/lp-chart";
import { ProfileHero, type HeroData } from "./profile-hero";
import { LpHistoryCard } from "./lp-history-card";
import { RecentMatchesCard, type MatchQueueOption, type RecentMatchRow } from "./recent-matches-card";
import { AnalysisCard } from "./analysis-card";
import { AchievementsCard } from "./achievements-card";
import { RivalCompare, type Comparable, type RivalComparable } from "./rival-compare";

export type ProfileViewData = {
  hero: HeroData;
  chart: { points: LpPoint[]; rangeEndMs: number; color: string };
  matches: { rows: RecentMatchRow[]; options: MatchQueueOption[]; emptyText: string };
  analysis: { text: string | undefined; whenLabel: string | null };
  badges: Badge[];
  compare: { self: Comparable; rivals: RivalComparable[]; initialRivalId: string | null };
};

export function ProfileView({ slug, data }: { slug: string; data: ProfileViewData }) {
  return (
    <div className="zr-stack" style={{ gap: 18 }}>
      <Link href={`/${slug}`} className="zr-back">
        ← Volver
      </Link>
      <ProfileHero hero={data.hero} />
      <div className="zr-profile-grid">
        <div className="zr-stack zr-span-2" style={{ gap: 18 }}>
          <LpHistoryCard points={data.chart.points} rangeEndMs={data.chart.rangeEndMs} color={data.chart.color} />
          <RecentMatchesCard matches={data.matches.rows} options={data.matches.options} emptyText={data.matches.emptyText} />
        </div>
        <div className="zr-stack" style={{ gap: 18 }}>
          <AnalysisCard text={data.analysis.text} whenLabel={data.analysis.whenLabel} />
          <AchievementsCard badges={data.badges} />
          <RivalCompare self={data.compare.self} rivals={data.compare.rivals} initialRivalId={data.compare.initialRivalId} />
        </div>
      </div>
    </div>
  );
}
