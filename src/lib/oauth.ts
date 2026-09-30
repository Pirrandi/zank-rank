// Discord OAuth helpers (design D6). Server-only module: uses Prisma and is called from the
// /api/auth/discord route handlers. Kept free of next/server imports so the flows can be
// exercised from a plain tsx harness against the real database.

import { prisma } from "./prisma";
import type { User } from "@prisma/client";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_API_URL = "https://discord.com/api";

export type DiscordProfile = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

// Random 32-char hex state for the OAuth CSRF round-trip (design D6). Web Crypto is available
// in both Node and Edge runtimes.
export function generateOAuthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Open-redirect guard for the OAuth `next` param (design D6): only internal relative paths are
// accepted. Valid only when the path starts with "/" and its second character is neither "/"
// nor "\" — both "//evil.com" (protocol-relative) and "/\evil.com" get treated as an authority
// by WHATWG URL parsing (browsers normalize "\" to "/" for special schemes before parsing), so
// `new URL(target, publicOrigin)` in the callback would resolve either one to an external host.
// Also blocks a ":" before the first "/" (blocks "https://evil.com", "javascript:...", etc.).
// Everything else → false, and callers treat it as absent.
export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path[1] === "/" || path[1] === "\\") return false;
  const firstSlash = path.indexOf("/");
  const colon = path.indexOf(":");
  return colon === -1 || colon > firstSlash;
}

// Discord authorize URL with the identify scope and the state echoed back.
export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: "code",
    redirect_uri: input.redirectUri,
    scope: "identify",
    state: input.state,
  });
  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
}


// Exchanges the one-time authorization code for an access token. Returns null when Discord
// rejects the exchange (bad/expired code, invalid client, network error).
export async function exchangeCodeForToken(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ accessToken: string } | null> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
  });

  try {
    const res = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ? { accessToken: data.access_token } : null;
  } catch {
    return null;
  }
}

// Fetches the authenticated user's profile (/users/@me). Returns null on any failure.
export async function fetchDiscordProfile(
  accessToken: string,
): Promise<DiscordProfile | null> {
  try {
    const res = await fetch(`${DISCORD_API_URL}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const profile = (await res.json()) as DiscordProfile;
    if (!profile.id || !profile.username) return null;
    return profile;
  } catch {
    return null;
  }
}

// Finds the user by Discord id (refreshing their profile) or creates them. PR5 stopped
// auto-creating a ranking on login (design: dashboard's "first login, zero rankings" scenario;
// hosted users create their own ranking from /dashboard/new, self-hosted only ever has the
// pre-seeded root ranking).
export async function upsertUser(profile: DiscordProfile): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { discordId: profile.id } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { username: profile.username, avatar: profile.avatar ?? null },
    });
  }
  return prisma.user.create({
    data: { discordId: profile.id, username: profile.username, avatar: profile.avatar ?? null },
  });
}
