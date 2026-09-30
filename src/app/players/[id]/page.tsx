import { redirect } from "next/navigation";
import { ROOT_SLUG } from "@/lib/ranking";

// Legacy flat route → workspace-scoped page (design D5).
export const dynamic = "force-dynamic";

export default async function PlayersRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/${ROOT_SLUG}/players/${id}`);
}