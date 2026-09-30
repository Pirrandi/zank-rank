import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import type { Ranking } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccountByRiotId } from "@/lib/riot";
import {
  placeBet,
  getOrCreateBettor,
  parseWagerAmount,
  STARTING_BALANCE,
  claimDailyBonus,
  formatCountdown,
} from "@/lib/betting";
import { refreshRoundStatsMessage } from "@/lib/prediction-stats-message";
import { buildRankReply } from "@/lib/rank-reply";
import { resolveBotRanking, RANKING_NOT_LINKED_MESSAGE } from "@/lib/bot-ranking";

const ADMIN_ROLE_ID = "1342180889123098695";
const EPHEMERAL = 64;

type DiscordInteractionOption = {
  name: string;
  value: string;
};

type DiscordModalComponentRow = {
  components: { custom_id: string; value: string }[];
};

type DiscordInteraction = {
  type: number;
  // Present for a guild interaction, absent for a DM (design D12).
  guild_id?: string;
  member?: { roles?: string[]; user?: { id: string; username: string } };
  data?: {
    name?: string;
    custom_id?: string;
    options?: DiscordInteractionOption[];
    components?: DiscordModalComponentRow[];
  };
};

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function verifySignature(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey || !signature || !timestamp) return false;

  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + rawBody),
      hexToUint8Array(signature),
      hexToUint8Array(publicKey)
    );
  } catch {
    return false;
  }
}

// `ephemeral` solo para el aviso de límite de la versión web: lo ve únicamente quien lo pidió.
async function buildAddPlayerReply(
  ranking: Ranking,
  nombre: string,
  tag: string,
): Promise<{ content: string; ephemeral?: boolean }> {
  try {
    const riotAccount = await getAccountByRiotId(nombre, tag);
    let saved: Awaited<ReturnType<typeof prisma.trackedAccount.upsert>> | undefined;
    if (!saved) {
      saved = await prisma.trackedAccount.upsert({
        where: { rankingId_puuid: { rankingId: ranking.id, puuid: riotAccount.puuid } },
        update: { gameName: riotAccount.gameName, tagLine: riotAccount.tagLine },
        create: {
          gameName: riotAccount.gameName,
          tagLine: riotAccount.tagLine,
          puuid: riotAccount.puuid,
          platform: "la2",
          rankingId: ranking.id,
        },
      });
    }
    return {
      content: `✅ Agregado **${saved.gameName}#${saved.tagLine}** al ranking. Va a aparecer con datos en el próximo sync.`,
    };
  } catch (err) {
    return {
      content: `❌ No pude agregar a **${nombre}#${tag}**. Fijate que el Riot ID esté bien escrito. (${err instanceof Error ? err.message : "error desconocido"})`,
    };
  }
}

async function buildBetModal(
  customId: string,
  userId: string | undefined,
  username: string | undefined
): Promise<{ content: string } | { modal: Record<string, unknown> }> {
  const [prefix, choice, roundId] = customId.split(":");
  if (prefix !== "predict" || (choice !== "win" && choice !== "lose") || !roundId) {
    return { content: "Botón no reconocido." };
  }
  if (!userId || !username) {
    return { content: "No pude identificarte." };
  }

  // Vista previa de admin (src/lib/discord.ts sendTemplatePreview): botones sin ronda real
  // detrás. El modal y la confirmación se simulan por completo, sin tocar Bettor/Prediction.
  if (roundId === "preview") {
    return {
      modal: {
        custom_id: `bet_modal:${choice}:preview`,
        title: choice === "win" ? "Apostar a que GANA (prueba)" : "Apostar a que PIERDE (prueba)",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "amount",
                style: 1,
                label: `Fichas de mentira a apostar (tenés ${STARTING_BALANCE} de prueba)`,
                required: false,
                placeholder: `Máximo ${STARTING_BALANCE}, vacío = apuesta mínima`,
              },
            ],
          },
        ],
      },
    };
  }

  // Bet buttons resolve their ranking through the round they belong to (design D12), not
  // through the interacting guild — the round already fixes which ranking's game this is.
  const round = await prisma.predictionRound.findUnique({
    where: { id: roundId },
    select: { rankingId: true },
  });
  if (!round) {
    return { content: "Esta apuesta ya no existe." };
  }

  // Una sola apuesta por cuenta de Discord y por ronda (ver placeBet): si ya hay una cargada,
  // ni siquiera abrimos el modal — no importa si se cargó desde acá o desde la web.
  const existing = await prisma.prediction.findUnique({
    where: { roundId_discordUserId: { roundId, discordUserId: userId } },
  });
  if (existing) {
    return { content: "Ya apostaste en esta partida." };
  }

  const bettor = await getOrCreateBettor(round.rankingId, userId, username);

  return {
    modal: {
      custom_id: `bet_modal:${choice}:${roundId}`,
      title: choice === "win" ? "Apostar a que GANA" : "Apostar a que PIERDE",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "amount",
              style: 1,
              label: `Fichas a apostar (tenés ${bettor.balance})`,
              required: false,
              placeholder: bettor.balance > 0 ? `Máximo ${bettor.balance}, vacío = apuesta mínima` : "Sin fichas — apostá igual, gratis",
            },
          ],
        },
      ],
    },
  };
}

