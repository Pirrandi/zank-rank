
// Poll cadence the header's sync ticker counts down against. Hosted (zank.lol) polls every
// 5 minutes; self-hosted follows the scheduler's POLL_INTERVAL_MINUTES (default 5, same
// parsing as scripts/scheduler.ts).
export function getPollIntervalMinutes(): number {
  const parsed = Number.parseFloat(process.env.POLL_INTERVAL_MINUTES ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

const TIER_ABBREV: Record<string, string> = {
  IRON: "HI",
  BRONZE: "BR",
  SILVER: "PA",
  GOLD: "OR",
  PLATINUM: "PL",
  EMERALD: "ES",
  DIAMOND: "DI",
  MASTER: "MA",
  GRANDMASTER: "GM",
  CHALLENGER: "RE",
};

export function getTierSpreadText(tiers: string[]): string {
  if (tiers.length === 0) return "—";
  const order = [
    "IRON",
    "BRONZE",
    "SILVER",
    "GOLD",
    "PLATINUM",
    "EMERALD",
    "DIAMOND",
    "MASTER",
    "GRANDMASTER",
    "CHALLENGER",
  ];
  const indices = tiers.map((t) => order.indexOf(t.toUpperCase())).filter((i) => i !== -1);
  if (indices.length === 0) return "—";
  const highest = order[Math.max(...indices)];
  const lowest = order[Math.min(...indices)];
  if (highest === lowest) return TIER_ABBREV[highest];
  return `${TIER_ABBREV[highest]} → ${TIER_ABBREV[lowest]}`;
}
