// Solo para usar dentro de efectos (cliente): en SSR no hay window.
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
