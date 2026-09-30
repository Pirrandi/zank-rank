import { PageHeading } from "../common/page-heading";
import { EmptyState } from "../common/empty-state";
import { CustomMatchCard, type VersusMatch } from "./custom-match-card";
import { VersusKingsCard, type VersusKingRow } from "./versus-kings-card";

export function VersusView({ slug, matches, kings }: { slug: string; matches: VersusMatch[]; kings: VersusKingRow[] }) {
  return (
    <div className="zr-stack" style={{ gap: 22 }}>
      <PageHeading title="Versus" lead="Cuando dos del grupo caen en equipos rivales, queda registrado. Para siempre." />
      <div className="zr-vs-layout">
        <div className="zr-stack zr-span-2" style={{ gap: 12 }}>
          {matches.length === 0 ? (
            <EmptyState title="Todavía no hay versus">
              Jueguen una personalizada en equipos rivales y aparece acá en el próximo sync.
            </EmptyState>
          ) : (
            matches.map((m) => <CustomMatchCard key={m.matchId} slug={slug} match={m} />)
          )}
        </div>
        <VersusKingsCard slug={slug} kings={kings} />
      </div>
    </div>
  );
}
