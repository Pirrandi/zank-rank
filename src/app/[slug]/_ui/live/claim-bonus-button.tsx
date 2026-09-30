"use client";

import { useState, useTransition } from "react";
import { playClickSound } from "@/app/sound-effects";
import { claimDailyBonusAction } from "../../en-vivo/actions";

// Web counterpart of /reclamar. Only submits; claimDailyBonus owns the 24h cooldown and the
// balance update, and revalidates the page so the cooldown state renders from the stored row.
export function ClaimBonusButton({ slug }: { slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function claim() {
    setError(null);
    playClickSound();
    startTransition(async () => {
      const result = await claimDailyBonusAction(slug);
      if (!result.ok) setError(result.error);
      else setClaimed(result.amount);
    });
  }

  if (claimed !== null) {
    return <span className="zr-balance-hint">🎁 Reclamaste {claimed} ZC</span>;
  }

  return (
    <div className="zr-stack" style={{ gap: 4 }}>
      <button type="button" className="zr-claim-bonus" disabled={pending} onClick={claim}>
        🎁 Reclamar 50 ZC gratis
      </button>
      {error && (
        <p className="zr-bet-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
