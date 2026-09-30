"use client";

import { useState, useTransition } from "react";
import { DEFAULT_WEB_STAKE, WEB_STAKES, webStakeLabel, type WebStake } from "@/lib/web-bet";
import { playClickSound } from "@/app/sound-effects";
import { placeWebBetAction } from "../../en-vivo/actions";

// Stake picker + Gana/Pierde buttons. Only submits; the server action owns identity,
// validation and balance, and revalidates the page so the "Apostaste…" state renders from
// the stored Prediction row.
export function BetControls({ slug, roundId }: { slug: string; roundId: string }) {
  const [stake, setStake] = useState<WebStake>(DEFAULT_WEB_STAKE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function bet(guess: boolean) {
    setError(null);
    playClickSound();
    startTransition(async () => {
      const result = await placeWebBetAction(slug, roundId, guess, stake);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="zr-stack" style={{ gap: 8 }}>
      <div className="zr-stakes" role="radiogroup" aria-label="Fichas a apostar">
        {WEB_STAKES.map((s) => (
          <button
            key={String(s)}
            type="button"
            role="radio"
            aria-checked={stake === s}
            className="zr-stake"
            data-selected={stake === s}
            disabled={pending}
            onClick={() => setStake(s)}
          >
            {webStakeLabel(s)}
          </button>
        ))}
      </div>
      <div className="zr-bet-buttons">
        <button type="button" className="zr-bet zr-bet-win" disabled={pending} onClick={() => bet(true)}>
          Gana
        </button>
        <button type="button" className="zr-bet zr-bet-loss" disabled={pending} onClick={() => bet(false)}>
          Pierde
        </button>
      </div>
      {error && (
        <p className="zr-bet-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
