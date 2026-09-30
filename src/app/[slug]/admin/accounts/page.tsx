import { prisma } from "@/lib/prisma";
import { tierLabel } from "@/lib/tier-colors";
import { getRankingAdminContext } from "@/lib/ranking-access";
import { addAccountAction, removeAccountAction } from "./actions";
import { DeleteAccountButton } from "./delete-account-button";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  // Page guard + tenant scope (design D2/D8): only this ranking's own accounts render.
  const { ranking } = await getRankingAdminContext(slug);
  const accounts = await prisma.trackedAccount.findMany({
    where: { rankingId: ranking.id },
    include: {
      snapshots: { where: { queueType: "RANKED_SOLO_5x5" }, orderBy: { capturedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  // Versión web: uso del cupo de invocadores (la acción lo vuelve a chequear en el servidor).
  let hosted = false;
  let maxAccounts = 0; // unused in self-hosted: both displays below are gated by hosted/atLimit
  let atLimit = false;
  const addAccount = addAccountAction.bind(null, slug);
  const removeAccount = removeAccountAction.bind(null, slug);

  return (
    <div>
      <h1 className="admin-page-title">Cuentas trackeadas</h1>
      <p className="admin-page-sub">
        Quién aparece en el ranking y quién está siendo seguido por el bot.
      </p>

      <form
        action={addAccount}
        className="card"
        style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Agregar cuenta</h2>
          {hosted && (
            <span className="mono" style={{ fontSize: 12, color: atLimit ? "var(--color-loss)" : "var(--admin-text-dim)" }}>
              {accounts.length}/{maxAccounts} invocadores
            </span>
          )}
        </div>
        <fieldset disabled={atLimit} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              type="text"
              name="gameName"
              placeholder="Nombre (sin numeral)"
              required
              className="input"
              style={{ flex: "2 1 160px" }}
            />
            <input type="text" name="tagLine" placeholder="Tag" required className="input" style={{ flex: "1 1 100px" }} />
            <input
              type="text"
              name="platform"
              placeholder="Plataforma"
              defaultValue="la2"
              className="input mono"
              style={{ flex: "1 1 100px" }}
            />
            <input
              type="text"
              name="note"
              placeholder="Nota (opcional) — de quién es esta cuenta"
              className="input"
              style={{ flex: "2 1 220px" }}
            />
          </div>
          {error && (
            <p style={{ color: "var(--color-loss)", fontSize: 13, margin: 0 }}>{error}</p>
          )}
          <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
            Agregar
          </button>
        </fieldset>
      </form>

      <div className="card" style={{ overflow: "hidden" }}>
        {accounts.length === 0 && (
          <p style={{ padding: 24, color: "var(--color-neutral-500)", margin: 0 }}>Todavía no hay cuentas trackeadas.</p>
        )}
        {accounts.map((account, i) => {
          const snapshot = account.snapshots[0];
          return (
            <div
              key={account.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 20px",
                borderTop: i === 0 ? undefined : "1px solid rgb(33, 31, 44)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {account.gameName}
                  <span style={{ color: "var(--color-neutral-500)" }}>#{account.tagLine}</span>
                  {account.note && (
                    <span style={{ fontWeight: 400, color: "var(--color-neutral-500)" }}> · {account.note}</span>
                  )}
                </div>
                <div className="mono" style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
                  {account.platform} · {snapshot ? `${tierLabel(snapshot.tier, snapshot.rank)} · ${snapshot.leaguePoints} LP` : "Sin rango"}
                </div>
              </div>
              <form action={removeAccount}>
                <input type="hidden" name="accountId" value={account.id} />
                <DeleteAccountButton accountLabel={`${account.gameName}#${account.tagLine}`} />
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
