// Denial screen for a PRIVATE ranking (design D6): renders in place of ranking data, without
// leaking whether accounts/matches exist. Only a logged-in user with no membership/guild
// access ever reaches this — an anonymous visitor is redirected to Discord login before this
// point (see requireRankingView in ranking-policy.ts). Rendered inside RankingShell's <main>,
// which already provides the page width and padding.
export function PrivateRankingGate() {
  return (
    <div
      className="card"
      style={{
        padding: "clamp(40px, 6vw, 72px) 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-accent)",
          fontWeight: 800,
          marginBottom: 12,
        }}
      >
        Ranking privado
      </div>
      <h1 style={{ fontSize: "clamp(22px, 3vw, 30px)", margin: 0 }}>No tenés acceso a este ranking</h1>
      <p style={{ maxWidth: 480, margin: "10px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--color-neutral-600)" }}>
        Este ranking es privado. Pedile a un admin que te agregue como viewer o que vincule tu
        servidor de Discord.
      </p>
    </div>
  );
}
