"use client";

import { useEffect, useState } from "react";
import { getAnonId } from "@/lib/anon-id";

type State = { counts: Record<string, number>; mine: string[] };

export function ReactionChips({ slug, targetKey, labels }: { slug: string; targetKey: string; labels: string[] }) {
  const [state, setState] = useState<State>({ counts: {}, mine: [] });

  useEffect(() => {
    const id = getAnonId();
    fetch(`/api/reactions?ws=${encodeURIComponent(slug)}&targetKeys=${encodeURIComponent(targetKey)}&userId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => setState(data[targetKey] ?? { counts: {}, mine: [] }))
      .catch(() => undefined);
  }, [targetKey, slug]);

  async function toggle(label: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const id = getAnonId();
    const wasMine = state.mine.includes(label);
    setState((s) => ({
      counts: { ...s.counts, [label]: Math.max(0, (s.counts[label] ?? 0) + (wasMine ? -1 : 1)) },
      mine: wasMine ? s.mine.filter((l) => l !== label) : [...s.mine, label],
    }));
    try {
      const res = await fetch(`/api/reactions?ws=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetKey, userId: id, label }),
      });
      const data = await res.json();
      if (data?.counts) setState(data);
    } catch {
      // best-effort — the optimistic state stays if the request fails
    }
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      {labels.map((label) => {
        const active = state.mine.includes(label);
        const count = state.counts[label] ?? 0;
        return (
          <button
            key={label}
            onClick={(e) => toggle(label, e)}
            className="mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 28,
              fontSize: 11,
              fontWeight: 700,
              padding: "0 10px",
              borderRadius: 999,
              border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider-strong)"}`,
              background: active ? "var(--color-accent-soft)" : "transparent",
              color: active ? "var(--color-accent)" : "var(--color-neutral-500)",
              cursor: "pointer",
            }}
          >
            <span>{label}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
