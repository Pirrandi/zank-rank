import { WIN_COLOR, LOSS_COLOR } from "./tier-colors";
import { getChampionEmoji, tierLabelWithEmoji } from "./discord-emojis";
import { getProfileIconUrl } from "./ddragon";
import { getSettingForWorkspace, SETTING_KEYS } from "./settings";
import { PREDICTION_WINDOW_MINUTES } from "./betting";

const DISCORD_API_BASE = "https://discord.com/api/v10";

// Callers guard on DISCORD_BOT_TOKEN before hitting the API, so this only builds the header.
function botHeaders(): Record<string, string> {
  return { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN ?? ""}` };
}

// Global kill switch for all outbound Discord messages, scoped per ranking (hosted supports
// several independent rankings, each with its own Discord config — design fix: previously
// root-scoped via getSetting, so every non-root ranking's alerts silently used the root
// ranking's kill switch/channels instead of its own). Off by default. Editable live from the
// admin panel (/admin/settings) — the DB value wins when present, falling back to the
// DISCORD_ALERTS_ENABLED env var so nothing breaks before the panel has been used once.
async function discordMessagingEnabled(rankingId: string): Promise<boolean> {
  const dbValue = await getSettingForWorkspace(rankingId, SETTING_KEYS.discordAlertsEnabled);
  if (dbValue !== undefined) return dbValue === "true";
  return process.env.DISCORD_ALERTS_ENABLED === "true";
}

async function postToDiscord(
  body: unknown,
  rankingId: string,
  channelId?: string,
): Promise<{ id: string } | undefined> {
  if (!(await discordMessagingEnabled(rankingId))) return undefined;

  const token = process.env.DISCORD_BOT_TOKEN;
  const targetChannel = channelId ?? process.env.DISCORD_CHANNEL_ID;
  if (!token || !targetChannel) return undefined;

  const res = await fetch(`${DISCORD_API_BASE}/channels/${targetChannel}/messages`, {
    method: "POST",
    headers: {
      ...botHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Discord API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function predictionsChannelId(rankingId: string): Promise<string | undefined> {
  const dbValue = await getSettingForWorkspace(rankingId, SETTING_KEYS.predictionsChannelId);
  return dbValue || process.env.DISCORD_PREDICTIONS_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;
}

async function matchRecapChannelId(rankingId: string): Promise<string | undefined> {
  const dbValue = await getSettingForWorkspace(rankingId, SETTING_KEYS.matchRecapChannelId);
  return dbValue || process.env.DISCORD_MATCH_RECAP_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;
}

async function rankUpChannelId(rankingId: string): Promise<string | undefined> {
  const dbValue = await getSettingForWorkspace(rankingId, SETTING_KEYS.rankUpChannelId);
  return dbValue || process.env.DISCORD_RANKUP_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;
}

export type RankChangeEmbedParams = {
  gameName: string;
  tagLine: string;
  profileIconUrl?: string;
  up: boolean;
  queueLabel: string;
  championEmoji?: string;
  championName?: string;
  /** Ya con el emoji del rango (tierLabelWithEmoji), lista para el campo "Rango". */
  rankLabel: string;
  lp: number;
  /** Frase corta de hype/roast (IA o fallback) — es toda la description, sin repetir lo de los campos. */
  summary: string;
  /** Solo la vista previa de admin la usa, para el aviso de "vista previa de ejemplo". */
  footerText?: string;
};

// Reemplaza el banner con imagen generada por un embed liviano, en el mismo estilo que
// buildMatchRecapBody: sin renderizar nada en el servidor, solo texto + emoji del campeón/rango.
export function buildRankChangeBody(params: RankChangeEmbedParams): unknown {
  const color = parseInt((params.up ? WIN_COLOR : LOSS_COLOR).replace("#", ""), 16);

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Cola", value: params.queueLabel, inline: true },
  ];
  if (params.championName) {
    fields.push({
      name: "Campeón",
      value: `${params.championEmoji ? `${params.championEmoji} ` : ""}${params.championName}`,
      inline: true,
    });
  }
  fields.push({ name: "Rango", value: `${params.rankLabel} • ${params.lp} LP`, inline: true });

  return {
    embeds: [
      {
        color,
        author: { name: `${params.gameName}#${params.tagLine}`, icon_url: params.profileIconUrl },
        description: params.summary,
        fields,
        footer: params.footerText ? { text: params.footerText } : undefined,
      },
    ],
  };
}

