import { NextResponse, type NextRequest } from "next/server";
import {
  createIdentitySessionToken,
  OAUTH_NEXT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  timingSafeEqualHex,
} from "@/lib/session";
import {
  exchangeCodeForToken,
  fetchDiscordProfile,
  isSafeInternalPath,
  upsertUser,
} from "@/lib/oauth";
import { ROOT_SLUG } from "@/lib/ranking";

// GET /api/auth/discord/callback — Discord redirects here after authorize (design D6):
// timing-safe state check, code → token exchange, /users/@me fetch, User upsert, then a `u.*`
// identity session token. Any failure → login?error=oauth with no session and the one-time
// state cookie cleared.
//
// Redirects are built against the PUBLIC origin (DISCORD_OAUTH_REDIRECT_URI), never request.url:
// behind the nginx proxy the server sees localhost:4200, and sending the browser there would
// break the login ("https://localhost:4200/..."). Deriving the origin from the configured OAuth
// redirect URI keeps the public host correct in every deploy without an extra env var.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Discord redirects with ?error=access_denied when the user cancels: clean failure, no code.
  if (url.searchParams.has("error") || !code || !state) {
    return oauthFailure(request);
  }

  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  if (!cookieState || !timingSafeEqualHex(cookieState, state)) {
    return oauthFailure(request);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return oauthFailure(request);
  }

  // Public origin for browser redirects (see module comment): the origin of the configured
  // OAuth redirect URI, e.g. https://zank.lol from https://zank.lol/api/auth/discord/callback.
  const publicOrigin = new URL(redirectUri).origin;

  try {
    const token = await exchangeCodeForToken({ code, clientId, clientSecret, redirectUri });
    if (!token) return oauthFailure(request);

    const profile = await fetchDiscordProfile(token.accessToken);
    if (!profile) return oauthFailure(request);

    const user = await upsertUser(profile);
    const sessionToken = await createIdentitySessionToken({ userId: user.id });

    // Task 5.3: the session returns to where the user started the login if that was recorded
    // and safe (e.g. /zank while spectating); otherwise it lands on /dashboard in hosted
    // edition or the root ranking's admin in self-hosted. The `next` cookie is re-validated
    // here — it was already guarded on write, but the callback never trusts it blindly.
    const next = request.cookies.get(OAUTH_NEXT_COOKIE_NAME)?.value;
    let defaultTarget = `/${ROOT_SLUG}/admin`;
    const target = next && isSafeInternalPath(next) ? next : defaultTarget;
    const res = NextResponse.redirect(new URL(target, publicOrigin));
    res.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    res.cookies.delete(OAUTH_NEXT_COOKIE_NAME);
    res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });
    return res;
  } catch (err) {
    console.error("Discord OAuth callback failed:", err);
    return oauthFailure(request);
  }
}

// Redirects to the login page with an OAuth error and clears the one-time state cookie (and
// any pending `next` cookie) so a stale flow can never resolve later.
function oauthFailure(request: NextRequest): NextResponse {
  const redirectUri = process.env.DISCORD_OAUTH_REDIRECT_URI;
  const publicOrigin = redirectUri ? new URL(redirectUri).origin : new URL(request.url).origin;
  const res = NextResponse.redirect(new URL("/admin/login?error=oauth", publicOrigin));
  res.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  res.cookies.delete(OAUTH_NEXT_COOKIE_NAME);
  return res;
}
