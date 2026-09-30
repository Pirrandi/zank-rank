"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { compareRankNullable } from "@/lib/rank-order";
import { TIER_COLORS, UNRANKED_COLOR, WIN_COLOR, LOSS_COLOR, FLAT_COLOR, tierLabel, tierEmblemUrl } from "@/lib/tier-colors";
import { winrate } from "@/lib/queue-stats";
import type { QueueStats } from "@/lib/queue-stats";
import { ReactionChips } from "./reaction-chips";
import { ROW_CELEBRATION_EVENT, type RowCelebrationDetail } from "./live-refresh";

const CELEBRATION_MS = 2400;

function useRowCelebrations(): Map<string, { kind: "up" | "down"; label: string }> {
  const [celebrations, setCelebrations] = useState<Map<string, { kind: "up" | "down"; label: string }>>(new Map());

  useEffect(() => {
    function onCelebration(e: Event) {
      const { accountId, kind, label } = (e as CustomEvent<RowCelebrationDetail>).detail;
      setCelebrations((prev) => {
        const next = new Map(prev);
        next.set(accountId, { kind, label });
        return next;
      });
      setTimeout(() => {
        setCelebrations((prev) => {
          if (!prev.has(accountId)) return prev;
          const next = new Map(prev);
          next.delete(accountId);
          return next;
        });
      }, CELEBRATION_MS);
    }
    window.addEventListener(ROW_CELEBRATION_EVENT, onCelebration);
    return () => window.removeEventListener(ROW_CELEBRATION_EVENT, onCelebration);
  }, []);

  return celebrations;
}

type ExtendedQueueStats = QueueStats & {
  winStreakCount: number;
  hasMatchData: boolean;
  sparkline: number[];
  recentForm: boolean[];
};

export type PlayerRow = {
  id: string;
  gameName: string;
  tagLine: string;
  profileIconUrl: string | undefined;
  inGame: boolean;
  solo: ExtendedQueueStats | undefined;
  flex: ExtendedQueueStats | undefined;
};

