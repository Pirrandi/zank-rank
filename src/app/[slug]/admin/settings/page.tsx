import { getAllSettingsForWorkspace } from "@/lib/settings";
import {
  listPostableChannels,
  type DiscordChannelOption,
  type DiscordChannelListResult,
} from "@/lib/discord";
import { getRankingAdminContext } from "@/lib/ranking-access";
import { saveSettingsAction, sendTestAlertAction } from "./actions";

export const dynamic = "force-dynamic";

const labelStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  fontSize: 13,
  color: "var(--color-neutral-600)",
};

// Channels arrive pre-sorted in Discord sidebar order, so grouping consecutive runs by label
// keeps the <optgroup> blocks in that same order.
function groupByLabel(channels: DiscordChannelOption[]): { label: string; items: DiscordChannelOption[] }[] {
  const groups: { label: string; items: DiscordChannelOption[] }[] = [];
  for (const channel of channels) {
    const last = groups[groups.length - 1];
    if (last && last.label === channel.groupLabel) last.items.push(channel);
    else groups.push({ label: channel.groupLabel, items: [channel] });
  }
  return groups;
}

type ChannelFieldProps = {
  label: string;
  name: string;
  savedValue: string;
  fallback: string;
  /** null when the channel list could not be fetched — the field degrades to a raw ID input. */
  channels: DiscordChannelOption[] | null;
  /** When set, renders a button that submits the form to this bound test action (kind in closure). */
  sendTest?: (formData: FormData) => Promise<void>;
};

function ChannelField({ label, name, savedValue, fallback, channels, sendTest }: ChannelFieldProps) {
  // The whole form (unsaved selection included) submits to the bound test action; the channel
  // kind is already bound in the action's closure.
  const testButton = sendTest ? (
    <button
      type="submit"
      formAction={sendTest}
      className="btn"
      style={{ alignSelf: "flex-start", fontSize: 12, padding: "6px 12px" }}
    >
      Enviar alerta de prueba
    </button>
  ) : null;

  if (channels === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={labelStyle}>
          {label} (ID)
          <input
            type="text"
            name={name}
            defaultValue={savedValue}
            placeholder={fallback || "DISCORD_CHANNEL_ID"}
            className="input mono"
          />
        </label>
        {testButton}
      </div>
    );
  }

  // A saved ID that no longer shows up in the list (channel deleted, bot lost access, or the
  // value points at another server) must stay selectable, otherwise saving would silently wipe it.
  const isOrphan = savedValue !== "" && !channels.some((c) => c.id === savedValue);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={labelStyle}>
        {label}
        <select name={name} defaultValue={savedValue} className="select mono">
          <option value="">Usar variable de entorno ({fallback || "sin definir"})</option>
          {isOrphan && <option value={savedValue}>ID guardado: {savedValue} (no encontrado)</option>}
          {groupByLabel(channels).map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {testButton}
    </div>
  );
}

const TEST_OK_LABEL: Record<string, string> = {
  matchRecap: "recaps de partida",
  predictions: "predicciones",
  rankUp: "avisos de rango",
};

