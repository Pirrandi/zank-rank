// Display formatting shared by server and client components (pure, no clock reads).

const MINUS = "−";

export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${MINUS}${Math.abs(n)}`;
  return "0";
}

export function signedColor(n: number | undefined): string {
  if (n === undefined || n === 0) return "var(--zr-mute)";
  return n > 0 ? "var(--zr-win)" : "var(--zr-loss)";
}

export function formatDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}
