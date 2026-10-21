import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

export const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export class PhotoDecodeRejected extends Error {
  constructor() { super("Photo could not be processed"); this.name = "PhotoDecodeRejected"; }
}

export function decodePhoto(bytes, kind = "plate") {
  return new Promise((accept, reject) => {
    const worker = new Worker(new URL("./image-decode-worker.mjs", import.meta.url), {
      resourceLimits: { maxOldGenerationSizeMb: 384, maxYoungGenerationSizeMb: 64 },
    });
    let settled = false;
    const finish = async (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      await worker.terminate();
      if (error) reject(error); else accept(result);
    };
    const timeout = setTimeout(() => { void finish(new Error("Image processing timed out")); }, 30_000);
    worker.once("message", result => { void finish(result.ok ? null : new PhotoDecodeRejected(), result); });
    worker.once("error", error => { void finish(error); });
    worker.once("exit", () => { if (!settled) void finish(new Error("Decoder stopped")); });
    worker.postMessage({ kind, bytes });
  });
}

// Backend is deliberately limited to photo jobs. No Storage removal or Auth API.
export function createPhotoWorker({ backend, decode = decodePhoto, emit = () => {}, now = Date.now,
  minDelayMs = 1500, maxDelayMs = 5000 }) {
  if (!Number.isInteger(minDelayMs) || minDelayMs < 500 || maxDelayMs < minDelayMs || maxDelayMs > 30000) {
    throw new Error("Invalid poll bounds");
  }
  let stopped = false, busy = false, delayMs = minDelayMs;
  const totals = { polls: 0, completed: 0, rejected: 0, blocked: 0, unavailableSources: 0 };

  async function execute(job) {
    let entry = null, input = null, stage = "source";
    const started = now();
    try {
      // A new upload must exist before its state changes: Storage INSERT requires pending.
      if (job.data.state === "pending") {
        input = await backend.source(job);
        if (!input) { totals.unavailableSources++; return false; }
      }
      entry = await backend.claim(job);
      if (!entry || ["complete", "rejected"].includes(entry.phase)) return false;
      if (entry.phase === "blocked") throw new Error("Job blocked");

      if (entry.sha256) {
        stage = "verify";
        const existing = await backend.output(entry);
        if (existing) {
          if (digest(existing) !== entry.sha256 || existing.length !== entry.byte_count) throw new Error("Output mismatch");
          stage = "complete_uncertain";
          await backend.complete(job);
          totals.completed++;
          emit({ event: "photo_complete", kind: job.kind, reusedOutput: true, elapsedMs: now() - started });
          return true;
        }
      }

      stage = "source";
      input ??= await backend.source(job);
      if (!input) throw new Error("Source unavailable after claim");
      stage = "decode";
      const result = await decode(input, job.kind === "preview" ? "menu-preview" : "plate");
      const bytes = Buffer.from(result.bytes);
      const maximum = job.kind === "preview" ? 640 : 2048;
      if (!bytes.length || bytes.length > (job.kind === "preview" ? 3_000_000 : 10_000_000)
        || !Number.isInteger(result.width) || !Number.isInteger(result.height)
        || Math.min(result.width, result.height) < 1 || Math.max(result.width, result.height) > maximum
        || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
        throw new Error("Invalid processed output");
      }
      const metadata = { sha256: digest(bytes), byte_count: bytes.length, width: result.width, height: result.height };
      if (entry.sha256 && (entry.sha256 !== metadata.sha256 || entry.byte_count !== metadata.byte_count
        || entry.width !== metadata.width || entry.height !== metadata.height)) throw new Error("Prepared output changed");
      stage = "prepare";
      entry = await backend.prepare(job, metadata);
      if (!entry || entry.sha256 !== metadata.sha256 || entry.byte_count !== bytes.length) throw new Error("Preparation not acknowledged");

      stage = "upload_uncertain";
      await backend.upload(entry, bytes); // upsert=false; acknowledgement must be conclusive
      stage = "verify";
      const stored = await backend.output(entry);
      if (!stored || digest(stored) !== metadata.sha256 || stored.length !== bytes.length) throw new Error("Stored output mismatch");
      stage = "complete_uncertain";
      await backend.complete(job);
      totals.completed++;
      emit({ event: "photo_complete", kind: job.kind, reusedOutput: false,
        elapsedMs: now() - started, inputBytes: input.length, outputBytes: bytes.length });
      return true;
    } catch (error) {
      if (entry) {
        // Only an explicit decoder reply before preparation can be terminally failed.
        // A timeout/crash, prepared retry or uncertain backend acknowledgement stays fenced.
        if (stage === "decode" && !entry.sha256 && error instanceof PhotoDecodeRejected) {
          try {
            await backend.reject(job);
            totals.rejected++;
            emit({ event: "photo_rejected", kind: job.kind });
            return true;
          } catch {
            // Rejection may have committed despite a lost reply. Never assume success.
          }
        }
        await backend.block(job, stage);
        totals.blocked++;
        emit({ event: "photo_blocked", kind: job.kind, stage });
        // The active run is kept fenced. A new run needs explicit stopped/drained confirmation.
        stopped = true;
      } else emit({ event: "photo_source_unavailable", kind: job.kind });
      return false;
    }
  }

  async function tick() {
    if (busy) throw new Error("Only one worker tick may run at a time");
    if (stopped) return { stopped: true, delayMs, totals: { ...totals } };
    busy = true;
    try {
      const queue = await backend.poll();
      totals.polls++;
      if (!queue || !Array.isArray(queue.jobs) || queue.jobs.length > 10) throw new Error("Invalid queue result");
      if (queue.counts.blocked > 0) throw new Error("Operator recovery required");
      let progressed = false;
      for (const job of queue.jobs) {
        if (stopped) break;
        if (!["plate", "table", "preview"].includes(job.kind)) throw new Error("Unknown queue kind");
        progressed = await execute(job) || progressed;
      }
      delayMs = progressed ? minDelayMs : Math.min(maxDelayMs, delayMs * 2);
      return { stopped, delayMs, counts: queue.counts, totals: { ...totals } };
    } finally { busy = false; }
  }
  return { tick, stop: () => { stopped = true; }, get stopped() { return stopped; }, get busy() { return busy; } };
}