export async function sendRankChangeAlert(rankingId: string, params: RankChangeEmbedParams): Promise<void> {
  await postToDiscord(buildRankChangeBody(params), rankingId, await rankUpChannelId(rankingId));
}

export type MatchRecapEmbedParams = {
  gameName: string;
  tagLine: string;
  profileIconUrl: string;
  win: boolean;
  queueLabel: string;
  gameDurationLabel: string;
  championEmoji?: string;
  championName: string;
  enemyChampionEmoji?: string;
  enemyChampionName?: string;
  kills: number;
  deaths: number;
  assists: number;
  killParticipationPct?: number;
  cs: number;
  csPerMin: number;
  damage: number;
  rankLabel?: string;
  lp?: number;
  lpDelta?: number;
  itemEmojis: string[];
  footerText?: string;
};

function formatDamage(damage: number): string {
  if (damage >= 1000) return `${(damage / 1000).toFixed(1)}k`;
  return String(damage);
}

export function buildMatchRecapBody(params: MatchRecapEmbedParams): unknown {
  const kda = params.deaths === 0 ? "Perfect" : ((params.kills + params.assists) / params.deaths).toFixed(2);
  const resultLabel = params.win ? "VICTORIA" : "DERROTA";
  const color = parseInt((params.win ? WIN_COLOR : LOSS_COLOR).replace("#", ""), 16);

  const vsLine = params.enemyChampionName
    ? `**${resultLabel}** con ${params.championEmoji ?? ""} **${params.championName}** vs ${params.enemyChampionEmoji ?? ""} ${params.enemyChampionName}`
    : `**${resultLabel}** con ${params.championEmoji ?? ""} **${params.championName}**`;

  const fields: { name: string; value: string; inline: boolean }[] = [
    {
      name: "KDA",
      value: `${params.kills}/${params.deaths}/${params.assists} (${kda})`,
      inline: true,
    },
    {
      name: "CS",
      value: `${params.cs} (${params.csPerMin.toFixed(1)}/min)${
        params.killParticipationPct !== undefined ? ` • KP ${Math.round(params.killParticipationPct)}%` : ""
      }`,
      inline: true,
    },
    {
      name: "Daño",
      value: formatDamage(params.damage),
      inline: true,
    },
  ];

  if (params.rankLabel) {
    const deltaText =
      params.lpDelta !== undefined ? ` (${params.lpDelta >= 0 ? "+" : ""}${params.lpDelta})` : "";
    fields.push({
      name: "Rango",
      value: `**${params.rankLabel}** • ${params.lp ?? 0} LP${deltaText}`,
      inline: false,
    });
  }

  if (params.itemEmojis.length > 0) {
    fields.push({
      name: "Items",
      value: params.itemEmojis.join(" "),
      inline: false,
    });
  }

  return {
    embeds: [
      {
        color,
        author: {
          name: `${params.gameName}#${params.tagLine}`,
          icon_url: params.profileIconUrl,
        },
        description: `${params.queueLabel} • ${params.gameDurationLabel}\n${vsLine}`,
        fields,
        footer: params.footerText ? { text: params.footerText } : undefined,
      },
    ],
  };
}

export async function sendMatchRecapEmbed(rankingId: string, params: MatchRecapEmbedParams): Promise<void> {
  await postToDiscord(buildMatchRecapBody(params), rankingId, await matchRecapChannelId(rankingId));
}

export type GroupRecapPlayer = {
  gameName: string;
  tagLine: string;
  win: boolean;
  profileIconEmoji?: string;
  championEmoji?: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  rankLabel?: string;
  lpDelta?: number;
  itemEmojis: string[];
};

export type MatchGroupRecapEmbedParams = {
  queueLabel: string;
  gameDurationLabel: string;
  resultLabel: string;
  players: GroupRecapPlayer[];
  colorHex: string;
  footerText?: string;
};

