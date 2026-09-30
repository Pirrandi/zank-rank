"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Las secciones del panel: primero las disponibles, después las que todavía son
// placeholders (design-reference/admin-redesign/admin-mock.dc.html tenía otro orden,
// pero ahí no distinguía qué estaba implementado). Los glyphs reemplazan a los íconos
// lucide del mock (que dependían de un CDN externo que no usamos acá).
// `comingSoon` deja la sección sin link: se configura una a una en sesiones futuras.
const ITEMS: { path: string; label: string; glyph: string; showCount?: boolean; hostedOnly?: boolean; comingSoon?: boolean }[] = [
  { path: "", label: "Resumen", glyph: "◎" },
  { path: "/accounts", label: "Cuentas", glyph: "ID", showCount: true },
  { path: "/settings", label: "Discord", glyph: "#" },
  { path: "/apariencia", label: "Apariencia", glyph: "Aa" },
  { path: "/secciones", label: "Secciones y fondos", glyph: "BG", comingSoon: true },
  { path: "/roasts", label: "Roasts IA", glyph: "IA", comingSoon: true },
  { path: "/muros", label: "Muros", glyph: "W", comingSoon: true },
  { path: "/apuestas", label: "Apuestas", glyph: "ZC", comingSoon: true },
  { path: "/sync", label: "Sync y datos", glyph: "↻", comingSoon: true },
];

export function AdminNav({
  slug,
  accountCount,
  hosted = true,
}: {
  slug: string;
  accountCount?: number;
  /** Design D7: self-hosted hides guild-link/visibility/viewer UI entirely. */
  hosted?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Secciones del panel">
      {ITEMS.filter((item) => !item.hostedOnly || hosted).map((item) => {
        if (item.comingSoon) {
          return (
            <span key={item.path} className="admin-nav-item admin-nav-item-disabled" aria-disabled="true">
              <span className="admin-nav-icon">{item.glyph}</span>
              <span>{item.label}</span>
              <span className="admin-nav-badge">Pronto</span>
            </span>
          );
        }

        const href = `/${slug}/admin${item.path}`;
        const active = pathname === href;
        return (
          <Link
            key={item.path}
            href={href}
            className="admin-nav-item"
            aria-current={active ? "page" : undefined}
          >
            <span className="admin-nav-icon">{item.glyph}</span>
            <span>{item.label}</span>
            {item.showCount && typeof accountCount === "number" && (
              <span className="admin-nav-count">{accountCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
