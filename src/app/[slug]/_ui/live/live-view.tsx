import { EmptyState } from "../common/empty-state";
import { LiveCard, type LiveCardData } from "./live-card";
import { ClaimBonusButton } from "./claim-bonus-button";

export type LiveBalance = { kind: "value"; amount: number } | { kind: "login"; loginHref: string } | { kind: "none" };

export type LiveClaimState =
  | { kind: "login"; loginHref: string }
  | { kind: "blocked" }
  | { kind: "available" }
  | { kind: "cooldown"; remaining: string };

function ClaimBlock({ slug, claim }: { slug: string; claim: LiveClaimState }) {
  switch (claim.kind) {
    case "login":
      return null; // ya se muestra el hint de login del saldo
    case "blocked":
      return null;
    case "available":
      return <ClaimBonusButton slug={slug} />;
    case "cooldown":
      return <span className="zr-balance-hint">Próximo bono en {claim.remaining}</span>;
  }
}

function BalanceCard({ slug, balance, claim }: { slug: string; balance: LiveBalance; claim: LiveClaimState }) {
  return (
    <div className="zr-balance">
      <span className="zr-label">Tu saldo</span>
      <span className="zr-balance-value">{balance.kind === "value" ? `${balance.amount} ZC` : "—"}</span>
      {balance.kind === "login" && (
        <a href={balance.loginHref} className="zr-balance-hint">
          Entrá con Discord para ver tu saldo
        </a>
      )}
      {balance.kind === "none" && <span className="zr-balance-hint">Todavía no apostaste en este ranking</span>}
      <ClaimBlock slug={slug} claim={claim} />
    </div>
  );
}

export function LiveView({
  slug,
  cards,
  balance,
  claim,
  renderedAtMs,
}: {
  slug: string;
  cards: LiveCardData[];
  balance: LiveBalance;
  claim: LiveClaimState;
  renderedAtMs: number;
}) {
  return (
    <div className="zr-stack" style={{ gap: 22 }}>
      <div className="zr-live-head">
        <div>
          <h2 className="zr-h2">
            Jugando <span style={{ color: "var(--zr-win)" }}>ahora</span>
          </h2>
          <p className="zr-lead">Apostá tus ZankCoins: ¿gana o pierde? Si acertás, paga x2.</p>
        </div>
        <BalanceCard slug={slug} balance={balance} claim={claim} />
      </div>
      {cards.length === 0 ? (
        <EmptyState title="Nadie está jugando ahora">
          Cuando alguien del grupo entre a una partida aparece acá, con su apuesta abierta si es ranked.
        </EmptyState>
      ) : (
        <div className="zr-live-grid">
          {cards.map((c) => (
            <LiveCard key={c.accountId} slug={slug} card={c} renderedAtMs={renderedAtMs} />
          ))}
        </div>
      )}
    </div>
  );
}
