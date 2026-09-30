// Stake options offered by the web bet picker (En vivo). Shared by the client picker and the
// server action, which re-validates whatever the client sends.
export const WEB_STAKES = [0, 10, 25, 50, "all"] as const;
export type WebStake = (typeof WEB_STAKES)[number];
export const DEFAULT_WEB_STAKE: WebStake = 25;

export function isWebStake(value: unknown): value is WebStake {
  return (WEB_STAKES as readonly unknown[]).includes(value);
}

export function webStakeLabel(stake: WebStake): string {
  if (stake === "all") return "All-in";
  if (stake === 0) return "Gratis";
  return String(stake);
}
