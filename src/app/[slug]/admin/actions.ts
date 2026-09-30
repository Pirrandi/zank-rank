"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OAUTH_STATE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/session";

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
  redirect("/admin/login");
}
