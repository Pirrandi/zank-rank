"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteSettingForWorkspace,
  setSettingForWorkspace,
  SETTING_KEYS,
} from "@/lib/settings";
import { requireRankingAdminAction } from "@/lib/ranking-access";
import { sendTemplatePreview, type TemplatePreviewKind } from "@/lib/discord";

export async function saveSettingsAction(slug: string, formData: FormData): Promise<void> {
  // Server-action guard (design D2/D7/D8): settings are saved to this ranking, bound from the
  // page (see settings/page.tsx) and re-checked here.
  const { ranking } = await requireRankingAdminAction(slug);
  const rankingId = ranking.id;

  const discordAlertsEnabled = formData.get("discordAlertsEnabled") === "on";
  const matchRecapChannelId = String(formData.get("matchRecapChannelId") ?? "").trim();
  const predictionsChannelId = String(formData.get("predictionsChannelId") ?? "").trim();
  const rankUpChannelId = String(formData.get("rankUpChannelId") ?? "").trim();

  await setSettingForWorkspace(
    rankingId,
    SETTING_KEYS.discordAlertsEnabled,
    discordAlertsEnabled ? "true" : "false",
  );

  // Empty field = "no override", so delete the row instead of storing "" and let the env var
  // fallback take over again.
  if (matchRecapChannelId) {
    await setSettingForWorkspace(rankingId, SETTING_KEYS.matchRecapChannelId, matchRecapChannelId);
  } else {
    await deleteSettingForWorkspace(rankingId, SETTING_KEYS.matchRecapChannelId);
  }

  if (predictionsChannelId) {
    await setSettingForWorkspace(rankingId, SETTING_KEYS.predictionsChannelId, predictionsChannelId);
  } else {
    await deleteSettingForWorkspace(rankingId, SETTING_KEYS.predictionsChannelId);
  }

  if (rankUpChannelId) {
    await setSettingForWorkspace(rankingId, SETTING_KEYS.rankUpChannelId, rankUpChannelId);
  } else {
    await deleteSettingForWorkspace(rankingId, SETTING_KEYS.rankUpChannelId);
  }

  revalidatePath(`/${slug}/admin/settings`);
}

// The kind travels bound in the closure (one formAction per channel): React does NOT include
// the clicked button's name/value in the FormData of a server-action formAction submit, so a
// shared action cannot recover which button fired it from formData.
export async function sendTestAlertAction(
  slug: string,
  kind: TemplatePreviewKind,
  formData: FormData,
): Promise<void> {
  await requireRankingAdminAction(slug);

  // The form value wins so the admin can test a selection before saving it; the env fallback
  // chain mirrors the one shown under each field on the settings page.
  const formName =
    kind === "matchRecap"
      ? "matchRecapChannelId"
      : kind === "predictions"
        ? "predictionsChannelId"
        : "rankUpChannelId";
  const envFallback =
    kind === "matchRecap"
      ? (process.env.DISCORD_MATCH_RECAP_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "")
      : kind === "predictions"
        ? (process.env.DISCORD_PREDICTIONS_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "")
        : (process.env.DISCORD_RANKUP_CHANNEL_ID ?? process.env.DISCORD_CHANNEL_ID ?? "");

  const channelId = String(formData.get(formName) ?? "").trim() || envFallback;
  if (!channelId) {
    redirect(
      `/${slug}/admin/settings?error=${encodeURIComponent(
        "No hay canal configurado para esa prueba. Elegí un canal o definí la variable de entorno."
      )}`
    );
  }

  const result = await sendTemplatePreview(kind, channelId);
  if (result.ok) {
    redirect(`/${slug}/admin/settings?testOk=${kind}`);
  }
  redirect(`/${slug}/admin/settings?error=${encodeURIComponent(result.error)}`);
}
