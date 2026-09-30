"use client";

import { useEffect, useState } from "react";
import { dict, type Lang } from "./i18n";
import { prefersReducedMotion } from "./reduced-motion";

const ROTATE_MS = 4200;

export function RotatingRoast({ lang }: { lang: Lang }) {
  const roasts = dict[lang].roasts;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % roasts.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [roasts.length]);

  return (
    <div className="lp-discord-msg" aria-live="polite">
      {roasts[index]}
    </div>
  );
}
