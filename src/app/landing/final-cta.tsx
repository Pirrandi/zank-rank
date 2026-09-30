import { dict, type Lang } from "./i18n";
import { PrimaryCta, type CtaTarget } from "./primary-cta";

export function FinalCta({ cta, lang }: { cta: CtaTarget; lang: Lang }) {
  const t = dict[lang].finalCta;
  return (
    <section className="lp-section lp-final">
      <div className="lp-final-box">
        <div className="lp-final-gg" aria-hidden="true">
          GG
        </div>
        <div className="lp-final-copy">
          <h2 className="lp-h2 lp-final-title">{t.title}</h2>
        </div>
        <PrimaryCta cta={cta} variant="final" />
      </div>
    </section>
  );
}
