import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPhotoWorker, decodePhoto, digest, PhotoDecodeRejected } from "./photo-worker-runtime.mjs";
import { photoWorkerConfig } from "./photo-worker-config.mjs";
import { createPhotoBackend } from "./photo-worker-backend.mjs";

const bytes = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPsynthetic-test")]);
const decoded = { bytes, width: 32, height: 24 };
const key = job => `${job.kind}:${job.id}`;
function memoryBackend(jobs, shared = {}) {
  shared.entries ??= new Map(); shared.objects ??= new Map(); shared.completed ??= new Set();
  shared.rejected ??= new Set();
  const counters = { poll: 0, source: 0, upload: 0, complete: 0, reject: 0 };
  return {
    shared, counters, faults: {},
    async poll() { counters.poll++; return { jobs: jobs.filter(job => !shared.completed.has(key(job)) && !shared.rejected.has(key(job))), counts: { blocked: 0 } }; },
    async source() { counters.source++; if (this.faults.source) return null; return Buffer.from("input"); },
    async claim(job) {
      if (!shared.entries.has(key(job))) shared.entries.set(key(job), {
        phase: "claimed", asset_id: "stable-asset", bucket: "synthetic", object_path: `${key(job)}.webp`,
      });
      return { ...shared.entries.get(key(job)) };
    },
    async prepare(job, metadata) {
      const entry = shared.entries.get(key(job));
      if (entry.sha256 && entry.sha256 !== metadata.sha256) throw new Error("Changed bytes");
      Object.assign(entry, metadata, { phase: "prepared" });
      return { ...entry };
    },
    async output(entry) { return shared.objects.get(entry.object_path) ?? null; },
    async upload(entry, value) {
      counters.upload++;
      assert(!shared.objects.has(entry.object_path), "No overwrite on upload");
      shared.objects.set(entry.object_path, this.faults.corrupt ? Buffer.from("wrong") : Buffer.from(value));
      if (this.faults.uploadAfterWrite) throw new Error("Uncertain reply");
    },
    async complete(job) {
      counters.complete++;
      shared.completed.add(key(job)); shared.entries.get(key(job)).phase = "complete";
      if (this.faults.completeAfterCommit) throw new Error("Lost completion reply");
    },
    async block(job, stage) {
      const entry = shared.entries.get(key(job));
      if (!["complete", "rejected"].includes(entry.phase)) { entry.phase = "blocked"; entry.failure_code = stage; }
    },
    async reject(job) {
      counters.reject++;
      const entry = shared.entries.get(key(job));
      assert.equal(entry.phase, "claimed"); assert(!entry.sha256);
      entry.phase = "rejected"; shared.rejected.add(key(job));
      if (this.faults.rejectAfterCommit) throw new Error("Lost rejection reply");
    },
    operatorRecover() {
      for (const entry of shared.entries.values()) if (!["complete", "rejected"].includes(entry.phase)) entry.phase = entry.sha256 ? "prepared" : "claimed";
    },
  };
}

const baseEnv = { PHOTO_WORKER_ENABLED: "true", PHOTO_WORKER_ENVIRONMENT: "local",
  PHOTO_WORKER_SERVICE_KEY: "PLACEHOLDER_TEST_KEY", PHOTO_WORKER_SUPABASE_URL: "http://127.0.0.1:54321",
  PHOTO_WORKER_EXPECTED_ORIGIN: "http://127.0.0.1:54321" };
assert.equal(photoWorkerConfig(baseEnv).environment, "local");
for (const change of [{ PHOTO_WORKER_ENABLED: "false" }, { PHOTO_WORKER_ENVIRONMENT: "hosted" },
  { PHOTO_WORKER_EXPECTED_ORIGIN: "http://localhost:54321" }, { PHOTO_WORKER_SERVICE_KEY: "" },
  { PHOTO_WORKER_SUPABASE_URL: "http://127.0.0.1:54321/?token=PLACEHOLDER" }]) {
  assert.throws(() => photoWorkerConfig({ ...baseEnv, ...change }));
}
assert.throws(() => photoWorkerConfig(baseEnv, ["--writer-stopped"]));
assert.equal(photoWorkerConfig(baseEnv, ["--recover-stopped-run", "11111111-1111-4111-8111-111111111111",
  "--writer-stopped", "--requests-drained"]).previousRun, "11111111-1111-4111-8111-111111111111");
