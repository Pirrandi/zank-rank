"use client";

import { useRouter } from "next/navigation";
import type { Lang } from "./i18n";

const LANG_COOKIE = "zank_lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

// Toggle ES/EN de la landing. Cliente porque escribe una cookie y pide refresh; el resto de la
// página sigue siendo Server Components — no hay estado de idioma en React, solo la cookie.
export function LanguageSwitcher({ lang, ariaLabel }: { lang: Lang; ariaLabel: string }) {
  const router = useRouter();

  function setLang(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}`;
    router.refresh();
  }

  return (
    <div className="lp-lang-switch" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className={lang === "es" ? "lp-lang-btn is-active" : "lp-lang-btn"}
        aria-pressed={lang === "es"}
        onClick={() => setLang("es")}
      >
        ES
      </button>
      <button
        type="button"
        className={lang === "en" ? "lp-lang-btn is-active" : "lp-lang-btn"}
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
      >
        EN
      </button>
    </div>
  );
}
