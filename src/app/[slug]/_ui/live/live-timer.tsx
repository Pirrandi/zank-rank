"use client";

import { useEffect, useState } from "react";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

// Game clock since `startedAtMs`. First render uses the server's clock (`renderedAtMs`) so the
// SSR markup and hydration agree; the browser clock takes over in the effect.
export function LiveTimer({ startedAtMs, renderedAtMs }: { startedAtMs: number; renderedAtMs: number }) {
  const [now, setNow] = useState(renderedAtMs);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="zr-mono">{formatElapsed(now - startedAtMs)}</span>;
}
