// Small dependency-free confetti burst — a handful of squares falling under gravity for ~2.6s.
export function burstConfetti(): void {
  if (typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  // Leads with the ranking's own accent (Apariencia), read from the live --zr-accent CSS var
  // RankingShell sets on .zr-root, so a re-skinned ranking's confetti matches its color too.
  const root = document.querySelector<HTMLElement>(".zr-root") ?? document.documentElement;
  const accent = getComputedStyle(root).getPropertyValue("--zr-accent").trim() || "#ffd447";
  const colors = [accent, "#4ade80", "#5eb1f5", "#a98bff", "#ff5470"];
  const pieces = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.3,
    r: 4 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: -2 + Math.random() * 4,
    vy: 2 + Math.random() * 3,
    rot: Math.random() * 360,
    vr: -6 + Math.random() * 12,
  }));

  const start = performance.now();
  const duration = 2600;

  function frame(t: number) {
    const elapsed = t - start;
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate((p.rot * Math.PI) / 180);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
      ctx!.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }

  requestAnimationFrame(frame);
}