export async function sendGroupMatchRecapEmbed(
  rankingId: string,
  params: MatchGroupRecapEmbedParams,
): Promise<void> {
  const color = parseInt(params.colorHex.replace("#", ""), 16);

  const fields = params.players.map((p) => {
    const champLabel = `${p.championEmoji ? `${p.championEmoji} ` : ""}${p.championName}`;
    const kda = `${p.kills}/${p.deaths}/${p.assists}`;
    const rankLine =
      p.rankLabel !== undefined
        ? `\n${p.rankLabel}${p.lpDelta !== undefined ? ` (${p.lpDelta >= 0 ? "+" : ""}${p.lpDelta} LP)` : ""}`
        : "";
    const itemsLine = p.itemEmojis.length > 0 ? `\n${p.itemEmojis.join(" ")}` : "";
    const nameLabel = `${p.profileIconEmoji ? `${p.profileIconEmoji} ` : ""}${p.gameName}`;
    return {
      name: nameLabel,
      value: `${champLabel}\n${kda} · ${formatDamage(p.damage)} dmg${rankLine}${itemsLine}`,
      inline: true,
    };
  });

  await postToDiscord({
    embeds: [
      {
        color,
        description: `**${params.resultLabel}** • Ranked ${params.queueLabel} • ${params.gameDurationLabel}`,
        fields,
        footer: params.footerText ? { text: params.footerText } : undefined,
      },
    ],
  }, rankingId, await matchRecapChannelId(rankingId));
}

export type PredictionPlayer = {
  championEmoji?: string;
  championName?: string;
  /** Un jugador seguido en este ranking: se muestra con nombre. Sin esto, solo el campeón. */
  tracked: boolean;
  name?: string;
  tag?: string;
};

export type PredictionEmbedParams = {
  accentColorHex: string;
  queueLabel: string;
  team1: PredictionPlayer[];
  team2: PredictionPlayer[];
  winCustomId: string;
  loseCustomId: string;
  /** Solo la vista previa de admin la usa, para el aviso de "vista previa de ejemplo". */
  footerText?: string;
};

function predictionPlayerLine(p: PredictionPlayer): string {
  const champ = `${p.championEmoji ? `${p.championEmoji} ` : ""}${p.championName ?? "Campeón desconocido"}`;
  if (!p.tracked) return champ;
  return `${champ} · **${p.name}${p.tag ? `#${p.tag}` : ""}**`;
}

// Reemplaza el banner de composición de equipos (renderizado con next/og) por dos columnas de
// texto, mismo estilo que sendGroupMatchRecapEmbed: cero renderizado de imágenes en el servidor.
// Sin content a nivel mensaje: todo — quién entró, con qué campeón, en qué rango — vive en el
// embed. refreshRoundStatsMessage sigue pudiendo pegarle el conteo de apuestas al content vacío.
export function buildPredictionBody(params: PredictionEmbedParams): unknown {
  return {
    embeds: [
      {
        color: parseInt(params.accentColorHex.replace("#", ""), 16),
        description: `**${params.queueLabel}** — ¿Gana o pierde? ${PREDICTION_WINDOW_MINUTES} min para apostar.`,
        fields: [
          { name: "Su equipo", value: params.team1.map(predictionPlayerLine).join("\n") || "—", inline: true },
          { name: "Rival", value: params.team2.map(predictionPlayerLine).join("\n") || "—", inline: true },
        ],
        footer: params.footerText ? { text: params.footerText } : undefined,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "Gana", custom_id: params.winCustomId },
          { type: 2, style: 4, label: "Pierde", custom_id: params.loseCustomId },
        ],
      },
    ],
  };
}

export async function sendPredictionRound(
  rankingId: string,
  params: PredictionEmbedParams,
): Promise<string | undefined> {
  const message = await postToDiscord(
    buildPredictionBody(params),
    rankingId,
    await predictionsChannelId(rankingId),
  );
  return message?.id;
}

