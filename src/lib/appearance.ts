import { getSettingForWorkspace, SETTING_KEYS } from "./settings";

// Preset swatches only (design: no free-form color picker) so every ranking's accent stays
// readable against the fixed dark shell background. Hues are spread apart on purpose so no two
// presets read as "basically the same color", and none sits near --color-loss (#ff5470) to
// avoid clashing with the app's win/loss red.
export const ACCENT_PRESETS = [
  { hex: "#ffd447", label: "Oro" },
  { hex: "#4ade80", label: "Menta" },
  { hex: "#7dd3fc", label: "Hielo" },
  { hex: "#ff7ab6", label: "Chicle" },
  { hex: "#c084fc", label: "Lila" },
  { hex: "#fb923c", label: "Naranja" },
  { hex: "#818cf8", label: "Índigo" },
  { hex: "#2dd4bf", label: "Turquesa" },
] as const;

export const DEFAULT_ACCENT: string = ACCENT_PRESETS[0].hex;

export type RankingAppearance = { accentColor: string; effectsEnabled: boolean };

// Read by RankingShell (applies accentColor as the --zr-accent CSS var, passes effectsEnabled
// to LiveRefresh) and by the admin Apariencia page. Missing effectsEnabled row = on by default,
// same "absence means default" convention as the rest of settings.ts.
export async function getRankingAppearance(rankingId: string): Promise<RankingAppearance> {
  const [accent, effects] = await Promise.all([
    getSettingForWorkspace(rankingId, SETTING_KEYS.accentColor),
    getSettingForWorkspace(rankingId, SETTING_KEYS.effectsEnabled),
  ]);
  const accentColor = accent && ACCENT_PRESETS.some((p) => p.hex === accent) ? accent : DEFAULT_ACCENT;
  return { accentColor, effectsEnabled: effects !== "false" };
}
