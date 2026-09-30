"use client";

import { useState } from "react";

export function DeleteRankingForm({
  rankingName,
  action,
}: {
  rankingName: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [confirmName, setConfirmName] = useState("");
  const canSubmit = confirmName === rankingName;

  return (
    <form
      action={action}
      className="card"
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        border: "1px solid var(--color-loss)",
      }}
    >
      <h2 style={{ fontSize: 15, margin: 0, color: "var(--color-loss)" }}>Zona de peligro</h2>
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-neutral-600)" }}>
        Esto elimina el ranking y todo lo que contiene de forma permanente: cuentas trackeadas,
        historial de partidas, apuestas y configuración. No se puede deshacer.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
          Para confirmar, escribí el nombre exacto del ranking:{" "}
          <strong style={{ fontFamily: "monospace" }}>{rankingName}</strong>
        </label>
        <input
          type="text"
          name="confirmName"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          autoComplete="off"
          className="input"
          style={{ maxWidth: 360 }}
        />
      </div>

      <button
        type="submit"
        className="btn btn-danger"
        disabled={!canSubmit}
        style={{ alignSelf: "flex-start" }}
      >
        Eliminar ranking
      </button>
    </form>
  );
}
