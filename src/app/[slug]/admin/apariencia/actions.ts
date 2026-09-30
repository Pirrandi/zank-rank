"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRankingAdminAction } from "@/lib/ranking-access";
import { setSettingForWorkspace, deleteSettingForWorkspace, SETTING_KEYS } from "@/lib/settings";
import { ACCENT_PRESETS } from "@/lib/appearance";
import { deleteRankingCascade, ensureUniqueSlug } from "@/lib/ranking";

// Server-action guard (design D2/D7/D8): re-checked here even though the page already guards
// ADMIN+, same pattern as acceso/actions.ts and settings/actions.ts.
export async function saveAppearanceAction(slug: string, formData: FormData): Promise<void> {
  const { ranking } = await requireRankingAdminAction(slug);

  const name = String(formData.get("name") ?? "").trim();
  if (name) {
    await setSettingForWorkspace(ranking.id, SETTING_KEYS.siteName, name);
  }

  const accent = String(formData.get("accent") ?? "");
  if (ACCENT_PRESETS.some((p) => p.hex === accent)) {
    await setSettingForWorkspace(ranking.id, SETTING_KEYS.accentColor, accent);
  }

  // Absence of the row means "on" (see appearance.ts), so an enabled checkbox just clears it
  // instead of writing a redundant "true" row.
  if (formData.get("effectsEnabled") === "on") {
    await deleteSettingForWorkspace(ranking.id, SETTING_KEYS.effectsEnabled);
  } else {
    await setSettingForWorkspace(ranking.id, SETTING_KEYS.effectsEnabled, "false");
  }

  revalidatePath(`/${slug}/admin/apariencia`);
  revalidatePath(`/${slug}`);
}

// OWNER-only (design: only the owner can destroy the whole ranking, not just ADMIN). The typed
// text must match the ranking's current name exactly (no trim, no case-insensitivity) — the
// same "type to confirm" pattern as other irreversible actions in this codebase.
export async function deleteRankingAction(slug: string, formData: FormData): Promise<void> {
  const { ranking } = await requireRankingAdminAction(slug, "OWNER");

  const confirmName = String(formData.get("confirmName") ?? "");
  if (confirmName !== ranking.name) {
    redirect(
      `/${slug}/admin/apariencia?error=${encodeURIComponent(
        "El nombre no coincide. El ranking no fue eliminado.",
      )}`,
    );
  }

  await deleteRankingCascade(ranking.id);
  redirect("/dashboard");
}

// OWNER-only (design: renaming the canonical identity, not just the cosmetic site name, is as
// consequential as deleting it — it moves the public URL). Unlike deleteRankingAction's "type
// to confirm" pattern, this only needs the new name: ensureUniqueSlug handles collisions.
export async function renameRankingAction(slug: string, formData: FormData): Promise<void> {
  const { ranking } = await requireRankingAdminAction(slug, "OWNER");

  const name = String(formData.get("rankingName") ?? "").trim();
  if (!name) {
    redirect(
      `/${slug}/admin/apariencia?error=${encodeURIComponent(
        "El nombre del ranking no puede estar vacío.",
      )}`,
    );
  }
  if (name === ranking.name) {
    redirect(`/${slug}/admin/apariencia`);
  }

  const newSlug = await ensureUniqueSlug(name, ranking.id);
  await prisma.ranking.update({ where: { id: ranking.id }, data: { name, slug: newSlug } });
  redirect(`/${newSlug}/admin/apariencia`);
}
