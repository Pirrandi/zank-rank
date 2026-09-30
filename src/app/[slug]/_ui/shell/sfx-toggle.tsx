"use client";

import { useEffect, useState } from "react";
import { getSoundEnabled, playClickSound, setSoundEnabled } from "@/app/sound-effects";

// Default OFF on the server and on the first client render; the stored preference is read
// after mount so hydration always matches.
export function SfxToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(getSoundEnabled());
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) playClickSound();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="zr-sfx"
      data-on={enabled ? "true" : "false"}
      aria-pressed={enabled}
      title={enabled ? "Sonido activado" : "Sonido desactivado"}
    >
      {enabled ? "SFX" : "MUTE"}
    </button>
  );
}
