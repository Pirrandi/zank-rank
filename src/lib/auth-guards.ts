// Current-session User lookup. Server-only (react cache + Prisma): never import this module
// from middleware.ts.
//
// PR4 removed the PR3 stopgap that resolved every session to an implicit "workspace" (the
// session user's first OWNER ranking). Ranking context now always comes from the URL slug via
// requireRankingRole/getRankingAdminContext (ranking-access.ts) — this module only resolves the
// user, reusing ranking-access.ts's identity resolution (legacy `admin.*` tokens and password
// login still map to the OWNER of the root ranking there, design D4).

import { cache } from "react";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";
import { AuthError, resolveCurrentUserId } from "./ranking-access";

export { AuthError };

// Current session's User, or null when unauthenticated.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await resolveCurrentUserId();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
});