function LiveDot({ size }: { size: number }) {
  return (
    <div
      title="En partida ahora"
      style={{
        position: "absolute",
        bottom: -1,
        right: -1,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--color-win)",
        border: "2px solid var(--color-bg)",
        boxShadow: "0 0 6px var(--color-win)",
        animation: "zkPulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

type Queue = "solo" | "flex";

const AVATAR_COLORS = ["#ffd447", "#5eb1f5", "#ff5470", "#4dd9c0", "#34d399", "#c084fc"];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function MiniSparkline({ data }: { data: number[] }) {
  const W = 60;
  const H = 24;
  if (data.length < 2) {
    return <svg width={W} height={H} style={{ flex: "none" }} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = W / (data.length - 1);
  const points = data.map((v, i) => `${(i * stepX).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`);
  const trendColor = data[data.length - 1] >= data[0] ? WIN_COLOR : LOSS_COLOR;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible", flex: "none" }}>
      <polyline points={points.join(" ")} fill="none" stroke={trendColor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecentForm({ results, shape = "circle" }: { results: boolean[]; shape?: "circle" | "square" }) {
  if (results.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: shape === "circle" ? 5 : 4, justifyContent: "center" }}>
      {results.map((win, i) => (
        <span
          key={i}
          style={{
            width: shape === "circle" ? 10 : 8,
            height: shape === "circle" ? 10 : 8,
            borderRadius: shape === "circle" ? 999 : 3,
            background: win ? WIN_COLOR : LOSS_COLOR,
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

const PLACE_META: Record<1 | 2 | 3, { color: string }> = {
  1: { color: "var(--color-accent)" },
  2: { color: "#c7cdd6" },
  3: { color: "#c98a4b" },
};

function PodiumCard({
  row,
  queue,
  place,
  sortMode,
  slug,
}: {
  row: PlayerRow;
  queue: Queue;
  place: 1 | 2 | 3;
  sortMode: SortMode;
  slug: string;
}) {
  const q = row[queue];
  if (!q) return null;
  const meta = TIER_COLORS[q.tier] ?? UNRANKED_COLOR;
  const emblem = tierEmblemUrl(q.tier);
  const placeMeta = PLACE_META[place];
  const isFirst = place === 1;

  return (
    <Link
      href={`/${slug}/players/${row.id}?queue=${queue}`}
      className="card podium-card"
      style={{
        position: "relative",
        overflow: "hidden",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: isFirst
          ? "40px clamp(8px, 1.6vw, 20px) clamp(14px, 2vw, 22px)"
          : "26px clamp(8px, 1.6vw, 20px) clamp(14px, 2vw, 22px)",
        textDecoration: "none",
        color: "inherit",
        borderRadius: 26,
        background: isFirst ? "#1a1722" : "var(--color-surface)",
        borderColor: `color-mix(in srgb, ${placeMeta.color} 55%, transparent)`,
        boxShadow: isFirst ? "0 0 50px -10px var(--color-accent-glow)" : "none",
      }}
    >
      {isFirst && (
        <span
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: "40%",
            background: "linear-gradient(90deg, transparent, rgba(255,240,180,0.22), transparent)",
            animation: "zkSweep 3.6s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 12,
          font: "800 clamp(18px, 2.4vw, 28px) var(--font-heading)",
          color: placeMeta.color,
          letterSpacing: "-0.04em",
        }}
      >
        #{place}
      </div>
      <div style={{ position: "relative", flex: "none" }}>
        {row.profileIconUrl ? (
          <img
            src={row.profileIconUrl}
            alt={row.gameName}
            style={{
              width: isFirst ? 96 : 68,
              height: isFirst ? 96 : 68,
              maxWidth: "22vw",
              maxHeight: "22vw",
              borderRadius: "28%",
              border: `3px solid ${placeMeta.color}`,
              display: "block",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: isFirst ? 96 : 68,
              height: isFirst ? 96 : 68,
              maxWidth: "22vw",
              maxHeight: "22vw",
              borderRadius: "28%",
              background: avatarColor(row.gameName),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isFirst ? 34 : 24,
              fontWeight: 800,
              color: "#0b0c10",
              border: `3px solid ${placeMeta.color}`,
            }}
          >
            {row.gameName.charAt(0).toUpperCase()}
          </div>
        )}
        {row.inGame && <LiveDot size={isFirst ? 16 : 14} />}
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: "clamp(14px, 1.8vw, 20px)",
          maxWidth: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "center",
        }}
      >
        {row.gameName}
      </div>
      {emblem && (
        <img
          src={emblem}
          alt={q.tier}
          style={{
            width: isFirst ? 120 : 92,
            height: isFirst ? 120 : 92,
            maxWidth: "24vw",
            maxHeight: "24vw",
            objectFit: "contain",
            margin: "-4px 0 -8px",
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.5))",
          }}
        />
      )}
      <div style={{ fontWeight: 700, fontSize: "clamp(13px, 1.6vw, 17px)", color: meta.fg, textAlign: "center" }}>
        {tierLabel(q.tier, q.rank)}{" "}
        <span className="mono" style={{ fontSize: 12, color: "var(--color-neutral-500)", fontWeight: 500 }}>
          {q.leaguePoints} LP
        </span>
      </div>
      {sortMode === "progress" ? (
        <div
          className="mono"
          style={{
            fontWeight: 700,
            fontSize: "clamp(18px, 2.6vw, 30px)",
            letterSpacing: "-0.03em",
            color:
              q.totalLpGained === undefined || q.totalLpGained === 0
                ? "var(--color-text)"
                : q.totalLpGained > 0
                  ? "var(--color-win)"
                  : "var(--color-loss)",
          }}
        >
          {q.totalLpGained !== undefined ? `${q.totalLpGained > 0 ? "+" : ""}${q.totalLpGained}` : "—"}
          <span style={{ fontSize: 12, color: "var(--color-neutral-500)", fontWeight: 500 }}> LP hoy</span>
        </div>
      ) : (
        <div className="mono" style={{ fontWeight: 700, fontSize: "clamp(18px, 2.6vw, 30px)", color: "var(--color-accent)", letterSpacing: "-0.03em" }}>
          {q.leaguePoints}
          <span style={{ fontSize: 12, color: "var(--color-neutral-500)", fontWeight: 500 }}> LP</span>
        </div>
      )}
      <RecentForm results={q.recentForm} shape="circle" />
    </Link>
  );
}

function Podium({ rows, queue, sortMode, slug }: { rows: PlayerRow[]; queue: Queue; sortMode: SortMode; slug: string }) {
  const ranked = rows.filter((r) => r[queue]);
  if (ranked.length === 0) return null;
  const top3 = ranked.slice(0, 3);

  const slots: { row: PlayerRow; place: 1 | 2 | 3 }[] =
    top3.length === 3
      ? [
          { row: top3[1], place: 2 },
          { row: top3[0], place: 1 },
          { row: top3[2], place: 3 },
        ]
      : top3.map((row, i) => ({ row, place: (i + 1) as 1 | 2 | 3 }));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${top3.length}, minmax(0, 1fr))`,
        gap: "clamp(8px, 1.6vw, 18px)",
        alignItems: "end",
        marginBottom: 28,
      }}
    >
      {slots.map((slot) => (
        <PodiumCard key={slot.row.id} row={slot.row} queue={queue} place={slot.place} sortMode={sortMode} slug={slug} />
      ))}
    </div>
  );
}

type SortMode = "rank" | "progress";

// The sidebar comes pre-rendered per queue so it follows the Solo/Dúo | Flexible toggle.
export function LadderBoard({ slug, rows, sidebarByQueue }: { slug: string; rows: PlayerRow[]; sidebarByQueue?: Record<Queue, React.ReactNode> }) {
  const [queue, setQueue] = useState<Queue>("solo");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("progress");
  const celebrations = useRowCelebrations();

  const sortedAll = useMemo(() => {
    if (sortMode === "progress") {
      return [...rows].sort((a, b) => (b[queue]?.totalLpGained ?? -Infinity) - (a[queue]?.totalLpGained ?? -Infinity));
    }
    return [...rows].sort((a, b) => compareRankNullable(a[queue], b[queue]));
  }, [rows, queue, sortMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedAll;
    return sortedAll.filter((r) => `${r.gameName}${r.tagLine}`.toLowerCase().includes(q));
  }, [sortedAll, query]);

  return (
    <>
      <Podium rows={sortedAll} queue={queue} sortMode={sortMode} slug={slug} />

      <div className="zk-grid-sidebar" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 32, alignItems: "start" }}>
        <div>
          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            <input
              className="input"
              placeholder="Buscar invocador…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: 260, maxWidth: "100%", flex: "none" }}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "none", marginLeft: "auto" }}>
              <div className="seg">
                <label className="seg-opt">
                  <input type="radio" name="sortMode" checked={sortMode === "rank"} onChange={() => setSortMode("rank")} />
                  Rango
                </label>
                <label className="seg-opt">
                  <input type="radio" name="sortMode" checked={sortMode === "progress"} onChange={() => setSortMode("progress")} />
                  LP Ganado
                </label>
              </div>
              <div className="seg">
                <label className="seg-opt">
                  <input type="radio" name="queue" checked={queue === "solo"} onChange={() => setQueue("solo")} />
                  Solo/Dúo
                </label>
                <label className="seg-opt">
                  <input type="radio" name="queue" checked={queue === "flex"} onChange={() => setQueue("flex")} />
                  Flexible
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 64 }}>
            {filtered.map((row, i) => {
          const q = row[queue];
          const meta = q ? TIER_COLORS[q.tier] : undefined;
          const fg = meta?.fg ?? UNRANKED_COLOR.fg;
          const emblem = q ? tierEmblemUrl(q.tier) : undefined;
          const label = q ? tierLabel(q.tier, q.rank) : "SIN RANGO";
          const wr = q ? winrate(q.wins, q.losses) : "—";
          const deltaColor = !q || q.delta === undefined || q.delta === 0 ? FLAT_COLOR : q.delta > 0 ? WIN_COLOR : LOSS_COLOR;
          const deltaArrow = !q || q.delta === undefined || q.delta === 0 ? "—" : q.delta > 0 ? "▲" : "▼";
          const deltaText = q && q.delta !== undefined ? `${q.delta > 0 ? "+" : ""}${q.delta} LP` : "";
          const hot = !!q?.hotStreak;
          const celebration = celebrations.get(row.id);
          const celebrationColor = celebration?.kind === "up" ? WIN_COLOR : LOSS_COLOR;
          const rankPlace = i < 3 ? ((i + 1) as 1 | 2 | 3) : undefined;
          const rowBorderColor = rankPlace ? `color-mix(in srgb, ${PLACE_META[rankPlace].color} 27%, transparent)` : undefined;

          return (
            <Link
              key={row.id}
              href={`/${slug}/players/${row.id}?queue=${queue}`}
              className="card ladder-row"
              style={{
                position: "relative",
                animation: celebration
                  ? `zkFadeUp 0.4s ease both, zkGlow ${CELEBRATION_MS}ms ease-out`
                  : "zkFadeUp 0.4s ease both",
                ["--zk-glow-color" as string]: celebrationColor,
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "12px 18px",
                borderColor: rowBorderColor,
                cursor: "pointer",
                flexWrap: "wrap",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {celebration && (
                <span
                  className="mono"
                  style={{
                    position: "absolute",
                    right: 20,
                    top: -4,
                    fontSize: 13,
                    fontWeight: 800,
                    color: celebrationColor,
                    animation: "zkFloat 1.8s ease-out forwards",
                    pointerEvents: "none",
                  }}
                >
                  {celebration.label}
                </span>
              )}
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, width: 30, flex: "none", color: rankPlace ? PLACE_META[rankPlace].color : "var(--color-neutral-500)" }}>
                {i + 1}
              </div>

              <div style={{ position: "relative", flex: "none" }}>
                {row.profileIconUrl ? (
                  <img
                    src={row.profileIconUrl}
                    alt={row.gameName}
                    style={{ width: 46, height: 46, borderRadius: 14, display: "block", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      background: avatarColor(row.gameName),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#0b0c10",
                    }}
                  >
                    {row.gameName.charAt(0).toUpperCase()}
                  </div>
                )}
                {row.inGame && <LiveDot size={12} />}
              </div>

              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {row.gameName}
                  <span style={{ color: "var(--color-neutral-500)", fontWeight: 400 }}>#{row.tagLine}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                  {emblem && <img src={emblem} alt={q?.tier ?? "sin rango"} style={{ height: 16, width: "auto", flex: "none" }} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: fg }}>{label}</span>
                  {q && (
                    <span style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{q.leaguePoints} LP</span>
                  )}
                  <ReactionChips slug={slug} targetKey={`player:${row.id}`} labels={["GG", "F"]} />
                </div>
              </div>

              <div className="mono" style={{ width: 70, flex: "none", textAlign: "right" }}>
                {sortMode === "progress" ? (
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 16,
                      color:
                        !q || q.totalLpGained === undefined || q.totalLpGained === 0
                          ? "var(--color-text)"
                          : q.totalLpGained > 0
                            ? "var(--color-win)"
                            : "var(--color-loss)",
                    }}
                  >
                    {q && q.totalLpGained !== undefined
                      ? `${q.totalLpGained > 0 ? "+" : ""}${q.totalLpGained}`
                      : "—"}
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{q ? q.leaguePoints : "—"}</div>
                    <div style={{ fontSize: 11, color: deltaColor, fontWeight: 700 }}>
                      {deltaArrow} {deltaText}
                    </div>
                  </>
                )}
              </div>

              <MiniSparkline data={q?.sparkline ?? []} />

              <div className="mono" style={{ width: 130, flex: "none", textAlign: "right", fontSize: 13, color: "var(--color-neutral-800)" }}>
                {q ? `${q.wins}W ${q.losses}L` : "—"}{" "}
                <span style={{ fontWeight: 800, color: "var(--color-text)" }}>{wr}</span>
              </div>

              <div style={{ width: 60, flex: "none" }}>
                <RecentForm results={q?.recentForm ?? []} shape="square" />
              </div>

              {hot && (
                <div style={{ width: 32, flex: "none", textAlign: "center", fontSize: 17, animation: "zkFlame 1.1s ease-in-out infinite" }}>
                  🔥
                  {q!.hasMatchData && (
                    <div className="mono" style={{ fontSize: 10, fontWeight: 800, color: "var(--color-accent)" }}>{q!.winStreakCount}</div>
                  )}
                </div>
              )}
            </Link>
          );
        })}
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--color-neutral-600)", fontSize: 14 }}>
                Ningún invocador coincide con &quot;{query}&quot;.
              </div>
            )}
          </div>
        </div>

        <div style={{ position: "sticky", top: 24 }}>{sidebarByQueue?.[queue]}</div>
      </div>
    </>
  );
}