console.log("PASS: disabled/default/backend/recovery configuration guards");

const empty = memoryBackend([]);
const idle = createPhotoWorker({ backend: empty });
assert.equal((await idle.tick()).delayMs, 3000);
assert.equal((await idle.tick()).delayMs, 5000);
assert.equal((await idle.tick()).delayMs, 5000);
assert.equal(empty.counters.poll, 3);
assert.equal(empty.counters.source, 0);
console.log("PASS: one empty poll per tick with bounded idle backoff");

const jobs = ["plate", "table", "preview"].map((kind, index) => ({ kind, id: `job-${index}`, data: { state: "pending" } }));
let inFlight = 0, maximum = 0;
const normal = memoryBackend(jobs);
const events = [];
const worker = createPhotoWorker({ backend: normal, emit: event => events.push(event), decode: async () => {
  inFlight++; maximum = Math.max(maximum, inFlight); await Promise.resolve(); inFlight--; return decoded;
} });
assert.equal((await worker.tick()).totals.completed, 3);
assert.equal(maximum, 1);
assert.equal(normal.counters.upload, 3);
assert.equal((await worker.tick()).totals.completed, 3);
assert(events.every(event => !JSON.stringify(event).includes("job-")));
console.log("PASS: sequential Plate/Table/preview outcomes, no repeat uploads, content-free events");

const interrupted = memoryBackend([jobs[0]]);
interrupted.faults.uploadAfterWrite = true;
const failed = createPhotoWorker({ backend: interrupted, decode: async () => decoded });
assert.equal((await failed.tick()).stopped, true);
assert.equal(interrupted.shared.entries.get(key(jobs[0])).failure_code, "upload_uncertain");
assert.equal(interrupted.shared.objects.size, 1);
assert.equal((await failed.tick()).stopped, true);
assert.equal(interrupted.counters.upload, 1);
interrupted.operatorRecover(); // Model-only: real recovery requires operator stop/drain evidence.
const recoveredBackend = memoryBackend([{ ...jobs[0], data: { state: "processing" } }], interrupted.shared);
const recovered = createPhotoWorker({ backend: recoveredBackend, decode: async () => { throw new Error("Should reuse output"); } });
assert.equal((await recovered.tick()).totals.completed, 1);
assert.equal(recoveredBackend.counters.upload, 0);
assert.equal(recoveredBackend.counters.source, 0);
assert.equal(recoveredBackend.shared.objects.size, 1);
console.log("PASS: uncertain upload stops; confirmed-recovery model reuses hash-verified output");

const corrupted = memoryBackend([jobs[0]]); corrupted.faults.corrupt = true;
const corruptWorker = createPhotoWorker({ backend: corrupted, decode: async () => decoded });
assert.equal((await corruptWorker.tick()).totals.blocked, 1);
assert.equal(corrupted.shared.completed.size, 0);
assert.equal(corrupted.shared.objects.size, 1); // Preserve uncertain bytes; no deletion hidden in recovery.
console.log("PASS: mismatched bytes block completion and are preserved");

const lost = memoryBackend([jobs[0]]); lost.faults.completeAfterCommit = true;
await createPhotoWorker({ backend: lost, decode: async () => decoded }).tick();
assert.equal(lost.shared.entries.get(key(jobs[0])).phase, "complete");
assert.equal(lost.shared.completed.size, 1);
assert.equal((await createPhotoWorker({ backend: memoryBackend(jobs.slice(0, 1), lost.shared) }).tick()).totals.completed, 0);
console.log("PASS: committed completion with lost reply is not downgraded or duplicated");

const missing = memoryBackend([jobs[0]]); missing.faults.source = true;
assert.equal((await createPhotoWorker({ backend: missing }).tick()).totals.unavailableSources, 1);
assert.equal(missing.shared.entries.size, 0);
console.log("PASS: unfinished browser upload remains pending before claim");

const rejectionJobs = jobs.flatMap(job => [job, { ...job, id: `${job.id}-valid` }]);
const rejectionBackend = memoryBackend(rejectionJobs);
let decodeCalls = 0;
const rejectionWorker = createPhotoWorker({ backend: rejectionBackend, decode: async () => {
  if (++decodeCalls % 2) throw new PhotoDecodeRejected();
  return decoded;
} });
const rejectionTick = await rejectionWorker.tick();
assert.equal(rejectionTick.stopped, false);
assert.equal(rejectionTick.totals.rejected, 3);
assert.equal(rejectionTick.totals.completed, 3);
assert.equal(rejectionBackend.counters.upload, 3);
assert.equal(rejectionBackend.shared.entries.size, 6);
assert.equal((await rejectionWorker.tick()).totals.rejected, 3);
console.log("PASS: explicit decoder rejection fails Plate/Table/preview jobs and continues with valid jobs");

