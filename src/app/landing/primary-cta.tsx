import Link from "next/link";
import { LayoutDashboardIcon, LogInIcon } from "./icons";

// kind decide el ícono del hero: "panel" (sesión activa) usa layout-dashboard, el resto log-in.
export type CtaTarget = { href: string; label: string; kind: "login" | "panel" | "viewer" };

// CTA principal compartido por el hero, el plan web y el cierre. Los endpoints /api/* (OAuth
// de Discord) van con <a> plano: son route handlers, no páginas, y Link intentaría prefetchearlos.
export function PrimaryCta({ cta, variant }: { cta: CtaTarget; variant: "hero" | "plan" | "final" }) {
  const Icon = cta.kind === "panel" ? LayoutDashboardIcon : LogInIcon;
  const content =
    variant === "hero" ? (
      <>
        <span className="lp-cta-sweep" aria-hidden="true" />
        <span className="lp-cta-icon">
          <Icon size={18} color="var(--color-accent)" />
        </span>
        <span>{cta.label}</span>
      </>
    ) : variant === "final" ? (
      <>{cta.label} →</>
    ) : (
      cta.label
    );
  const className = `lp-cta lp-cta-${variant}`;

  return cta.href.startsWith("/api/") ? (
    <a href={cta.href} className={className}>
      {content}
    </a>
  ) : (
    <Link href={cta.href} className={className}>
      {content}
    </Link>
  );
}
