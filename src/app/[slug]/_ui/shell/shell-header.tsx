import Link from "next/link";
import type { ReactNode } from "react";
import { ShellNav } from "./shell-nav";
import { SyncTicker } from "./sync-ticker";
import { SfxToggle } from "./sfx-toggle";
import { SyncButton } from "./sync-button";

export type ShellSync = { lastSyncedAtMs: number | null; intervalMs: number; renderedAtMs: number };

// Presentational header. `sync` is null on a PRIVATE-ranking denial so nothing about the
// ranking (not even its last sync time) is rendered for a viewer who can't see it.
export function ShellHeader({
  slug,
  liveCount,
  sync,
  canSync,
  canAdmin,
  session,
}: {
  slug: string;
  liveCount: number;
  sync: ShellSync | null;
  canSync: boolean;
  canAdmin: boolean;
  session: ReactNode;
}) {
  return (
    <header className="zr-header">
      <div className="zr-header-inner">
        <Link href={`/${slug}`} className="zr-wordmark">
          ZANK<span>.rank</span>
        </Link>
        <ShellNav slug={slug} liveCount={liveCount} />
        <div className="zr-right">
          {sync && <SyncTicker {...sync} />}
          <SfxToggle />
          {canAdmin && (
            <Link href={`/${slug}/admin`} className="session-btn zr-admin-link">
              Administrar
            </Link>
          )}
          {session}
          {canSync && <SyncButton slug={slug} />}
        </div>
      </div>
    </header>
  );
}
