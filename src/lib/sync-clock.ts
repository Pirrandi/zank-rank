// Pure sync-status formatting shared by the server (first render) and the header ticker
// (client, once per second). Takes `nowMs` explicitly so callers control when the clock is
// read — client components must never read Date.now() during render.

export type SyncClock = { agoText: string; nextText: string };

function formatAgo(elapsedMs: number): string {
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function computeSyncClock(lastSyncedAtMs: number | null, intervalMs: number, nowMs: number): SyncClock | null {
  if (lastSyncedAtMs === null) return null;
  const elapsed = Math.max(0, nowMs - lastSyncedAtMs);
  return { agoText: formatAgo(elapsed), nextText: formatCountdown(intervalMs - elapsed) };
}
