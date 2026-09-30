// Edition gate (design D7). `ZANK_EDITION` switches multi-ranking UX on or off.
//
// - "self-hosted" (default): single-tenant behavior. Visibility/guild-link/viewer UI stay
//   hidden, every ranking is treated as always viewable, and auth flows land on the root
//   ranking's admin instead of a dashboard.
// - "hosted": multi-tenant behavior. Discord OAuth users get a dashboard, can create
//   rankings, and visibility/guild-link/viewer management become available.

export type Edition = "hosted" | "self-hosted";

export function getEdition(): Edition {
  return process.env.ZANK_EDITION === "hosted" ? "hosted" : "self-hosted";
}

export function isHosted(): boolean {
  return getEdition() === "hosted";
}

export function isSelfHosted(): boolean {
  return getEdition() === "self-hosted";
}
