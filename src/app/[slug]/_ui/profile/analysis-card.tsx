export function AnalysisCard({ text, whenLabel }: { text: string | undefined; whenLabel: string | null }) {
  return (
    <section className="zr-card zr-stack" style={{ gap: 10, borderColor: "#3d3360" }}>
      <h3 className="zr-label" style={{ color: "var(--zr-violet)" }}>
        Análisis IA{whenLabel ? ` · ${whenLabel}` : ""}
      </h3>
      {text ? (
        <p className="zr-analysis-text">{text}</p>
      ) : (
        <p className="zr-muted-text">Todavía no hay análisis para este jugador. Se genera una vez por día.</p>
      )}
    </section>
  );
}
