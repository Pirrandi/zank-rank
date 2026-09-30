"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { playSyncSound } from "@/app/sound-effects";

type Status = "idle" | "syncing" | "done" | "error";

// Manual sync trigger. Only rendered for ADMIN+ (the shell decides); POST /api/sync enforces
// the same role server-side, so this button is never the security boundary.
export function SyncButton({ slug }: { slug: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  function settle(next: Status) {
    setStatus(next);
    resetRef.current = setTimeout(() => setStatus("idle"), 3000);
  }

  async function handleClick() {
    if (status === "syncing") return;
    setStatus("syncing");
    const url = `/api/sync?ranking=${encodeURIComponent(slug)}`;

    const res = await fetch(url, { method: "POST" }).catch(() => undefined);
    if (!res || (res.status !== 200 && res.status !== 429)) {
      settle("error");
      return;
    }

    pollRef.current = setInterval(async () => {
      const check = await fetch(url).catch(() => undefined);
      const data = await check?.json().catch(() => undefined);
      if (!data?.syncing) {
        if (pollRef.current) clearInterval(pollRef.current);
        playSyncSound();
        router.refresh();
        settle("done");
      }
    }, 2000);
  }

  const label =
    status === "syncing" ? "Sincronizando…" : status === "done" ? "✓ Listo" : status === "error" ? "No se pudo" : "Sincronizar";

  return (
    <button type="button" onClick={handleClick} disabled={status === "syncing"} className="zr-syncbtn" data-status={status}>
      {status === "syncing" && <span className="zr-spinner" aria-hidden />}
      {label}
    </button>
  );
}
