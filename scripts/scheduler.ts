// Scheduler de larga duración para self-hosted (servicio `scheduler` de docker-compose).
// Reemplaza al crontab: corre scripts/poll.ts cada POLL_INTERVAL_MINUTES y scripts/analyze.ts
// una vez por día a la hora ANALYZE_HOUR (hora local del contenedor, configurable con TZ).
//
// Cada corrida es un proceso hijo aparte (`tsx scripts/<x>.ts`) para que un crash o una fuga de
// memoria no tumbe al scheduler. Nunca se superponen dos polls (ni dos análisis): si el anterior
// sigue corriendo, el turno se saltea. SIGTERM/SIGINT reenvía la señal a los hijos, los espera
// y sale limpio.
//
// Run: npx tsx scripts/scheduler.ts

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

const TSX_BIN = path.resolve(__dirname, "../node_modules/.bin/tsx");
const SCRIPTS_DIR = __dirname;
const SHUTDOWN_TIMEOUT_MS = 25_000;

function envNumber(name: string, fallback: number): number {
  const parsed = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Acepta fracciones (ej. 0.05 = 3 s) para poder probar el loop sin esperar minutos.
const pollIntervalMs = envNumber("POLL_INTERVAL_MINUTES", 5) * 60_000;
const analyzeHour = Math.floor(envNumber("ANALYZE_HOUR", 12)) % 24;
const tickMs = Math.min(30_000, pollIntervalMs);

function log(message: string) {
  console.log(`[scheduler ${new Date().toISOString()}] ${message}`);
}

// Día local (según TZ) en formato YYYY-MM-DD, para correr el análisis una sola vez por día.
export function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isAnalyzeDue(now: Date, hour: number, lastRunDay: string | null): boolean {
  return now.getHours() === hour && lastRunDay !== localDay(now);
}

type Job = "poll" | "analyze";
const running = new Map<Job, ChildProcess>();
let shuttingDown = false;
let nextPollAt = Date.now();
let lastAnalyzeDay: string | null = null;
let timer: NodeJS.Timeout | undefined;

function runJob(job: Job) {
  if (running.has(job)) {
    log(`${job} sigue corriendo, se saltea este turno`);
    return;
  }
  const startedAt = Date.now();
  log(`${job}: inicio`);
  const child = spawn(TSX_BIN, [path.join(SCRIPTS_DIR, `${job}.ts`)], {
    stdio: "inherit",
    env: process.env,
  });
  running.set(job, child);
  child.on("error", (err) => log(`${job}: no se pudo lanzar (${err.message})`));
  child.on("exit", (code, signal) => {
    running.delete(job);
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    log(`${job}: fin en ${secs}s (${signal ? `señal ${signal}` : `código ${code}`})`);
  });
}

function tick() {
  if (shuttingDown) return;
  const now = new Date();

  if (now.getTime() >= nextPollAt) {
    runJob("poll");
    nextPollAt = now.getTime() + pollIntervalMs;
  }

  if (isAnalyzeDue(now, analyzeHour, lastAnalyzeDay)) {
    lastAnalyzeDay = localDay(now);
    runJob("analyze");
  }

  timer = setTimeout(tick, tickMs);
}

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once("exit", () => resolve());
  });
}

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (timer) clearTimeout(timer);
  log(`${signal} recibido, cerrando (${running.size} proceso(s) en curso)`);

  const children = [...running.values()];
  for (const child of children) child.kill("SIGTERM");

  const force = setTimeout(() => {
    log("timeout esperando a los hijos, SIGKILL");
    for (const child of children) child.kill("SIGKILL");
  }, SHUTDOWN_TIMEOUT_MS);
  await Promise.all(children.map(waitForExit));
  clearTimeout(force);

  log("listo");
  process.exit(0);
}

function main() {
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  const tz = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
  log(
    `arrancando: poll cada ${pollIntervalMs / 60_000} min, análisis diario a las ${analyzeHour}:00 (${tz})`,
  );
  tick();
}

// Guard para poder importar isAnalyzeDue/localDay sin arrancar el loop.
if (require.main === module) main();
