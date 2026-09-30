import Link from "next/link";
import { Avatar } from "../common/avatar";

export type VersusKingRow = { accountId: string; name: string; iconUrl: string | undefined; wins: number; losses: number };

export function VersusKingsCard({ slug, kings }: { slug: string; kings: VersusKingRow[] }) {
  return (
    <section className="zr-card zr-stack" style={{ gap: 14 }}>
      <h3 className="zr-label" style={{ color: "var(--zr-accent)" }}>
        Reyes del versus
      </h3>
      {kings.length === 0 ? (
        <p className="zr-muted-text">Todavía nadie tiene versus jugados.</p>
      ) : (
        <ol className="zr-stack zr-plain-list" style={{ gap: 10 }}>
          {kings.map((k, i) => (
            <li key={k.accountId}>
              <Link href={`/${slug}/players/${k.accountId}`} className="zr-king-row">
                <span className="zr-king-pos">{i + 1}</span>
                <Avatar src={k.iconUrl} alt="" size={30} radius={9} />
                <span className="zr-ellipsis zr-king-name">{k.name}</span>
                <span className="zr-king-wl">
                  <span style={{ color: "var(--zr-win)" }}>{k.wins}W</span> <span style={{ color: "var(--zr-loss)" }}>{k.losses}L</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
