import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth-guards";
import { ROOT_SLUG } from "@/lib/ranking";
import { Features } from "./landing/features";
import { FinalCta } from "./landing/final-cta";
import { Hero } from "./landing/hero";
import { dict, type Lang } from "./landing/i18n";
import { LandingHeader } from "./landing/landing-header";
import type { CtaTarget } from "./landing/primary-cta";
import { Steps } from "./landing/steps";
import "./landing/landing.css";

// Product decision: `/` es la landing de entrada, con login por Discord (env-gated) y el
// acceso espectador a los rankings por link directo (/<slug>), siempre público. PR4 quitó el
// redirect automático a un "workspace propio" (una sesión ya puede tener cero, una o varias
// rankings via RankingMember, así que no hay una sola ranking canónica). PR5 agrega un link
// explícito "Mi panel" para navegar desde acá con sesión activa.
// Container: resuelve sesión, edición y env acá y baja props planas a los componentes
// presentacionales de ./landing.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "zank.rank — Tu grupo. Tu ranking.",
};

export default async function HomePage() {
  // Switcher bilingüe de la landing (solo esta página): cookie `zank_lang`, "es" por default.
  // Sin librería de i18n — es una sola página, el diccionario de ./landing/i18n alcanza.
  const cookieLang = (await cookies()).get("zank_lang")?.value;
  const lang: Lang = cookieLang === "en" ? "en" : "es";
  const t = dict[lang].cta;

  // Env-gated igual que el login de admin (design D6): sin DISCORD_CLIENT_ID el CTA no ofrece
  // login y manda al ranking público.
  const discordEnabled = Boolean(process.env.DISCORD_CLIENT_ID);
  const user = await getCurrentUser();
  // Task 5.4: con sesión activa el CTA lleva a "Mi panel" (hosted → /dashboard, self-hosted →
  // la admin de la ranking raíz) en vez del login.
  let panelHref = `/${ROOT_SLUG}/admin`;
  let discordNext = "%2F";
  const viewerHref = `/${ROOT_SLUG}`;

  const cta: CtaTarget = user
    ? { href: panelHref, label: t.panel, kind: "panel" }
    : discordEnabled
      ? {
          href: `/api/auth/discord?next=${discordNext}`,
          label: t.login,
          kind: "login",
        }
      : { href: viewerHref, label: t.viewer, kind: "viewer" };

  return (
    <div className="lp-root">
      <LandingHeader lang={lang} />
      <main>
        <Hero cta={cta} viewerHref={viewerHref} lang={lang} />
        <Features lang={lang} />
        <Steps lang={lang} />
        <FinalCta cta={cta} lang={lang} />
      </main>
    </div>
  );
}
