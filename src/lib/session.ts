// Admin session tokens: signed, expiring tokens stored in an httpOnly cookie.
//
// Token shapes, all HMAC-SHA256 signed with the Web Crypto API (design D4):
//
//   - "admin.<expiresAtMs>.<hmac>"                    — legacy admin token (password
//     fallback). Resolves to the OWNER of the root ranking (see ranking-access.ts).
//   - "u.<userId>.<expiresAtMs>.<hmac>"               — current identity token: carries
//     only the session's User id. Ranking context is resolved per-request from the URL
//     slug plus a RankingMember role check, never from the token.
//   - "u.<userId>.<rankingId>.<expiresAtMs>.<hmac>"   — legacy (pre-multi-tenant) identity
//     token. Still verified with its original payload so existing cookies are not
//     invalidated; the ranking segment is parsed but ignored by every caller.
//
// The whole payload before the hmac is signed, so the expiration cannot be tampered with.
//
// Uses the Web Crypto API (crypto.subtle) instead of node:crypto so this module can be
// imported both from Node.js request handlers/server actions AND from middleware.ts, which
// Next.js runs on the Edge runtime (no node:crypto/Buffer there). Web Crypto is available in
// both environments without adding a dependency.
//
// KEEP THIS MODULE EDGE-SAFE: no Prisma, no next/headers, no node:crypto. middleware.ts
// imports it directly and must keep bundling for the Edge runtime.

export const SESSION_COOKIE_NAME = "zank_admin_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// OAuth state cookie for the Discord login flow: short-lived CSRF protection (design D6).
export const OAUTH_STATE_COOKIE_NAME = "zank_oauth_state";
export const OAUTH_STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// OAuth "next" cookie: short-lived httpOnly record of the page where the user started the
// login, so the callback can redirect back there instead of always landing on their own
// workspace. Same TTL as the state cookie: it only needs to survive Discord's round-trip.
export const OAUTH_NEXT_COOKIE_NAME = "zank_oauth_next";


function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET env var is not set");
  }
  return secret;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time hex comparison, used for the session signature and the OAuth state check
// (design D6). Exported so the callback route reuses the same implementation.
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacHex(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return bufToHex(sig);
}

// Token shape: "admin.<expiresAtMs>.<hmacHex>"
export async function createSessionToken(): Promise<string> {
  const secret = getSessionSecret();
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `admin.${expiresAt}`;
  const sig = await hmacHex(payload, secret);
  return `${payload}.${sig}`;
}

// Token shape: "u.<userId>.<expiresAtMs>.<hmacHex>" (design D4 — user-only identity token).
export async function createIdentitySessionToken(input: { userId: string }): Promise<string> {
  const secret = getSessionSecret();
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `u.${input.userId}.${expiresAt}`;
  const sig = await hmacHex(payload, secret);
  return `${payload}.${sig}`;
}

// Structured verification result: what the token claims and whether it is valid. The legacy
// 5-part shape is parsed but never surfaces its ranking segment — every caller resolves ranking
// context from the URL slug instead (design D4).
export type SessionIdentity =
  | { ok: true; kind: "user"; userId: string; expiresAt: number }
  | { ok: true; kind: "legacy-admin"; expiresAt: number }
  | { ok: false; reason: string };

export async function verifySessionIdentity(
  token: string | undefined | null
): Promise<SessionIdentity> {
  if (!token) return { ok: false, reason: "missing-token" };

  const parts = token.split(".");

  // Current shape: "u.<userId>.<expiresAtMs>.<hmacHex>".
  if (parts.length === 4 && parts[0] === "u") {
    const [, userId, expiresAtStr, sig] = parts;
    if (!userId) return { ok: false, reason: "malformed-identity" };
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return { ok: false, reason: "expired" };
    }
    const secret = getSessionSecret();
    const expectedSig = await hmacHex(`u.${userId}.${expiresAtStr}`, secret);
    if (!timingSafeEqualHex(sig, expectedSig)) return { ok: false, reason: "bad-signature" };
    return { ok: true, kind: "user", userId, expiresAt };
  }

  // Legacy shape: "u.<userId>.<rankingId>.<expiresAtMs>.<hmacHex>". Verified against its
  // original payload (including the ranking segment) so pre-existing cookies keep working;
  // the ranking segment itself is discarded once the signature checks out.
  if (parts.length === 5 && parts[0] === "u") {
    const [, userId, legacyRankingId, expiresAtStr, sig] = parts;
    if (!userId || !legacyRankingId) return { ok: false, reason: "malformed-identity" };
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return { ok: false, reason: "expired" };
    }
    const secret = getSessionSecret();
    const expectedSig = await hmacHex(`u.${userId}.${legacyRankingId}.${expiresAtStr}`, secret);
    if (!timingSafeEqualHex(sig, expectedSig)) return { ok: false, reason: "bad-signature" };
    return { ok: true, kind: "user", userId, expiresAt };
  }

  if (parts.length === 3 && parts[0] === "admin") {
    const [, expiresAtStr, sig] = parts;
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return { ok: false, reason: "expired" };
    }
    const secret = getSessionSecret();
    const expectedSig = await hmacHex(`admin.${expiresAtStr}`, secret);
    if (!timingSafeEqualHex(sig, expectedSig)) return { ok: false, reason: "bad-signature" };
    return { ok: true, kind: "legacy-admin", expiresAt };
  }

  return { ok: false, reason: "malformed-token" };
}

// Crypto-only validity gate (accepts identity and legacy admin tokens). Kept as a plain
// boolean so middleware.ts can use it unchanged as the Edge-side gate.
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  return (await verifySessionIdentity(token)).ok;
}