const crashBackend = memoryBackend([jobs[0]]);
const crashWorker = createPhotoWorker({ backend: crashBackend, decode: async () => { throw new Error("Decoder timeout or crash"); } });
assert.equal((await crashWorker.tick()).stopped, true);
assert.equal(crashBackend.counters.reject, 0);
const preparedBackend = memoryBackend([{ ...jobs[0], data: { state: "processing" } }]);
preparedBackend.shared.entries.set(key(jobs[0]), { phase: "prepared", sha256: digest(bytes), byte_count: bytes.length,
  width: 32, height: 24, bucket: "synthetic", object_path: "retained.webp" });
assert.equal((await createPhotoWorker({ backend: preparedBackend, decode: async () => { throw new PhotoDecodeRejected(); } }).tick()).stopped, true);
assert.equal(preparedBackend.counters.reject, 0);
assert.equal(preparedBackend.shared.entries.get(key(jobs[0])).sha256, digest(bytes));
console.log("PASS: decoder crash and failed decode of prepared retry preserve ownership for review");

const lostRejection = memoryBackend([jobs[0]]); lostRejection.faults.rejectAfterCommit = true;
assert.equal((await createPhotoWorker({ backend: lostRejection, decode: async () => { throw new PhotoDecodeRejected(); } }).tick()).stopped, true);
assert.equal(lostRejection.shared.entries.get(key(jobs[0])).phase, "rejected");
lostRejection.operatorRecover();
assert.equal(lostRejection.shared.entries.get(key(jobs[0])).phase, "rejected");
console.log("PASS: lost rejection acknowledgement stops without downgrading or reopening committed failure");

let release;
const concurrent = createPhotoWorker({ backend: memoryBackend(jobs.slice(0, 1)), decode: () => new Promise(accept => { release = accept; }) });
const running = concurrent.tick();
while (!release) await Promise.resolve();
await assert.rejects(concurrent.tick(), /one worker tick/);
concurrent.stop(); release(decoded);
await running;
assert.equal(concurrent.stopped, true);
console.log("PASS: overlapping ticks refused and stop drains the current job");

const calls = [];
const fakeClient = { rpc: async (name, args) => { calls.push({ name, args }); return { data: true, error: null }; },
  storage: { from: () => ({ upload: async (path, value, options) => { assert.equal(options.upsert, false); return { error: null }; } }) } };
const adapter = createPhotoBackend(fakeClient, "run-test");
await adapter.poll(); await adapter.complete(jobs[0]); await adapter.upload({ bucket: "synthetic", object_path: "test" }, bytes);
await adapter.reject(jobs[0]);
assert.equal(calls[0].name, "photo_worker_poll");
assert.equal(calls[1].args.p_run_id, "run-test");
assert.equal(calls[2].name, "photo_worker_reject");
assert(!Object.keys(adapter).some(name => /delete|remove|erasure/i.test(name)));
console.log("PASS: adapter has no removal/Auth operations and refuses upload overwrite");

// Default synthetic input stays in memory. An optional owner-selected local file is read only.
const { default: sharp } = await import("sharp");
const fixture = process.argv[2] ? await readFile(process.argv[2])
  : await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#864234" } }).png().toBuffer();
const actual = await decodePhoto(fixture);
assert(actual.width <= 2048 && actual.height <= 2048);
assert.equal(Buffer.from(actual.bytes).toString("ascii", 8, 12), "WEBP");
const preview = await decodePhoto(Buffer.from(actual.bytes), "menu-preview");
assert(preview.width <= 640 && preview.height <= 640);
assert.equal(digest(Buffer.from(actual.bytes)).length, 64);
await assert.rejects(decodePhoto(Buffer.from("not an image")), PhotoDecodeRejected);
console.log("PASS: real in-memory synthetic decoder, Menu preview and malformed-input rejection through the new thread lifecycle");
console.log("PASS photo worker runtime: in-memory failure/recovery and offline decoder checks; no database or hosted verification");