async function patchPredictionMessage(messageId: string, rankingId: string, body: unknown): Promise<void> {
  if (!(await discordMessagingEnabled(rankingId))) return;

  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = await predictionsChannelId(rankingId);
  if (!token || !channelId) return;

  await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      ...botHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function closePredictionMessage(
  messageId: string,
  rankingId: string,
  content: string,
): Promise<void> {
  await patchPredictionMessage(messageId, rankingId, { content, components: [] });
}

export async function updatePredictionMessageContent(
  messageId: string,
  rankingId: string,
  content: string,
): Promise<void> {
  await patchPredictionMessage(messageId, rankingId, { content });
}

// ---------------------------------------------------------------------------
// Channel discovery — powers the channel dropdowns in /admin/settings.
// ---------------------------------------------------------------------------

export type DiscordChannelOption = { id: string; name: string; groupLabel: string };
export type DiscordChannelListResult =
  // `partialError` marks a read that succeeded for some guilds and failed for others: the dropdowns
  // are usable but incomplete, and the operator has to be told rather than shown a confident list.
  | { ok: true; guildNames: string[]; channels: DiscordChannelOption[]; partialError?: string }
  | { ok: false; error: string };

const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_CATEGORY = 4;
const CHANNEL_TYPE_ANNOUNCEMENT = 5;
const UNCATEGORIZED_LABEL = "Sin categoría";

const CHANNEL_CACHE_TTL_MS = 60_000;
// Cache keyed by resolved guild scope: the settings page is force-dynamic, so without this every
// render (and every failed form submit re-render) would hit the Discord API again. Only complete
// successes are cached — see the partial-read guard before the write. Keying by scope (instead of
// one shared entry) stops one ranking's linked-guild channel list from being served to another
// ranking with a different (or no) linked guild.
const channelCache = new Map<string, { at: number; result: Extract<DiscordChannelListResult, { ok: true }> }>();

type RawGuild = { id: string; name?: string };
type RawChannel = { id: string; name?: string; type: number; parent_id?: string | null; position?: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Discord rate limits are per-route and usually sub-second. Retry once, capped so a page render
// can never hang on a long global bucket.
const MAX_RETRY_WAIT_MS = 5_000;

// Hard ceiling on any single Discord request. Without it a stalled connection (network partition,
// firewall black-hole) would hang the force-dynamic settings page render forever and the graceful
// degradation below would never get a chance to run — a catch only catches errors, not silence.
const REQUEST_TIMEOUT_MS = 8_000;

async function discordGet(path: string): Promise<Response> {
  const url = `${DISCORD_API_BASE}${path}`;
  // A timeout signal is single-use, so each attempt gets a fresh one.
  const attempt = (): Promise<Response> =>
    fetch(url, { headers: botHeaders(), cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  const res = await attempt();
  if (res.status !== 429) return res;

  const retryAfterSeconds = await res
    .clone()
    .json()
    .then((data: { retry_after?: number }) => Number(data?.retry_after))
    .catch(() => NaN);
  const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 1000;
  await sleep(Math.min(waitMs, MAX_RETRY_WAIT_MS));

  return attempt();
}

async function failureFor(res: Response): Promise<Extract<DiscordChannelListResult, { ok: false }>> {
  const body = await res.text().catch(() => "");
  const shortText = body.replace(/\s+/g, " ").trim().slice(0, 120) || res.statusText;
  return { ok: false, error: `Discord respondió ${res.status}: ${shortText}` };
}

function unreachable(error: unknown): Extract<DiscordChannelListResult, { ok: false }> {
  const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
  if (timedOut) return { ok: false, error: "Discord no respondió a tiempo." };
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: `No se pudo contactar a Discord: ${message}` };
}

function channelsFromGuild(raw: RawChannel[], guildName: string, multiGuild: boolean): DiscordChannelOption[] {
  const categories = new Map<string, { name: string; position: number }>();
  for (const channel of raw) {
    if (channel.type === CHANNEL_TYPE_CATEGORY) {
      categories.set(channel.id, { name: channel.name ?? UNCATEGORIZED_LABEL, position: channel.position ?? 0 });
    }
  }

  return raw
    .filter((c) => c.type === CHANNEL_TYPE_TEXT || c.type === CHANNEL_TYPE_ANNOUNCEMENT)
    .map((c) => {
      const category = c.parent_id ? categories.get(c.parent_id) : undefined;
      return {
        id: c.id,
        name: c.name ?? c.id,
        categoryName: category?.name ?? UNCATEGORIZED_LABEL,
        // Discord renders parentless channels above every category, hence the -1.
        categoryPosition: category?.position ?? -1,
        position: c.position ?? 0,
      };
    })
    // Mirror the Discord sidebar order: category first, then channel position inside it.
    .sort((a, b) =>
      a.categoryPosition !== b.categoryPosition
        ? a.categoryPosition - b.categoryPosition
        : a.position - b.position
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      groupLabel: multiGuild ? `${guildName} · ${c.categoryName}` : c.categoryName,
    }));
}

// Always resolves — the admin panel degrades to plain text inputs on failure instead of breaking.
// `guildId`, when given, scopes the fetch to exactly that ranking's linked Discord guild (hosted
// multi-tenant mode — design fix: previously ungated, this leaked every guild the bot's token
// could see to every ranking's admin). Omitted, it falls back to DISCORD_GUILD_ID then to every
// guild the bot is in, unchanged — that fallback chain is self-hosted mode's only path, where a
// single deployment really does have one (or zero) guild in scope.
export async function listPostableChannels(guildId?: string): Promise<DiscordChannelListResult> {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, error: "DISCORD_BOT_TOKEN no está configurado." };
  }

  const cacheKey = guildId ?? "auto";
  const cached = channelCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CHANNEL_CACHE_TTL_MS) return cached.result;

  try {
    const configuredGuildId = guildId ?? process.env.DISCORD_GUILD_ID;
    let guilds: RawGuild[];

    if (configuredGuildId) {
      const res = await discordGet(`/guilds/${configuredGuildId}`);
      if (!res.ok) return await failureFor(res);
      const guild: RawGuild = await res.json();
      guilds = [{ id: configuredGuildId, name: guild.name ?? configuredGuildId }];
    } else {
      const res = await discordGet("/users/@me/guilds");
      if (!res.ok) return await failureFor(res);
      guilds = await res.json();
    }

    if (guilds.length === 0) {
      return { ok: false, error: "El bot no está en ningún servidor de Discord." };
    }

    const multiGuild = guilds.length > 1;

    // Fan out per guild: sequential awaits would multiply both latency and the 429 retry wait by the
    // guild count, and one forbidden or unreachable guild must not discard the channels of the rest.
    const perGuild = await Promise.all(
      guilds.map(async (guild) => {
        const guildName = guild.name ?? guild.id;
        try {
          const res = await discordGet(`/guilds/${guild.id}/channels`);
          if (!res.ok) return { guildName, failure: await failureFor(res) };
          const raw: RawChannel[] = await res.json();
          return { guildName, channels: channelsFromGuild(raw, guildName, multiGuild) };
        } catch (error) {
          return { guildName, failure: unreachable(error) };
        }
      })
    );

    const guildNames: string[] = [];
    const failedGuildNames: string[] = [];
    const channels: DiscordChannelOption[] = [];
    let lastFailure: Extract<DiscordChannelListResult, { ok: false }> | undefined;

    for (const entry of perGuild) {
      // An empty channel list is a success, not a failure: [] is truthy, so it falls through here.
      if (!("channels" in entry) || !entry.channels) {
        failedGuildNames.push(entry.guildName);
        lastFailure = "failure" in entry ? entry.failure : undefined;
        continue;
      }
      guildNames.push(entry.guildName);
      channels.push(...entry.channels);
    }

    // Only a total wipeout degrades the panel; a partial read still beats raw-ID inputs.
    if (guildNames.length === 0) {
      return lastFailure ?? { ok: false, error: "No se pudieron leer los canales de Discord." };
    }

    // Isolating guilds must not turn a loud failure into a silent one: say which guilds are missing.
    const partialError =
      failedGuildNames.length > 0
        ? `Faltan los canales de: ${failedGuildNames.join(", ")}.${lastFailure ? ` ${lastFailure.error}` : ""}`
        : undefined;

    const result = { ok: true as const, guildNames, channels, partialError };
    // A partial read is never cached, so a transient guild failure is retried on the next render
    // instead of being pinned for the whole TTL.
    if (!partialError) channelCache.set(cacheKey, { at: Date.now(), result });
    return result;
  } catch (error) {
    return unreachable(error);
  }
}

