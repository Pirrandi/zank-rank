"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OAUTH_STATE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/session";

// Logout público: borra la cookie de sesión (y cualquier estado OAuth residual) y vuelve
// a la landing `/`. A diferencia del logout del panel de admin (src/app/admin/actions.ts),
// este apunta a la raíz, no a /admin/login.
export async function publicLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
  redirect("/");
}