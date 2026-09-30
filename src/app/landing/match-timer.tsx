"use client";

import { useEffect, useState } from "react";
import { dict, type Lang } from "./i18n";

const START_SECONDS = 14 * 60 + 12;

function format(total: number): string {
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Arranca en 14:12 (igual en SSR) y suma un segundo por tick desde el mount.
export function MatchTimer({ lang }: { lang: Lang }) {
  const [seconds, setSeconds] = useState(START_SECONDS);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      {dict[lang].matchTimer.inGame} · {format(seconds)}
    </>
  );
}
