import { redirect } from "next/navigation";
import { ROOT_SLUG } from "@/lib/ranking";

// Legacy flat route → workspace-scoped page (design D5).
export const dynamic = "force-dynamic";

export default function MurosRedirect() {
  redirect(`/${ROOT_SLUG}/muros`);
}