import type { Badge } from "@/lib/player-profile";

export function AchievementsCard({ badges }: { badges: Badge[] }) {
  const unlocked = badges.filter((b) => b.unlocked).length;
  return (
    <section className="zr-card zr-stack" style={{ gap: 14 }}>
      <div className="zr-card-head">
        <h3 className="zr-label">Logros</h3>
        <span className="zr-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--zr-accent)" }}>
          {unlocked}/{badges.length}
        </span>
      </div>
      <ul className="zr-badges zr-plain-list">
        {badges.map((b) => (
          <li
            key={b.key}
            className="zr-badge"
            data-unlocked={b.unlocked}
            data-curse={b.key === "L5"}
            title={`${b.description}${b.unlocked ? "" : " (bloqueado)"}`}
          >
            <span className="zr-badge-gem">
              <span>{b.key}</span>
            </span>
            <span className="zr-badge-name">{b.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
