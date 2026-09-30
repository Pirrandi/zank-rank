import { redirect } from "next/navigation";
import { ROOT_SLUG } from "@/lib/ranking";

export const dynamic = "force-dynamic";

// Legacy `/admin[/...]` catch-all (design D3): the admin panel moved to `/<slug>/admin/*`.
// `/admin/login` is a literal sibling route and is never matched here (Next.js resolves it
// before falling back to this optional catch-all).
export default async function LegacyAdminRedirect({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const suffix = path && path.length > 0 ? `/${path.join("/")}` : "";
  redirect(`/${ROOT_SLUG}/admin${suffix}`);
}
