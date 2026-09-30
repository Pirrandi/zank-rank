import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getRankingBySlug } from "@/lib/ranking";
import { getSettingForWorkspace, SETTING_KEYS } from "@/lib/settings";
import { getProfileIconUrl } from "@/lib/ddragon";
import { compareRankNullable, type RankLike } from "@/lib/rank-order";
import { TIER_COLORS, UNRANKED_COLOR, WIN_COLOR, LOSS_COLOR, tierLabel } from "@/lib/tier-colors";
import { lpDeltaToday } from "@/lib/derive";
import { getQueueSnapshotSummaries } from "@/lib/snapshot-summary";
import { BRAND_GOLD, FONT_FAMILY, emblemDataUri, loadFonts, staticBanner } from "@/lib/og-shared";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Bounds regeneration to at most once/hour per ranking regardless of traffic — link-preview
// crawlers already cache the result on their own side for much longer than this anyway.
export const revalidate = 3600;

const TOP_N = 4;
const SOLO_QUEUE = "RANKED_SOLO_5x5";
// Same medal colors as the landing hero's demo leaderboard (src/app/landing/leaderboard-demo.tsx
// TOP_COLORS) — this banner reuses that exact look, not the ranking's own accent.
const TOP_COLORS = ["#ffd447", "#c7cdd6", "#c98a4b"];

type BannerPlayer = {
  gameName: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  delta?: number;
  profileIconId: number | null;
};

function signedDelta(n: number | undefined): { text: string; color: string } {
  if (n === undefined) return { text: "—", color: "rgba(255,255,255,0.4)" };
  if (n > 0) return { text: `+${n}`, color: WIN_COLOR };
  if (n < 0) return { text: `−${Math.abs(n)}`, color: LOSS_COLOR };
  return { text: "0", color: "rgba(255,255,255,0.4)" };
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Response> {
  const { slug } = await params;
  const ranking = await getRankingBySlug(slug);

  // PRIVATE (or unknown) rankings must never leak their name or roster to a sessionless
  // crawler — same boundary as requireRankingView's canView:false path, just enforced here
  // without pulling in the session/guild-membership machinery an image route doesn't need.
  if (!ranking || ranking.visibility !== "PUBLIC") {
    return staticBanner();
  }

  const [siteName, accounts] = await Promise.all([
    getSettingForWorkspace(ranking.id, SETTING_KEYS.siteName),
    prisma.trackedAccount.findMany({ where: { rankingId: ranking.id } }),
  ]);
  // Bounded per-account summary (first/baseline/latest) instead of the full snapshot series.
  const summaries = await getQueueSnapshotSummaries(accounts.map((a) => a.id), [SOLO_QUEUE]);
  const displayName = siteName ?? ranking.name;

  const ranked = accounts
    .map((account) => {
      const soloAscending = summaries.get(`${account.id}:${SOLO_QUEUE}`)?.ascending ?? [];
      const latest = soloAscending[soloAscending.length - 1];
      const entry: RankLike | undefined = latest
        ? { tier: latest.tier, rank: latest.rank, leaguePoints: latest.leaguePoints }
        : undefined;
      return {
        gameName: account.gameName,
        profileIconId: account.profileIconId,
        entry,
        delta: lpDeltaToday(soloAscending),
      };
    })
    .sort((a, b) => compareRankNullable(a.entry, b.entry))
    .slice(0, TOP_N);

  const players: BannerPlayer[] = ranked.map(({ gameName, profileIconId, entry, delta }) => ({
    gameName,
    profileIconId,
    tier: entry?.tier ?? "",
    rank: entry?.rank ?? "",
    leaguePoints: entry?.leaguePoints ?? 0,
    delta,
  }));

  const [emblems, avatars, fonts] = await Promise.all([
    Promise.all(players.map((p) => emblemDataUri(p.tier))),
    Promise.all(players.map((p) => (p.profileIconId != null ? getProfileIconUrl(p.profileIconId) : undefined))),
    loadFonts(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0d0c13",
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Same warm glow as the landing hero's .lp-hero-glow, fixed brand color regardless of
            the ranking's own accent — this banner mirrors the generic one, only the card at the
            right is real data. */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -120,
            width: 640,
            height: 640,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(255,212,71,0.22), transparent 65%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", width: "100%", alignItems: "center", padding: 64, gap: 56 }}>
          {/* Left: zank.rank logo watermark, then this ranking's own name/tagline/description */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: "#ffffff", marginBottom: 20 }}>
              ZANK
              <span style={{ color: BRAND_GOLD }}>.rank</span>
            </div>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 18,
                marginBottom: 28,
              }}
            >
              <div style={{ display: "flex", width: 8, height: 8, borderRadius: 999, background: WIN_COLOR }} />
              Ranking de League of Legends
            </div>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "#ffffff" }}>
              {displayName}
            </div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, marginTop: 18, color: BRAND_GOLD }}>
              Ranking privado
            </div>
            <div style={{ display: "flex", fontSize: 19, color: "rgba(244,242,248,0.6)", marginTop: 18, maxWidth: 440 }}>
              Rango, LP y rachas sincronizados desde Riot, apuestas, muros y un bot de Discord con
              IA.
            </div>
          </div>

          {/* Right: the "table" — swapped for this ranking's real top players */}
          {players.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 560,
                padding: 24,
                borderRadius: 20,
                background: "rgba(22,20,31,0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", fontSize: 17, color: "rgba(255,255,255,0.6)" }}>
                  Ranking · {displayName}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: WIN_COLOR }}>
                  <div style={{ display: "flex", width: 8, height: 8, borderRadius: 999, background: WIN_COLOR }} />
                  EN VIVO
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {players.map((p, i) => {
                  const meta = TIER_COLORS[p.tier.toUpperCase()] ?? UNRANKED_COLOR;
                  const label = p.tier ? tierLabel(p.tier, p.rank) : UNRANKED_COLOR.label;
                  const posColor = TOP_COLORS[i] ?? "#6c6880";
                  const { text: deltaText, color: deltaColor } = signedDelta(p.delta);
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "10px 16px",
                        borderRadius: 12,
                        border: `1px solid ${posColor}30`,
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div style={{ display: "flex", color: posColor, fontSize: 24, fontWeight: 800, width: 26 }}>
                        {i + 1}
                      </div>
                      {avatars[i] ? (
                        <img
                          src={avatars[i]}
                          width={40}
                          height={40}
                          style={{ display: "flex", borderRadius: 10, border: `2px solid ${posColor}` }}
                        />
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            border: `2px solid ${posColor}`,
                            background: "rgba(255,255,255,0.08)",
                          }}
                        />
                      )}
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <div style={{ display: "flex", fontSize: 23, color: "#ffffff", fontWeight: 700 }}>
                          {p.gameName}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 16, color: meta.fg }}>
                          {emblems[i] && <img src={emblems[i]} width={16} height={16} style={{ display: "flex" }} />}
                          <span style={{ display: "flex" }}>
                            {label}
                            {p.tier ? ` · ${p.leaguePoints} LP` : ""}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: deltaColor }}>
                        {deltaText}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
