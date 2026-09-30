"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { playRankUpSound, playRankDownSound } from "./sound-effects";
import { burstConfetti } from "./confetti";

const POLL_MS = 15_000;
const TOAST_MS = 5200;

export const ROW_CELEBRATION_EVENT = "zank:row-celebration";
export type RowCelebrationDetail = { accountId: string; kind: "up" | "down"; label: string };

function dispatchRowCelebration(accountId: string, kind: "up" | "down", label: string): void {
  window.dispatchEvent(new CustomEvent<RowCelebrationDetail>(ROW_CELEBRATION_EVENT, { detail: { accountId, kind, label } }));
}

type AccountSnapshot = { accountId: string; gameName: string; tagLine: string; tier: string; lpScore: number; leaguePoints: number };
type Toast = { id: string; title: string; body: string; accent: string };

export function LiveRefresh({
  slug,
  lastSyncedAt,
  celebrationsEnabled = true,
}: {
  slug: string;
  lastSyncedAt: string | null;
  /** Apariencia's "Confeti y sonidos" toggle. Row highlights (dispatchRowCelebration) stay on
   * regardless — this only gates the flashy confetti/sound/toast trio. */
  celebrationsEnabled?: boolean;
}) {
  const router = useRouter();
  const knownRef = useRef(lastSyncedAt);
  const snapshotRef = useRef<Map<string, AccountSnapshot> | undefined>(undefined);
  const seededRef = useRef(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    knownRef.current = lastSyncedAt;
  }, [lastSyncedAt]);

  function pushToast(toast: Omit<Toast, "id">) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { ...toast, id }].slice(-3));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      // Ranking-scoped: GET /api/sync 404s without ?ranking= (requireRankingViewApi).
      const res = await fetch(`/api/sync?ranking=${encodeURIComponent(slug)}`).catch(() => undefined);
      const data = await res?.json().catch(() => undefined);
      if (!data) return;

      const nextMap = new Map<string, AccountSnapshot>((data.snapshot ?? []).map((s: AccountSnapshot) => [s.accountId, s]));

      // First tick after mount just seeds the baseline — never celebrates on initial load.
      if (!seededRef.current) {
        seededRef.current = true;
        snapshotRef.current = nextMap;
        return;
      }

      if (data.lastSyncedAt && data.lastSyncedAt !== knownRef.current) {
        const prevMap = snapshotRef.current;
        if (prevMap) {
          for (const [accountId, curr] of nextMap) {
            const prev = prevMap.get(accountId);
            if (!prev) continue;
            const tierChanged = curr.tier !== prev.tier;
            const wentUp = curr.lpScore > prev.lpScore;
            const lpDelta = curr.leaguePoints !== prev.leaguePoints ? curr.lpScore - prev.lpScore : 0;

            if (tierChanged && wentUp) {
              if (celebrationsEnabled) {
                playRankUpSound();
                burstConfetti();
                pushToast({ title: "🎉 Subió de rango", body: `${curr.gameName}#${curr.tagLine} llegó a ${curr.tier}`, accent: "var(--color-win)" });
              }
              dispatchRowCelebration(curr.accountId, "up", `¡${curr.tier}!`);
            } else if (tierChanged && !wentUp) {
              if (celebrationsEnabled) {
                playRankDownSound();
                pushToast({ title: "💩 Bajó de rango", body: `${curr.gameName}#${curr.tagLine} cayó a ${curr.tier}`, accent: "var(--color-loss)" });
              }
              dispatchRowCelebration(curr.accountId, "down", `${curr.tier}`);
            } else if (lpDelta !== 0) {
              if (celebrationsEnabled && Math.abs(lpDelta) >= 15) {
                pushToast({
                  title: lpDelta > 0 ? "▲ Subida de LP" : "▼ Bajada de LP",
                  body: `${curr.gameName}#${curr.tagLine} ${lpDelta > 0 ? "+" : ""}${lpDelta} LP`,
                  accent: lpDelta > 0 ? "var(--color-win)" : "var(--color-loss)",
                });
              }
              dispatchRowCelebration(curr.accountId, lpDelta > 0 ? "up" : "down", `${lpDelta > 0 ? "+" : ""}${lpDelta} LP`);
            }
          }
        }
        snapshotRef.current = nextMap;
        router.refresh();
      } else {
        snapshotRef.current = nextMap;
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [router, slug]);

  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, left: 16, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="card"
          style={{ padding: "12px 14px", borderLeft: `3px solid ${t.accent}`, boxShadow: "0 20px 50px rgba(0,0,0,0.5)", animation: "zkFadeUp 0.3s ease", maxWidth: 300, width: "100%" }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: t.accent, marginBottom: 2 }}>{t.title}</div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{t.body}</div>
        </div>
      ))}
    </div>
  );
}
