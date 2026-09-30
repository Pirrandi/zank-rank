"use client";

import { useState } from "react";
import Link from "next/link";
import { ReactionChips } from "@/app/reaction-chips";
import type { RankedQueueParam } from "@/lib/queues";

// Reaction key of a wall card. Solo/Dúo keeps the original, queue-less key so the reactions
// given before the walls were split stay on it; Flex cards get their own ":flex" key.
function wallReactionKey(kind: "fame" | "shame", id: string, label: string, queue: RankedQueueParam): string {
  const base = `muro:${kind}:${id}:${label}`;
  return queue === "flex" ? `${base}:flex` : base;
}

export function RoastCard({
  slug,
  queue,
  kind,
  emoji,
  label,
  id,
  iconUrl,
  gameName,
  tagLine,
  value,
  unit,
  initialRoast,
  accent,
}: {
  slug: string;
  queue: RankedQueueParam;
  kind: "fame" | "shame";
  emoji: string;
  label: string;
  id: string;
  iconUrl?: string;
  gameName: string;
  tagLine: string;
  value: string;
  unit: string;
  initialRoast: string;
  accent: string;
}) {
  const [roast, setRoast] = useState(initialRoast);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/roast?ranking=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, label, gameName, tagLine, value, unit }),
      });
      const data = await res.json();
      // 429 = cupo diario de IA de la versión web agotado: se muestra el aviso del servidor.
      setNotice(res.status === 429 && typeof data?.error === "string" ? data.error : null);
      if (data?.roast) setRoast(data.roast);
    } catch {
      // keep whatever roast is already showing
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, borderColor: accent }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-neutral-600)", fontWeight: 700 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
          {label}
        </div>
      </div>

      <Link href={`/${slug}/players/${id}`} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 16, color: "inherit", textDecoration: "none" }}>
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" width={28} height={28} style={{ flex: "none", borderRadius: 8 }} />
        )}
        <span>
        {gameName}
        <span style={{ color: "var(--color-neutral-500)", fontWeight: 400 }}>#{tagLine}</span>
        </span>
      </Link>

      <div className="mono" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 28, color: accent }}>{value}</span>
        <span style={{ fontSize: 11, color: "var(--color-neutral-500)", fontWeight: 700 }}>{unit}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className="mono"
            style={{ fontSize: 9, fontWeight: 800, color: "var(--color-violet)", border: "1px solid var(--color-violet-border)", borderRadius: 999, padding: "1px 6px", flex: "none" }}
          >
            IA
          </span>
          <div style={{ fontSize: 12, color: "var(--color-neutral-700)", opacity: loading ? 0.5 : 1 }}>{roast}</div>
        </div>
        <button
          onClick={regenerate}
          disabled={loading}
          title="Regenerar"
          className="mono"
          style={{
            flex: "none",
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "1px solid var(--color-divider)",
            background: "transparent",
            color: "var(--color-neutral-500)",
            cursor: loading ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading ? <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "zkSpin 0.7s linear infinite" }} /> : "↻"}
        </button>
      </div>

      {notice && <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>{notice}</div>}

      <ReactionChips slug={slug} targetKey={wallReactionKey(kind, id, label, queue)} labels={["GG", "F", "KEKW", "EZ"]} />
    </div>
  );
}
