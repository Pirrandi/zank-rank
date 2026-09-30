"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addTrackedAccount, deleteTrackedAccountCascade } from "@/lib/accounts";
import { requireRankingAdminAction } from "@/lib/ranking-access";
import { prisma } from "@/lib/prisma";

export async function addAccountAction(slug: string, formData: FormData): Promise<void> {
  const gameName = String(formData.get("gameName") ?? "").trim();
  const tagLine = String(formData.get("tagLine") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim() || "la2";
  const note = String(formData.get("note") ?? "").trim() || undefined;

  if (!gameName || !tagLine) {
    redirect(`/${slug}/admin/accounts?error=${encodeURIComponent("Falta el nombre o el tag.")}`);
  }

  // Server-action guard (design D2): the slug is bound by the page (see accounts/page.tsx)
  // and re-checked here — the layout guard alone does not stop this action from running.
  const { ranking } = await requireRankingAdminAction(slug);

  try {
    await addTrackedAccount(gameName, tagLine, platform, ranking.id, note);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido buscando la cuenta.";
    redirect(`/${slug}/admin/accounts?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/${slug}/admin/accounts`);
}

export async function removeAccountAction(slug: string, formData: FormData): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;

  // Server-action guard (design D2): only accounts owned by this ranking can be removed. A
  // foreign accountId must never cascade-delete another ranking's rows, so the lookup is
  // scoped to this ranking's id before touching the delete cascade.
  const { ranking } = await requireRankingAdminAction(slug);
  const account = await prisma.trackedAccount.findFirst({
    where: { id: accountId, rankingId: ranking.id },
    select: { id: true },
  });
  if (!account) {
    redirect(
      `/${slug}/admin/accounts?error=${encodeURIComponent("La cuenta no existe en este ranking.")}`,
    );
  }

  await deleteTrackedAccountCascade(account.id);
  revalidatePath(`/${slug}/admin/accounts`);
}
