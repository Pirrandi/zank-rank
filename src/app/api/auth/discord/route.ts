import { NextResponse, type NextRequest } from "next/server";
import {
  OAUTH_NEXT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_TTL_MS,
} from "@/lib/session";
import { buildAuthorizeUrl, generateOAuthState, isSafeInternalPath } from "@/lib/oauth";

// GET /api/auth/discord — starts the Discord OAuth flow (design D6): stores a short-lived
// httpOnly state cookie and redirects to Discord's authorize page (identify scope).
// Env-gated: without DISCORD_CLIENT_ID the login UI never renders the button, and hitting this
// URL directly falls back to the login page with an error.
export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/admin/login?error=oauth", request.url));
  }

  // Optional `next` param: the page where the user started the login (e.g. /zank while
  // spectating, or /admin from the panel). Persisted in a short-lived httpOnly cookie so the
  // callback can return them there after Discord's round-trip. Only internal relative paths
  // are accepted (open-redirect guard); invalid/absent values are ignored and the callback
  // falls back to the user's own workspace.
  const next = request.nextUrl.searchParams.get("next");

  const state = generateOAuthState();
  const res = NextResponse.redirect(new URL(buildAuthorizeUrl({ clientId, redirectUri, state })));
  res.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1000),
  });
  if (next && isSafeInternalPath(next)) {
    res.cookies.set(OAUTH_NEXT_COOKIE_NAME, next, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1000),
    });
  }
  return res;
}