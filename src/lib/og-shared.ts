import { readFile } from "node:fs/promises";
import path from "node:path";
import { tierEmblemUrl } from "@/lib/tier-colors";

// Helpers shared by the OG image routes (Satori/ImageResponse). Shared with self-hosted: the
// ranking banner imports it, so this file must NOT be listed in scripts/self-hosted-export.txt.

export const BRAND_GOLD = "#ffd447";
export const FONT_FAMILY = "Bricolage Grotesque";

// Satori (what ImageResponse renders with) has no access to the browser/next-font pipeline the
// rest of the site uses — it needs raw font bytes handed to it directly. These are the same
// family the site renders with (src/app/layout.tsx), fetched once from Google Fonts and
// committed under public/fonts so generating a banner never makes a font request over the
// network. Cached at module scope: read from disk once per server process, reused by every
// ranking's generation after that.
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 700 | 800; style: "normal" }[]> | undefined;

export function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(path.join(process.cwd(), "public/fonts/BricolageGrotesque-Regular.ttf")),
      readFile(path.join(process.cwd(), "public/fonts/BricolageGrotesque-Bold.ttf")),
      readFile(path.join(process.cwd(), "public/fonts/BricolageGrotesque-ExtraBold.ttf")),
    ]).then(([regular, bold, extraBold]) => [
      { name: FONT_FAMILY, data: regular, weight: 400 as const, style: "normal" as const },
      { name: FONT_FAMILY, data: bold, weight: 700 as const, style: "normal" as const },
      { name: FONT_FAMILY, data: extraBold, weight: 800 as const, style: "normal" as const },
    ]);
  }
  return fontsPromise;
}

export async function emblemDataUri(tier: string): Promise<string | undefined> {
  const url = tierEmblemUrl(tier);
  if (!url) return undefined;
  try {
    const buf = await readFile(path.join(process.cwd(), "public", url));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function staticBanner(): Promise<Response> {
  const buf = await readFile(path.join(process.cwd(), "src/app/opengraph-image.png"));
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/png" } });
}
