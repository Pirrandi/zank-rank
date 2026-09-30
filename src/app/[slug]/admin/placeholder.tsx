// Shell visual para secciones del admin que todavía no están implementadas.
// Server component: no hay estado ni lógica. Cada sección se configura en una
// sesión futura; acá solo se muestra el título, el subtítulo y una card de
// "Próximamente" con lo que la sección va a controlar (según el mock).
type PlaceholderProps = {
  title: string;
  subtitle: string;
  /** Texto alternativo de la card. Por defecto avisa que la sección se habilita pronto. */
  coming?: string;
  /** Lista corta de lo que la sección va a controlar (del mock). */
  items?: string[];
};

export function Placeholder({ title, subtitle, coming, items }: PlaceholderProps) {
  return (
    <div>
      <h1 className="admin-page-title">{title}</h1>
      <p className="admin-page-sub">{subtitle}</p>

      <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Próximamente</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-dim)", maxWidth: 560 }}>
          {coming ??
            "Esta sección todavía no está configurada. Se va a habilitar pronto: la vas a poder configurar acá, en el panel de admin."}
        </p>
        {items && items.length > 0 && (
          <>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--admin-text-muted)" }}>
              Esta sección va a controlar:
            </p>
            <ul
              className="mono"
              style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 12.5, color: "var(--admin-text-dim)" }}
            >
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}