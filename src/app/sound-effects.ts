const KEY = "zank_sound_enabled";

// localStorage can throw (private mode, blocked site data): sound is a nicety, so any failure
// just means "off" and never breaks the page.
export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setSoundEnabled(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(value));
  } catch {
    // Ignored: the toggle still works for this page view.
  }
}

let ctx: AudioContext | undefined;

function getCtx(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return undefined;
    ctx = new Ctor();
  }
  return ctx;
}

function beep(freq: number, duration: number, delay = 0, type: OscillatorType = "square"): void {
  if (!getSoundEnabled()) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

export function playRankUpSound(): void {
  beep(660, 0.12, 0);
  beep(880, 0.16, 0.12);
  beep(1100, 0.2, 0.26);
}

export function playRankDownSound(): void {
  beep(320, 0.25, 0, "triangle");
  beep(220, 0.3, 0.2, "triangle");
}

export function playClickSound(): void {
  beep(740, 0.04, 0, "triangle");
}

export function playSyncSound(): void {
  beep(520, 0.07, 0, "triangle");
  beep(780, 0.09, 0.08, "triangle");
}
