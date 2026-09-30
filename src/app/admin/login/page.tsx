import { loginAction } from "./actions";
import "../admin.css";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // Env-gated: the Discord button only renders when the OAuth flow is configured (design D6).
  const discordEnabled = Boolean(process.env.DISCORD_CLIENT_ID);

  return (
    <div className="admin" style={{ maxWidth: 400, margin: "80px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <span
          style={{
            display: "flex",
            alignItems: "baseline",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: "-0.03em",
          }}
        >
          ZANK<span style={{ color: "var(--color-accent)" }}>.lol</span>
        </span>
        <span className="admin-badge">ADMIN</span>
      </div>
      <form
        action={loginAction}
        className="card"
        style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--color-neutral-600)" }}>
          Contraseña
          <input type="password" name="password" required autoFocus className="input" />
        </label>
        {error === "1" && (
          <p style={{ color: "var(--color-loss)", fontSize: 13, margin: 0 }}>Contraseña incorrecta.</p>
        )}
        {error === "oauth" && (
          <p style={{ color: "var(--color-loss)", fontSize: 13, margin: 0 }}>
            No pudimos iniciar sesión con Discord. Intentá de nuevo.
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          Entrar
        </button>
      </form>
      {discordEnabled && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "20px 0",
              color: "var(--admin-text-muted)",
              fontSize: 12,
            }}
          >
            <span style={{ flex: 1, height: 1, background: "var(--admin-border)" }} />
            o
            <span style={{ flex: 1, height: 1, background: "var(--admin-border)" }} />
          </div>
          <a
            href="/api/auth/discord?next=/admin"
            className="btn"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "#5865F2",
              borderColor: "#5865F2",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            Entrar con Discord
          </a>
        </>
      )}
    </div>
  );
}
