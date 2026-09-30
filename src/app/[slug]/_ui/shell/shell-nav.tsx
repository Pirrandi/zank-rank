"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { playClickSound } from "@/app/sound-effects";

type Tab = { href: string; label: string; comingSoon?: boolean };

// Tab pills. Active state comes from the pathname (exact match), so profile pages leave
// every tab inactive. usePathname is SSR-safe: server and client agree on the first render.
// "Bot" is hidden for now (comingSoon): same disabled/no-link treatment as the admin nav's
// "Pronto" sections, just styled as a pill instead of a sidebar row.
export function ShellNav({ slug, liveCount }: { slug: string; liveCount: number }) {
  const pathname = usePathname();
  const tabs: Tab[] = [
    { href: `/${slug}`, label: "Ranking" },
    { href: `/${slug}/en-vivo`, label: "En vivo" },
    { href: `/${slug}/versus`, label: "Versus" },
    { href: `/${slug}/muros`, label: "Muros" },
    { href: `/${slug}/analisis`, label: "Análisis" },
    { href: `/${slug}/bot`, label: "Bot", comingSoon: true },
  ];

  return (
    <nav className="zr-nav" aria-label="Secciones del ranking">
      {tabs.map((tab) => {
        if (tab.comingSoon) {
          return (
            <span key={tab.href} className="zr-pill zr-pill-disabled" aria-disabled="true">
              {tab.label}
              <span className="zr-pill-badge">Pronto</span>
            </span>
          );
        }

        const active = pathname === tab.href;
        const isLive = tab.href.endsWith("/en-vivo");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="zr-pill"
            aria-current={active ? "page" : undefined}
            onClick={() => playClickSound()}
          >
            {tab.label}
            {isLive && liveCount > 0 && (
              <span className="zr-live-badge" title={`${liveCount} jugando ahora`}>
                <span className="zr-dot zr-dot-pulse" aria-hidden />
                {liveCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
