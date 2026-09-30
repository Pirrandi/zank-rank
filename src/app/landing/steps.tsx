import { BotIcon, LogInIcon, UserPlusIcon } from "./icons";
import { dict, type Lang } from "./i18n";

const STEP_ICONS = [LogInIcon, UserPlusIcon, BotIcon];

export function Steps({ lang }: { lang: Lang }) {
  const t = dict[lang].steps;
  return (
    <section id="como" className="lp-section lp-steps">
      <h2 className="lp-h2 lp-steps-title">{t.title}</h2>
      <div className="lp-steps-grid">
        {t.items.map(({ title, body }, i) => {
          const Icon = STEP_ICONS[i];
          return (
            <div key={title} className="lp-step">
              <div className="lp-step-n" aria-hidden="true">
                {i + 1}
              </div>
              <span className="lp-step-icon">
                <Icon size={22} color="var(--color-accent)" />
              </span>
              <h3 className="lp-step-title">{title}</h3>
              <p className="lp-step-body">{body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
