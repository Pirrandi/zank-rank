// DB-backed key/value settings, editable live from /admin/settings without a restart.
// Read from both the Next.js server (this file) and scripts/poll.ts (a separate long-running
// cron process) — both already share the same prisma singleton from src/lib/prisma.ts, so a
// value saved from the admin panel is picked up by poll.ts on its next iteration.
//
// Settings are tenant-scoped: every row belongs to a workspace. Two entry points:
//
//   - Workspace-parametrized (getSettingForWorkspace, getAllSettingsForWorkspace,
//     setSettingForWorkspace, deleteSettingForWorkspace) — used by the admin panel, which
//     passes the current session's rankingId (PR #4 admin scoping).
//   - Root-scoped (getSetting, getAllSettings, setSetting, deleteSetting) — the legacy API,
//     always operating on the root workspace (slug "zank"). Used by the Discord bot code
//     (src/lib/discord.ts) during the transition: the migrated legacy rows were re-pointed
//     to the root workspace by `npm run migrate-workspaces`, so root-scoped reads keep
//     working with the existing data. Delegates to the workspace-parametrized fns.

import { prisma } from "./prisma";

// Reserved bootstrap slug, seeded by scripts/migrate-rankings.ts (D1 in the design).
const ROOT_SLUG = "zank";

export const SETTING_KEYS = {
  discordAlertsEnabled: "discordAlertsEnabled",
  matchRecapChannelId: "matchRecapChannelId",
  predictionsChannelId: "predictionsChannelId",
  rankUpChannelId: "rankUpChannelId",
  accentColor: "accentColor",
  effectsEnabled: "effectsEnabled",
  siteName: "siteName",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// Narrower alias for getAllSettingsForWorkspace/getAllSettings below: Discord-only, so adding
// an unrelated key (e.g. appearance's accentColor) to SETTING_KEYS doesn't force every caller
// of that fixed-shape object to account for it.
type DiscordSettingKey = Exclude<SettingKey, "accentColor" | "effectsEnabled" | "siteName">;

// Resolves the root workspace every query is scoped to. Throws if the migration has not
// run (no root workspace exists). Not React.cache-memoized on purpose: this module is also
// used by long-running scripts (scripts/poll.ts), where request-scoped caching is wrong.
async function resolveRootWorkspace(): Promise<{ id: string }> {
  const root = await prisma.ranking.findUnique({ where: { slug: ROOT_SLUG } });
  if (!root) {
    throw new Error(
      `Root workspace "${ROOT_SLUG}" not found — run "npm run migrate-workspaces" first.`,
    );
  }
  return root;
}

// ---------------------------------------------------------------------------
// Workspace-parametrized API — used by the admin panel with the session's rankingId.
// ---------------------------------------------------------------------------

export async function getSettingForWorkspace(
  rankingId: string,
  key: SettingKey,
): Promise<string | undefined> {
  const row = await prisma.setting.findUnique({
    where: { rankingId_key: { rankingId, key } },
  });
  return row?.value;
}

export async function getAllSettingsForWorkspace(
  rankingId: string,
): Promise<Record<DiscordSettingKey, string | undefined>> {
  const rows = await prisma.setting.findMany({
    where: {
      rankingId,
      key: {
        in: [
          SETTING_KEYS.discordAlertsEnabled,
          SETTING_KEYS.matchRecapChannelId,
          SETTING_KEYS.predictionsChannelId,
          SETTING_KEYS.rankUpChannelId,
        ],
      },
    },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    discordAlertsEnabled: byKey.get(SETTING_KEYS.discordAlertsEnabled),
    matchRecapChannelId: byKey.get(SETTING_KEYS.matchRecapChannelId),
    predictionsChannelId: byKey.get(SETTING_KEYS.predictionsChannelId),
    rankUpChannelId: byKey.get(SETTING_KEYS.rankUpChannelId),
  };
}

export async function setSettingForWorkspace(
  rankingId: string,
  key: SettingKey,
  value: string,
): Promise<void> {
  await prisma.setting.upsert({
    where: { rankingId_key: { rankingId, key } },
    update: { value },
    create: { rankingId, key, value },
  });
}

// Removing the row (instead of storing an empty string) lets the env var fallback kick back in.
export async function deleteSettingForWorkspace(rankingId: string, key: SettingKey): Promise<void> {
  await prisma.setting.deleteMany({ where: { rankingId, key } });
}

// ---------------------------------------------------------------------------
// Root-scoped legacy API — used by the Discord bot code during the transition.
// ---------------------------------------------------------------------------

export async function getSetting(key: SettingKey): Promise<string | undefined> {
  const { id: rootId } = await resolveRootWorkspace();
  return getSettingForWorkspace(rootId, key);
}

export async function getAllSettings(): Promise<Record<DiscordSettingKey, string | undefined>> {
  const { id: rootId } = await resolveRootWorkspace();
  return getAllSettingsForWorkspace(rootId);
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const { id: rootId } = await resolveRootWorkspace();
  await setSettingForWorkspace(rootId, key, value);
}

export async function deleteSetting(key: SettingKey): Promise<void> {
  const { id: rootId } = await resolveRootWorkspace();
  await deleteSettingForWorkspace(rootId, key);
}
