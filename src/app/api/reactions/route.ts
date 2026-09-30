import { NextRequest, NextResponse } from "next/server";
import { getReactionStates, toggleReaction } from "@/lib/reactions";
import { getRankingAccess } from "@/lib/ranking-access";

const VALID_LABELS = new Set(["GG", "F", "KEKW", "EZ"]);

// Reactions live in the ranking resolved from ?ws=<slug>, canView-gated (design D5/D6) so no
// row from another (or a PRIVATE) ranking is ever read.
export async function GET(req: NextRequest) {
  const access = await resolveAccess(req);
  if (!access || !access.canView) return notFoundJson();

  const targetKeys = (req.nextUrl.searchParams.get("targetKeys") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  // Identity (design D10): hosted trusts only the session user, never the client-supplied id
  // (so "mine" can't be spoofed); self-hosted keeps accepting the anonymous localStorage id.
  let userId: string | undefined = req.nextUrl.searchParams.get("userId") ?? undefined;

  const states = await getReactionStates(targetKeys, userId, access.ranking.id);
  return NextResponse.json(states);
}

export async function POST(req: NextRequest) {
  const access = await resolveAccess(req);
  if (!access || !access.canView) return notFoundJson();
  if (!access.canInteract) {
    // Hosted with no session (design D10 "no session" scenario) and PRIVATE-non-member both
    // fall here; the spec calls out the no-session case as 401 specifically.
    return NextResponse.json({ error: "unauthorized" }, { status: access.user ? 403 : 401 });
  }

  const body = await req.json().catch(() => undefined);
  const targetKey = typeof body?.targetKey === "string" ? body.targetKey : undefined;
  const label = typeof body?.label === "string" ? body.label : undefined;
  // Identity (design D10): hosted ignores any client-supplied userId and uses the session
  // user; self-hosted keeps accepting the client's anonymous id, as today.
  let userId: string | undefined = typeof body?.userId === "string" ? body.userId : undefined;

  if (!targetKey || !userId || !label || !VALID_LABELS.has(label)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const state = await toggleReaction(targetKey, userId, label, access.ranking.id);
  return NextResponse.json(state);
}

async function resolveAccess(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("ws") ?? "";
  return getRankingAccess(slug);
}

function notFoundJson() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
