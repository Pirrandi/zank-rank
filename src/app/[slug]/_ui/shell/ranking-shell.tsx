import type { CSSProperties, ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { roleAtLeast, type RankingAccess } from "@/lib/ranking-access";
import { getPollIntervalMinutes } from "@/lib/sync-status";
import { getRankingAppearance } from "@/lib/appearance";
import { LiveRefresh } from "@/app/live-refresh";
import { SessionButton } from "@/app/session-button";
import { ShellHeader } from "./shell-header";
import "../zr.css";

// Data container for the public /<slug>/* chrome. Every page still runs its own
// requireRankingView() guard and passes the resulting access here; the shell only reads
// aggregate data (live count, last sync) when that access allows viewing the ranking.
export async function RankingShell({
  slug,
  access,
  path,
  children,
}: {
  slug: string;
  access: RankingAccess;
  /** Current page path, used as the OAuth `next` target of "Entrar". */
  path: string;
  children: ReactNode;
}) {
  const rankingId = access.ranking.id;
  const [liveCount, lastSync] = access.canView
    ? await Promise.all([
        prisma.trackedAccount.count({ where: { rankingId, inGame: true } }),
        prisma.rankSnapshot.aggregate({ where: { rankingId }, _max: { capturedAt: true } }),
      ])
    : [0, null];
  // Fetched unconditionally: the accent color applies even to the private-ranking gate screen.
  const appearance = await getRankingAppearance(rankingId);

  const lastSyncedAt = lastSync?._max.capturedAt ?? null;
  const isAdmin = roleAtLeast(access.role, "ADMIN");

  return (
    <div className="zr-root" style={{ "--zr-accent": appearance.accentColor } as CSSProperties}>
      {access.canView && (
        <LiveRefresh
          slug={slug}
          lastSyncedAt={lastSyncedAt?.toISOString() ?? null}
          celebrationsEnabled={appearance.effectsEnabled}
        />
      )}
      <ShellHeader
        slug={slug}
        liveCount={liveCount}
        sync={
          access.canView
            ? {
                lastSyncedAtMs: lastSyncedAt?.getTime() ?? null,
                intervalMs: getPollIntervalMinutes() * 60_000,
                renderedAtMs: Date.now(),
              }
            : null
        }
        canSync={access.canView && isAdmin}
        canAdmin={isAdmin}
        session={<SessionButton next={path} />}
      />
      <main className="zr-main">{children}</main>
    </div>
  );
}
