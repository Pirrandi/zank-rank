import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRankingAdminContext } from "@/lib/ranking-access";
import { getPollIntervalMinutes } from "@/lib/sync-status";
import { SyncButton } from "../_ui/shell/sync-button";

export const dynamic = "force-dynamic";

function relativeLabel(date: Date | null): string {
  if (!date) return "nunca";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function StatusCard({ label, value, hint, ok }: { label: string; value: string; hint: string; ok: boolean }) {
  return (
    <div
      className="card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, borderColor: ok ? undefined : "var(--color-loss)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? "var(--color-win)" : "var(--color-loss)" }}
        />
        <span className="mono" style={{ fontSize: 11, color: "var(--admin-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
      </div>
      <div className="mono" style={{ fontWeight: 700, fontSize: 20 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--admin-text-dim)" }}>{hint}</div>
    </div>
  );
}

export default async function AdminHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { ranking } = await getRankingAdminContext(slug);
  const rankingId = ranking.id;

  const [accountCount, liveCount, lastSync, recentMatches] = await Promise.all([
    prisma.trackedAccount.count({ where: { rankingId } }),
    prisma.trackedAccount.count({ where: { rankingId, inGame: true } }),
    prisma.rankSnapshot.aggregate({ where: { rankingId }, _max: { capturedAt: true } }),
    prisma.matchParticipation.findMany({
      where: { rankingId },
      include: { match: true, account: true },
      orderBy: { match: { gameCreation: "desc" } },
      take: 5,
    }),
  ]);

  const lastSyncedAt = lastSync._max.capturedAt;
  const botConfigured = Boolean(process.env.DISCORD_BOT_TOKEN);
  const riotConfigured = Boolean(process.env.RIOT_API_KEY);

  return (
    <div>
      <h1 className="admin-page-title">Resumen</h1>
      <p className="admin-page-sub">Estado de {ranking.name}. Si algo está en rojo, es acá.</p>

      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, margin: "20px 0" }}
      >
        <StatusCard label="Riot API" value={riotConfigured ? "Configurada" : "Sin configurar"} hint="clave usada para sincronizar" ok={riotConfigured} />
        <StatusCard label="Bot Discord" value={botConfigured ? "Online" : "Sin configurar"} hint="alertas y comandos" ok={botConfigured} />
        <StatusCard label="Cuentas trackeadas" value={String(accountCount)} hint={liveCount > 0 ? `${liveCount} jugando ahora` : "nadie jugando ahora"} ok />
        <StatusCard label="Último sync" value={relativeLabel(lastSyncedAt)} hint={`cada ${getPollIntervalMinutes()} min`} ok={Boolean(lastSyncedAt)} />
      </div>

      <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
        <div className="mono" style={{ fontSize: 12, color: "var(--admin-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Acciones rápidas
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SyncButton slug={slug} />
          <Link href={`/${slug}/admin/settings`} className="btn">
            Probar alertas de Discord
          </Link>
          <Link href={`/${slug}/admin/accounts`} className="btn">
            Agregar cuenta
          </Link>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div
          className="mono"
          style={{ padding: "14px 20px", fontSize: 12, color: "var(--admin-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          Últimas partidas registradas
        </div>
        {recentMatches.length === 0 && (
          <p style={{ padding: "0 20px 20px", color: "var(--admin-text-dim)", margin: 0, fontSize: 13 }}>
            Todavía no se registró ninguna partida.
          </p>
        )}
        {recentMatches.map((m, i) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 20px",
              borderTop: i === 0 ? undefined : "1px solid var(--admin-border)",
              fontSize: 13,
            }}
          >
            <span>
              <strong>{m.account.gameName}#{m.account.tagLine}</strong>{" "}
              <span style={{ color: m.win ? "var(--color-win)" : "var(--color-loss)" }}>{m.win ? "ganó" : "perdió"}</span>{" "}
              con {m.championName} ({m.kills}/{m.deaths}/{m.assists})
            </span>
            <span className="mono" style={{ color: "var(--admin-text-dim)", fontSize: 11, whiteSpace: "nowrap" }}>
              {relativeLabel(m.match.gameCreation)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
