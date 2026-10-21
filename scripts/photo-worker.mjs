import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { createPhotoBackend } from "./photo-worker-backend.mjs";
import { photoWorkerConfig } from "./photo-worker-config.mjs";
import { createPhotoWorker } from "./photo-worker-runtime.mjs";

// Dedicated photo service: no local CLI, app .env loading, Auth deletion or cleanup queue.
try {
  const config = photoWorkerConfig(process.env, process.argv.slice(2));
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const readiness = await client.rpc("photo_worker_ready");
  if (readiness.error || readiness.data !== 1) throw new Error("Photo worker schema is not ready");
  const runId = randomUUID();
  const opened = await client.rpc("photo_worker_open", { p_run_id: runId,
    p_previous_run_id: config.previousRun, p_writer_stopped: Boolean(config.previousRun), p_requests_drained: Boolean(config.previousRun) });
  if (opened.error) throw new Error("Worker ownership unavailable; inspect the previous run");
  const backend = createPhotoBackend(client, runId);
  const emit = event => console.log(JSON.stringify(event));
  const worker = createPhotoWorker({ backend, emit });
  const controller = new AbortController();
  const stop = () => { worker.stop(); controller.abort(); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  emit({ event: "photo_worker_started", runId, environment: config.environment });
  let lastHealth = Date.now(), previousCpu = process.cpuUsage();
  let last = null;
  try {
    while (!worker.stopped) {
      last = await worker.tick();
      if (Date.now() - lastHealth >= 60_000) {
        const cpu = process.cpuUsage(previousCpu);
        emit({ event: "photo_worker_health", rssBytes: process.memoryUsage().rss,
          cpuMs: (cpu.user + cpu.system) / 1000, intervalMs: Date.now() - lastHealth,
          delayMs: last.delayMs, counts: last.counts, totals: last.totals });
        previousCpu = process.cpuUsage(); lastHealth = Date.now();
      }
      if (!worker.stopped) await sleep(last.delayMs, undefined, { signal: controller.signal }).catch(error => {
        if (error.name !== "AbortError") throw error;
      });
    }
  } finally {
    const drained = await backend.close();
    emit({ event: "photo_worker_stopped", drained: drained === true });
    if (drained !== true || last?.totals.blocked) process.exitCode = 1;
  }
} catch {
  // SDK/config errors can include URLs or headers. Never print the raw error.
  console.error("Photo worker refused or stopped; review configuration, ownership and job state.");
  process.exitCode = 1;
}