// ---------------------------------------------------------------------------
// Template previews — explicit admin action from /admin/settings.
// ---------------------------------------------------------------------------

export type SendTestAlertResult = { ok: true } | { ok: false; error: string };

// Intentionally bypasses discordMessagingEnabled(): a preview is an explicit admin action whose
// whole point is to validate the connection, so the kill switch must not silently swallow it.
async function postUngated(body: unknown, channelId: string): Promise<SendTestAlertResult> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { ok: false, error: "DISCORD_BOT_TOKEN no está configurado." };

  let res: Response;
  try {
    res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        ...botHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return unreachable(error);
  }

  if (res.ok) return { ok: true };

  if (res.status === 401) return { ok: false, error: "El token del bot es inválido." };
  if (res.status === 403) return { ok: false, error: "El bot no tiene permiso para escribir en ese canal." };
  if (res.status === 404) return { ok: false, error: "Ese canal no existe o el bot no lo ve." };
  return failureFor(res);
}

export type TemplatePreviewKind = "matchRecap" | "predictions" | "rankUp";

// Sends a real template render with static sample data so admins can see exactly what each
// alert looks like. NEVER calls Groq/AI (no generateRoast import): the copy is fixed and the
// only network fetches are Data Dragon asset URLs and the Discord post itself.
export async function sendTemplatePreview(
  kind: TemplatePreviewKind,
  channelId: string
): Promise<SendTestAlertResult> {
  if (kind === "matchRecap") {
    return postUngated(
      buildMatchRecapBody({
        gameName: "ZankDemo",
        tagLine: "LAS",
        profileIconUrl: await getProfileIconUrl(29),
        win: true,
        queueLabel: "Solo/Dúo",
        gameDurationLabel: "32:14",
        championEmoji: getChampionEmoji(103),
        championName: "Ahri",
        enemyChampionEmoji: getChampionEmoji(238),
        enemyChampionName: "Zed",
        kills: 11,
        deaths: 2,
        assists: 8,
        killParticipationPct: 73,
        cs: 234,
        csPerMin: 7.3,
        damage: 28450,
        rankLabel: tierLabelWithEmoji("DIAMOND", "II"),
        lp: 67,
        lpDelta: 21,
        itemEmojis: [],
        footerText: "Vista previa de ejemplo — así se ven los recaps reales.",
      }),
      channelId
    );
  }

  if (kind === "predictions") {
    return postUngated(
      buildPredictionBody({
        accentColorHex: "#E9FF1F",
        queueLabel: "Solo/Dúo",
        team1: [
          { championEmoji: getChampionEmoji(103), championName: "Ahri", tracked: true, name: "ZankDemo", tag: "LAS" },
          { championEmoji: getChampionEmoji(222), championName: "Jinx", tracked: false },
          { championEmoji: getChampionEmoji(412), championName: "Thresh", tracked: false },
          { championEmoji: getChampionEmoji(64), championName: "Lee Sin", tracked: false },
          { championEmoji: getChampionEmoji(157), championName: "Yasuo", tracked: false },
        ],
        team2: [
          { championEmoji: getChampionEmoji(238), championName: "Zed", tracked: false },
          { championEmoji: getChampionEmoji(99), championName: "Lux", tracked: false },
          { championEmoji: getChampionEmoji(86), championName: "Garen", tracked: false },
          { championEmoji: getChampionEmoji(67), championName: "Vayne", tracked: false },
          { championEmoji: getChampionEmoji(53), championName: "Blitzcrank", tracked: false },
        ],
        winCustomId: "predict:win:preview",
        loseCustomId: "predict:lose:preview",
        footerText: "Vista previa de ejemplo — los botones abren una apuesta de prueba, no una real.",
      }),
      channelId
    );
  }

  return postUngated(
    buildRankChangeBody({
      gameName: "ZankDemo",
      tagLine: "LAS",
      profileIconUrl: await getProfileIconUrl(29),
      up: true,
      queueLabel: "Solo/Dúo",
      championEmoji: getChampionEmoji(103),
      championName: "Ahri",
      rankLabel: tierLabelWithEmoji("DIAMOND", "II"),
      lp: 67,
      summary: "¡Así se ven los avisos de rango reales!",
      footerText: "Vista previa de ejemplo.",
    }),
    channelId
  );
}
