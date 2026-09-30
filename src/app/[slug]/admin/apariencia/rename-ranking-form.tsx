"use client";

import { useState } from "react";

// Local approximation of src/lib/ranking.ts's slugify — good enough for a live preview, but the
// server has the final word (and appends "-2", "-3", ... on collision via ensureUniqueSlug).
function previewSlugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function RenameRankingForm({
  currentName,
  currentSlug,
  action,
}: {
  currentName: string;
  currentSlug: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== currentName;
  const preview = previewSlugify(trimmed);

  return (
    <form
      action={action}
      className="card"
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        marginBottom: 24,
      }}
    >
      <h2 style={{ fontSize: 15, margin: 0 }}>Nombre del ranking</h2>
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-neutral-600)" }}>
        Este es el nombre real del ranking (distinto del &ldquo;Nombre del sitio&rdquo; de
        arriba, que es solo cosmético). Cambiarlo también genera una URL pública nueva y
        redirige para allá — los links viejos que ya tenga la gente van a dejar de funcionar,
        no se guarda ninguna redirección.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="text"
          name="rankingName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          maxLength={60}
          className="input"
          style={{ maxWidth: 360 }}
        />
        {trimmed && trimmed !== currentName ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-600)" }}>
            URL aproximada: zank.lol/{preview || "…"} (puede cambiar si ya existe)
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-600)" }}>
            URL actual: zank.lol/{currentSlug}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={!canSubmit}
        style={{ alignSelf: "flex-start" }}
      >
        Cambiar nombre y URL
      </button>
    </form>
  );
}
