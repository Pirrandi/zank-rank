import type { Metadata } from "next";
import { getRankingAccess } from "@/lib/ranking-access";
import { getSettingForWorkspace, SETTING_KEYS } from "@/lib/settings";

// Tab title for every /<slug>/* page (public + admin, both nest under this layout). Gated by
// canView, not raw visibility: a PUBLIC ranking shows its name to anyone, a PRIVATE one only to
// someone who already has access (member, linked-guild member, or an authenticated admin on
// their own admin pages) — anonymous/crawler requests keep the root layout's generic
// "zank.rank" title, same boundary as the OG image and the crawler redirect fix. getRankingAccess
// is React.cache-memoized, so this doesn't add a second lookup on top of the page's own guard.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const access = await getRankingAccess(slug);
  if (!access || !access.canView) return {};

  const siteName = await getSettingForWorkspace(access.ranking.id, SETTING_KEYS.siteName);
  return { title: siteName ?? access.ranking.name };
}

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
