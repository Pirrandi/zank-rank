import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tierLabel } from "@/lib/tier-colors";
import { generateRoast } from "@/lib/groq";
import { buildRankReply } from "@/lib/rank-reply";
import { requireRankingViewApi, isPolicyDenial } from "@/lib/ranking-policy";

// Preview-only: never posts to Discord, just reuses the same real data + roast
// generator the bot uses so the preview isn't fabricated copy. Scoped to the
// ranking resolved from ?ws=<slug>, canView-gated (design D5/D6).
export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("ws") ?? "";
  const result = await requireRankingViewApi(slug);
  if (isPolicyDenial(result)) return result;
  const workspace = result.ranking;

  const body = await req.json().catch(() => undefined);
  const kind = body?.kind;

  if (kind === "rank") {
    const jugador = typeof body?.jugador === "string" ? body.jugador : "";
    const content = await buildRankReply(jugador, workspace.id);
    return NextResponse.json({ content });
  }

  if (kind === "rankup" || kind === "rankdown") {
    const accountId = typeof body?.accountId === "string" ? body.accountId : undefined;
    if (!accountId) return NextResponse.json({ error: "accountId requerido" }, { status: 400 });

    const account = await prisma.trackedAccount.findFirst({
      where: { id: accountId, rankingId: workspace.id },
    });
    const snapshot = await prisma.rankSnapshot.findFirst({
      where: { accountId, queueType: "RANKED_SOLO_5x5", rankingId: workspace.id },
      orderBy: { capturedAt: "desc" },
    });
    if (!account || !snapshot) return NextResponse.json({ error: "sin datos" }, { status: 404 });

    const label = tierLabel(snapshot.tier, snapshot.rank);
    const prompt =
      kind === "rankup"
        ? `Escribí una frase corta (máximo 16 palabras) en español informal, hype, sin comillas ni emojis, celebrando que ${account.gameName}#${account.tagLine} acaba de subir a ${label} con ${snapshot.leaguePoints} LP.`
        : `Escribí una frase corta (máximo 16 palabras) en español informal, con roast filoso, sin comillas ni emojis, sobre que ${account.gameName}#${account.tagLine} acaba de bajar de rango y quedó en ${label} con ${snapshot.leaguePoints} LP.`;


    const roast = await generateRoast(prompt);
    const fallback = kind === "rankup" ? `¡Subió a ${label}!` : `Bajó a ${label}...`;
    const emoji = kind === "rankup" ? "🎉" : "💩";
    return NextResponse.json({
      content: `${emoji} ${roast ?? fallback}`,
      gameName: account.gameName,
      tagLine: account.tagLine,
      label,
      leaguePoints: snapshot.leaguePoints,
    });
  }

  return NextResponse.json({ error: "kind invalido" }, { status: 400 });
}
