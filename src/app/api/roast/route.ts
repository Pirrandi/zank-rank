import { NextRequest, NextResponse } from "next/server";
import { generateRoast } from "@/lib/groq";
import { getRankingAccess } from "@/lib/ranking-access";

// Ranking-scoped, canInteract-gated (design D6/D7/D10): ?ranking=<slug> must resolve and the
// caller must be allowed to interact with it (logged in for a PRIVATE ranking, or any visitor
// in self-hosted/PUBLIC) before the roast generator burns an LLM call on their behalf.
export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("ranking") ?? "";
  const access = await getRankingAccess(slug);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!access.canInteract) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => undefined);
  const { kind, label, gameName, tagLine, value, unit } = body ?? {};
  if (typeof gameName !== "string" || typeof tagLine !== "string") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const flavor = kind === "fame" ? "un logro para celebrar y cargosear con cariño" : "una vergüenza para hacerle roast sin piedad";
  const prompt = `Sos parte de un grupo de amigos que juega League of Legends y se cargosean en su ranking privado. Escribí UNA sola frase corta (máximo 14 palabras), en español rioplatense/chileno informal, sin comillas ni emojis, sobre ${gameName}#${tagLine} que tiene "${label}": ${value} ${unit ?? ""}. Es ${flavor}.`;


  const roast = await generateRoast(prompt);
  return NextResponse.json({ roast });
}
