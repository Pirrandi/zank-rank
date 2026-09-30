// Vista previa de un embed de Discord fiel a lo que arma buildRankChangeBody (ver src/lib/discord.ts):
// franja de color a la izquierda (verde si subió de rango, rojo si bajó), línea de autor con ícono
// circular + "gameName#tagLine", descripción y una grilla de fields en línea.
export type DiscordEmbedField = { label: string; value: string };

export function DiscordEmbedMock({
  variant,
  authorName,
  authorIcon,
  description,
  fields,
}: {
  variant: "up" | "down";
  authorName: string;
  authorIcon?: string;
  description: React.ReactNode;
  fields: DiscordEmbedField[];
}) {
  return (
    <div
      className="lp-discord-embed"
      style={{ "--lp-embed-accent": variant === "up" ? "var(--color-win)" : "var(--color-loss)" } as React.CSSProperties}
    >
      <div className="lp-discord-embed-author">
        {authorIcon ? (
          <img src={authorIcon} alt="" width={20} height={20} className="lp-discord-embed-icon" />
        ) : (
          <span className="lp-discord-embed-icon lp-discord-embed-icon-fallback" aria-hidden="true" />
        )}
        <span>{authorName}</span>
      </div>
      <div className="lp-discord-embed-desc">{description}</div>
      <div className="lp-discord-embed-fields">
        {fields.map((field) => (
          <div key={field.label} className="lp-discord-embed-field">
            <span className="lp-discord-embed-field-label">{field.label}</span>
            <span className="lp-discord-embed-field-value">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
