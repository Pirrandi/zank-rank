"use client";

import { useState } from "react";

type FeedItem = { id: string; content: string; accent: string; kind: string };

export function BotPanel({ slug, accounts }: { slug: string; accounts: { id: string; gameName: string; tagLine: string }[] }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [selected, setSelected] = useState(accounts[0]?.id ?? "");
  const [rankQuery, setRankQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function simulate(kind: "rankup" | "rankdown") {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bot-preview?ws=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, accountId: selected }),
      });
      const data = await res.json();
      // 429 = cupo diario de IA de la versión web agotado.
      setNotice(res.status === 429 && typeof data?.error === "string" ? data.error : null);
      if (data?.content) {
        setFeed((f) => [{ id: `${Date.now()}`, content: data.content, accent: kind === "rankup" ? "var(--color-win)" : "var(--color-loss)", kind: "Avisos de rango" }, ...f]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function simulateRank() {
    if (!rankQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bot-preview?ws=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "rank", jugador: rankQuery.trim() }),
      });
      const data = await res.json();
      if (data?.content) {
        setFeed((f) => [{ id: `${Date.now()}`, content: data.content, accent: "var(--color-accent)", kind: "/rank" }, ...f]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-neutral-600)", fontWeight: 700 }}>
          Panel de prueba
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)} style={{ maxWidth: 220 }}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.gameName}#{a.tagLine}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={loading} onClick={() => simulate("rankup")}>
            Simular subida
          </button>
          <button className="btn btn-danger" disabled={loading} onClick={() => simulate("rankdown")}>
            Simular bajada
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="nombre#tag"
            value={rankQuery}
            onChange={(e) => setRankQuery(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <button className="btn" disabled={loading} onClick={simulateRank}>
            /rank
          </button>
        </div>
        {notice && <p style={{ margin: 0, fontSize: 12, color: "var(--color-loss)" }}>{notice}</p>}
      </div>

      {feed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {feed.map((item) => (
            <BotMessage key={item.id} content={item.content} accent={item.accent} kind={item.kind} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BotMessage({ content, accent, kind }: { content: string; accent: string; kind: string }) {
  return (
    <div className="card" style={{ display: "flex", gap: 12, padding: "12px 16px", borderLeft: `3px solid ${accent}` }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--color-violet)",
          color: "#1a1400",
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
          fontSize: 13,
        }}
      >
        Z
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>ZANK</span>
          <span
            className="mono"
            style={{ fontSize: 9, fontWeight: 800, color: "var(--color-violet)", border: "1px solid var(--color-violet-border)", borderRadius: 4, padding: "0 5px" }}
          >
            BOT
          </span>
          <span style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>· {kind}</span>
        </div>
        <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{content}</div>
      </div>
    </div>
  );
}
