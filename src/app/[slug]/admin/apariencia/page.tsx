import { getRankingAdminContext } from "@/lib/ranking-access";
import { getRankingAppearance, ACCENT_PRESETS } from "@/lib/appearance";
import { getSettingForWorkspace, SETTING_KEYS } from "@/lib/settings";
import { saveAppearanceAction, deleteRankingAction, renameRankingAction } from "./actions";
import { DeleteRankingForm } from "./delete-ranking-form";
import { RenameRankingForm } from "./rename-ranking-form";

export const dynamic = "force-dynamic";

export default async function AdminAparienciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { ranking, role } = await getRankingAdminContext(slug);
  const appearance = await getRankingAppearance(ranking.id);
  const siteName = (await getSettingForWorkspace(ranking.id, SETTING_KEYS.siteName)) ?? ranking.name;
  const save = saveAppearanceAction.bind(null, slug);
  const deleteRanking = deleteRankingAction.bind(null, slug);
  const renameRanking = renameRankingAction.bind(null, slug);

  return (
    <div>
      <h1 className="admin-page-title">Apariencia</h1>
      <p className="admin-page-sub">Nombre, color y cuánta fiesta hay en pantalla.</p>

      {error && (
        <p style={{ color: "var(--color-loss)", fontSize: 13, margin: "0 0 16px" }}>{error}</p>
      )}

      <form action={save} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22, marginBottom: role === "OWNER" ? 24 : 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Nombre del sitio</h2>
          <input
            type="text"
            name="name"
            defaultValue={siteName}
            required
            maxLength={60}
            className="input"
            style={{ maxWidth: 360 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Color de acento</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {ACCENT_PRESETS.map((a) => (
              <label key={a.hex} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="accent" value={a.hex} defaultChecked={appearance.accentColor === a.hex} />
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: a.hex, display: "inline-block" }} />
                {a.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Intensidad de efectos</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <input type="checkbox" name="effectsEnabled" defaultChecked={appearance.effectsEnabled} />
            Confeti y sonidos cuando alguien sube de rango
          </label>
        </div>

        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Guardar
        </button>
      </form>

      {role === "OWNER" && (
        <RenameRankingForm
          currentName={ranking.name}
          currentSlug={ranking.slug}
          action={renameRanking}
        />
      )}

      {role === "OWNER" && (
        <DeleteRankingForm rankingName={ranking.name} action={deleteRanking} />
      )}
    </div>
  );
}
