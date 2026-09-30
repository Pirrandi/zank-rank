"use client";

import { useEffect, useState } from "react";
import { computeSyncClock } from "@/lib/sync-clock";

// Header sync status: "hace Xm · próx. M:SS". The first render uses the server's clock
// (`renderedAtMs`) so SSR and hydration print the same text; the local clock only takes over
// inside the effect.
export function SyncTicker({
  lastSyncedAtMs,
  intervalMs,
  renderedAtMs,
}: {
  lastSyncedAtMs: number | null;
  intervalMs: number;
  renderedAtMs: number;
}) {
  const [now, setNow] = useState(renderedAtMs);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = computeSyncClock(lastSyncedAtMs, intervalMs, now);

  return (
    <span className="zr-sync" title="Estado de la sincronización con Riot">
      <span className="zr-dot" aria-hidden />
      {clock ? `${clock.agoText} · próx. ${clock.nextText}` : "sin sync todavía"}
    </span>
  );
}