export default async function AdminSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; testOk?: string }>;
}) {
  const { slug } = await params;
  const { error, testOk } = await searchParams;
  // Page guard + tenant scope (design D2/D7/D8): settings are read from this ranking, not the
  // root.
  const { ranking } = await getRankingAdminContext(slug);

  // Hosted (multi-tenant): the channel list must be scoped to THIS ranking's linked guild, never
  // the "every guild the bot is in" fallback — that would leak other rankings' servers' channels
  // to this admin. With nothing linked yet, skip the fetch entirely (null) instead of falling
  // through. Self-hosted keeps its original unscoped call unchanged (one deployment, one guild).
  let channelListPromise: Promise<DiscordChannelListResult | null> | undefined;
  if (!channelListPromise) channelListPromise = listPostableChannels();
  const [settings, channelList] = await Promise.all([
    getAllSettingsForWorkspace(ranking.id),
    channelListPromise,
  ]);
  const saveSettings = saveSettingsAction.bind(null, slug);
  // One bound action per channel: the kind lives in the closure because React does not forward
  // the clicked button's name/value to server-action formAction submits.
  const sendTestMatchRecap = sendTestAlertAction.bind(null, slug, "matchRecap");
  const sendTestPredictions = sendTestAlertAction.bind(null, slug, "predictions");
  const sendTestRankUp = sendTestAlertAction.bind(null, slug, "rankUp");

  // Unknown testOk values (hand-edited URLs) are ignored rather than rendered.
  const testOkLabel = testOk ? TEST_OK_LABEL[testOk] : undefined;

  const alertsEnabled =
    settings.discordAlertsEnabled !== undefined
      ? settings.discordAlertsEnabled === "true"
      : process.env.DISCORD_ALERTS_ENABLED === "true";

  const matchRecapFallback = process.env.DISCORD_MATCH_RECAP_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "";
  const predictionsFallback = process.env.DISCORD_PREDICTIONS_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "";
  const rankUpFallback = process.env.DISCORD_RANKUP_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "";

  const channels = channelList?.ok ? channelList.channels : null;

  return (
    <div>
      <h1 className="admin-page-title">Configuración</h1>
      <p className="admin-page-sub">Qué avisa el bot de Discord, dónde y cuándo.</p>

      {error && (
        <p style={{ color: "var(--color-loss)", fontSize: 13, margin: "0 0 16px" }}>{error}</p>
      )}
      {testOkLabel && (
        <p style={{ color: "var(--color-win, #3ba55c)", fontSize: 13, margin: "0 0 16px" }}>
          Vista previa enviada al canal de {testOkLabel}.
          {!alertsEnabled &&
            " Ojo: los avisos de Discord están deshabilitados, los avisos reales no se van a enviar hasta que los actives y guardes."}
        </p>
      )}

      <form
        action={saveSettings}
        className="card"
        style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" name="discordAlertsEnabled" defaultChecked={alertsEnabled} />
          Avisos de Discord habilitados
        </label>
        <p style={{ margin: "-12px 0 0", fontSize: 12, color: "var(--color-neutral-500)" }}>
          Kill switch general: subidas/bajadas de rango, recaps de partida y predicciones.
        </p>

        {channelList === null ? (
          <p style={{ margin: 0, fontSize: 13 }}>
            Todavía no vinculaste un servidor de Discord a este ranking.{" "}
            <a href={`/${slug}/admin/acceso`}>Vincular un servidor</a> para elegir los canales acá.
          </p>
        ) : (
          <>
            {channelList.ok ? (
              <>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-500)" }}>
                  Servidor detectado: {channelList.guildNames.join(", ")}
                </p>
                {channelList.partialError && (
                  <p style={{ margin: "-12px 0 0", color: "var(--color-loss)", fontSize: 13 }}>
                    Lista de canales incompleta. {channelList.partialError} Recargá la página para
                    reintentar.
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, color: "var(--color-loss)", fontSize: 13 }}>
                No se pudo cargar la lista de canales de Discord ({channelList.error}). Podés
                seguir configurando los canales pegando el ID a mano.
              </p>
            )}

            <ChannelField
              label="Canal de recaps de partida"
              name="matchRecapChannelId"
              savedValue={settings.matchRecapChannelId ?? ""}
              fallback={matchRecapFallback}
              channels={channels}
              sendTest={sendTestMatchRecap}
            />

            <ChannelField
              label="Canal de predicciones"
              name="predictionsChannelId"
              savedValue={settings.predictionsChannelId ?? ""}
              fallback={predictionsFallback}
              channels={channels}
              sendTest={sendTestPredictions}
            />

            <ChannelField
              label="Canal de avisos de rango"
              name="rankUpChannelId"
              savedValue={settings.rankUpChannelId ?? ""}
              fallback={rankUpFallback}
              channels={channels}
              sendTest={sendTestRankUp}
            />

            <p style={{ margin: "-12px 0 0", fontSize: 12, color: "var(--color-neutral-500)" }}>
              Vacío = usa la variable de entorno correspondiente. La prueba envía una vista previa
              real con datos de ejemplo (sin gastar IA) usando lo seleccionado arriba, aunque
              todavía no lo hayas guardado.
            </p>
          </>
        )}

        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Guardar
        </button>
      </form>
    </div>
  );
}