async function buildBetSubmitReply(interaction: DiscordInteraction): Promise<string> {
  const customId = interaction.data?.custom_id ?? "";
  const [prefix, choice, roundId] = customId.split(":");
  if (prefix !== "bet_modal" || (choice !== "win" && choice !== "lose") || !roundId) {
    return "Algo salió mal con la apuesta.";
  }

  const userId = interaction.member?.user?.id;
  const username = interaction.member?.user?.username;
  if (!userId || !username) {
    return "No pude identificarte.";
  }

  const amountText = interaction.data?.components?.[0]?.components?.[0]?.value ?? "";

  // Confirmación simulada de la vista previa: nunca llama a placeBet, así que no hay ronda,
  // apostador ni saldo real involucrados.
  if (roundId === "preview") {
    const amount = parseWagerAmount(amountText, STARTING_BALANCE);
    const guessLabel = choice === "win" ? "gana" : "pierde";
    return amount > 0
      ? `🧪 Apuesta de prueba: apostaste **${amount}** fichas de mentira a que **${guessLabel}**. Saldo de prueba restante: ${STARTING_BALANCE - amount}. *(No se guardó nada de verdad.)*`
      : `🧪 Apuesta de prueba anotada (sin fichas de por medio) a que **${guessLabel}**. *(No se guardó nada de verdad.)*`;
  }

  const result = await placeBet(roundId, userId, username, choice === "win", amountText);

  if (!result.ok) {
    return result.error;
  }

  try {
    await refreshRoundStatsMessage(roundId);
  } catch (err) {
    console.error(`Failed to refresh prediction stats message for round ${roundId}:`, err);
  }

  return result.amount > 0
    ? `Apostaste **${result.amount}** fichas a que **${choice === "win" ? "gana" : "pierde"}**. Saldo restante: ${result.balanceAfter}.`
    : `Apuesta anotada (sin fichas de por medio) a que **${choice === "win" ? "gana" : "pierde"}**. Si acertás igual ganás algo.`;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  if (!verifySignature(rawBody, signature, timestamp)) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  if (interaction.type === 3) {
    const result = await buildBetModal(
      interaction.data?.custom_id ?? "",
      interaction.member?.user?.id,
      interaction.member?.user?.username
    );
    if ("modal" in result) {
      return NextResponse.json({ type: 9, data: result.modal });
    }
    return NextResponse.json({
      type: 4,
      data: { content: result.content, flags: EPHEMERAL },
    });
  }

  if (interaction.type === 5) {
    const content = await buildBetSubmitReply(interaction);
    return NextResponse.json({
      type: 4,
      data: { content, flags: EPHEMERAL },
    });
  }

  if (interaction.type === 2) {
    // Design D12: a slash command from an unlinked guild (hosted) or a DM (no guild_id) gets
    // an ephemeral "not linked" reply and never reaches Prisma. Self-hosted always falls back
    // to the root ranking instead.
    const resolution = await resolveBotRanking(interaction.guild_id);
    if (!resolution.ok) {
      return NextResponse.json({
        type: 4,
        data: { content: RANKING_NOT_LINKED_MESSAGE, flags: EPHEMERAL },
      });
    }
    const ranking = resolution.ranking;

    if (interaction.data?.name === "rank") {
      const jugador = interaction.data.options?.find((o) => o.name === "jugador")?.value;
      const content = jugador
        ? await buildRankReply(jugador, ranking.id)
        : "Decime a quién querés consultar con la opción `jugador`.";

      return NextResponse.json({
        type: 4,
        data: { content },
      });
    }

    if (interaction.data?.name === "agregar-jugador") {
      const isAdmin = interaction.member?.roles?.includes(ADMIN_ROLE_ID) ?? false;
      if (!isAdmin) {
        return NextResponse.json({
          type: 4,
          data: { content: "🚫 Este comando es solo para Admin Zank.", flags: EPHEMERAL },
        });
      }

      const nombre = interaction.data.options?.find((o) => o.name === "nombre")?.value;
      const tag = interaction.data.options?.find((o) => o.name === "tag")?.value;
      const reply =
        nombre && tag
          ? await buildAddPlayerReply(ranking, nombre, tag)
          : { content: "Faltan datos: necesito `nombre` y `tag`." };

      return NextResponse.json({
        type: 4,
        data: reply.ephemeral ? { content: reply.content, flags: EPHEMERAL } : { content: reply.content },
      });
    }

    if (interaction.data?.name === "reclamar") {
      const userId = interaction.member?.user?.id;
      const username = interaction.member?.user?.username;
      if (!userId || !username) {
        return NextResponse.json({
          type: 4,
          data: { content: "No pude identificarte.", flags: EPHEMERAL },
        });
      }

      const result = await claimDailyBonus(ranking.id, userId, username);
      const content = result.ok
        ? `🎁 Reclamaste **${result.amount}** ZankCoins gratis. Saldo: ${result.balanceAfter}.`
        : `Ya reclamaste tu bono hoy. Volvé a intentar en ${formatCountdown(result.nextClaimAt, Date.now())}.`;

      return NextResponse.json({
        type: 4,
        data: { content, flags: EPHEMERAL },
      });
    }

    return NextResponse.json({
      type: 4,
      data: { content: "No reconozco ese comando." },
    });
  }

  return new NextResponse("unhandled interaction type", { status: 400 });
}
