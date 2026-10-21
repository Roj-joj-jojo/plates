import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

// Offline benchmark only. No queue, backend client requests or cleanup calls.
const script = fileURLToPath(import.meta.url);
const mib = bytes => Math.round(bytes / 1024 / 1024 * 10) / 10;
const elapsed = start => Number(process.hrtime.bigint() - start) / 1e6;
const pause = milliseconds => new Promise(accept => setTimeout(accept, milliseconds));

async function child(mode, folder, scenario = "") {
  return new Promise((accept, reject) => {
    const processChild = spawn(process.execPath, [script, mode, folder, scenario], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "", errors = "";
    processChild.stdout.on("data", bytes => { output += bytes; });
    processChild.stderr.on("data", bytes => { errors += bytes; });
    processChild.once("error", reject);
    processChild.once("exit", code => {
      if (code !== 0) return reject(new Error(`Benchmark child failed (${code}): ${errors.slice(0, 2000)}`));
      try { accept(JSON.parse(output)); } catch { reject(new Error("Invalid benchmark result")); }
    });
  });
}

async function fixtures(folder) {
  const { default: sharp } = await import("sharp");
  const entries = [];
  // Deterministic noisy texture exercises compression more than solid colours.
  for (const [name, width, height, maxQuality] of [
    ["jpeg-12mp", 4000, 3000, 85],
    ["jpeg-48mp-near-limit", 8000, 6000, 85],
  ]) {
    const pixels = Buffer.alloc(width * height * 3);
    let state = 123456789;
    for (let index = 0; index < pixels.length; index += 3) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      const value = state & 255;
      pixels[index] = value;
      pixels[index + 1] = (value + (index / 3) % width) & 255;
      pixels[index + 2] = (value + Math.floor(index / 3 / width)) & 255;
    }
    let bytes, quality;
    for (quality = maxQuality; quality >= 5; quality -= 5) {
      bytes = await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality }).toBuffer();
      if (bytes.length <= 9_900_000) break;
    }
    assert(bytes.length <= 10_000_000, "Synthetic JPEG exceeds app input limit");
    const filename = `${name}.jpg`;
    await writeFile(resolve(folder, filename), bytes, { flag: "wx" });
    entries.push({ name, filename, width, height, bytes: bytes.length, quality });
  }
  const width = 1440, height = 3200;
  const pixels = Buffer.alloc(width * height * 3, 245);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      const value = y < 240 ? 30 : y % 180 < 36 && x > 80 && x < 1260 ? 95 : 245;
      pixels[offset] = value; pixels[offset + 1] = value; pixels[offset + 2] = value;
    }
  }
  const screenshot = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  await writeFile(resolve(folder, "screenshot.png"), screenshot, { flag: "wx" });
  entries.push({ name: "screenshot", filename: "screenshot.png", width, height, bytes: screenshot.length });
  await writeFile(resolve(folder, "fixtures.json"), JSON.stringify(entries, null, 2), { flag: "wx" });
  return { fixtures: entries, sharp: sharp.versions };
}

async function largePngFixture(folder) {
  const { default: sharp } = await import("sharp");
  const width = 10000, height = 5000;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      pixels[offset] = (x * 13 + y * 3) & 255;
      pixels[offset + 1] = (x * 7 + y * 17) & 255;
      pixels[offset + 2] = (x * 19 + y * 11) & 255;
    }
  }
  const bytes = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  assert(bytes.length <= 10_000_000, "Large PNG exceeds supported upload size");
  const entry = { name: "png-50mp", filename: "png-50mp.png", width, height, bytes: bytes.length };
  await writeFile(resolve(folder, entry.filename), bytes, { flag: "wx" });
  await writeFile(resolve(folder, "extra-fixtures.json"), JSON.stringify([entry], null, 2), { flag: "wx" });
  return entry;
}

async function measure(folder, scenario) {
  // Match the live worker's Supabase module overhead, without creating a client.
  await import("@supabase/supabase-js");
  const entries = JSON.parse(await readFile(resolve(folder,
    scenario === "png-50mp" ? "extra-fixtures.json" : "fixtures.json"), "utf8"));
  await pause(1000);
  const idleRssMiB = mib(process.memoryUsage().rss);
  const idleCpuStart = process.cpuUsage();
  await pause(1000);
  const idleCpu = process.cpuUsage(idleCpuStart);
  let sampledPeakBytes = process.memoryUsage().rss;
  const sampler = setInterval(() => { sampledPeakBytes = Math.max(sampledPeakBytes, process.memoryUsage().rss); }, 10);
  const termination = [];
  function decode(bytes, kind = "plate") {
    return new Promise((accept, reject) => {
      const worker = new Worker(new URL("./image-decode-worker.mjs", import.meta.url), {
        resourceLimits: { maxOldGenerationSizeMb: 384, maxYoungGenerationSizeMb: 64 },
      });
      const stop = () => { termination.push(worker.terminate()); };
      const timeout = setTimeout(() => { stop(); reject(new Error("Image processing timed out")); }, 30_000);
      worker.once("message", result => {
        clearTimeout(timeout); stop();
        if (result.ok) accept(result); else reject(new Error(result.message));
      });
      worker.once("error", error => { clearTimeout(timeout); reject(error); });
      worker.once("exit", code => { if (code !== 0) { clearTimeout(timeout); reject(new Error("Decoder stopped")); } });
      worker.postMessage({ kind, bytes });
    });
  }
  const selected = scenario === "burst-six" ? Array(6).fill(entries[1])
    : [entries.find(entry => entry.name === scenario)];
  assert(selected.every(Boolean), "Unknown benchmark scenario");
  const results = [];
  const batchStart = process.hrtime.bigint();
  const cpuStart = process.cpuUsage();
  try {
    for (const [index, entry] of selected.entries()) {
      const input = await readFile(resolve(folder, entry.filename));
      const jobStart = process.hrtime.bigint();
      const result = await decode(input);
      assert(result.width <= 2048 && result.height <= 2048, "Unexpected output dimensions");
      const output = Buffer.from(result.bytes);
      assert.equal(output.toString("ascii", 0, 4), "RIFF");
      assert.equal(output.toString("ascii", 8, 12), "WEBP");
      const photoMs = elapsed(jobStart);
      await writeFile(resolve(folder, `${scenario}-${index}-photo.webp`), output, { flag: "wx" });
      const previewStart = process.hrtime.bigint();
      const preview = await decode(output, "menu-preview");
      assert(preview.width <= 640 && preview.height <= 640, "Unexpected preview dimensions");
      const previewBytes = Buffer.from(preview.bytes);
      assert(previewBytes.length <= 3_000_000, "Preview exceeds current limit");
      const previewMs = elapsed(previewStart);
      await writeFile(resolve(folder, `${scenario}-${index}-preview.webp`), previewBytes, { flag: "wx" });
      results.push({ input: entry.name, inputBytes: input.length, photoMs: Math.round(photoMs),
        photoBytes: output.length, width: result.width, height: result.height,
        previewMs: Math.round(previewMs), previewBytes: previewBytes.length });
    }
    await Promise.allSettled(termination);
    const batchMs = elapsed(batchStart);
    const cpu = process.cpuUsage(cpuStart);
    const postBatchRssMiB = mib(process.memoryUsage().rss);
    await pause(1000);
    sampledPeakBytes = Math.max(sampledPeakBytes, process.memoryUsage().rss);
    return { scenario, idleRssMiB, idleCpuMsPerSecond: (idleCpu.user + idleCpu.system) / 1000,
      sampledPeakRssMiB: mib(sampledPeakBytes), osLifetimePeakRssMiB: mib(process.resourceUsage().maxRSS * 1024),
      postBatchRssMiB, settledRssMiB: mib(process.memoryUsage().rss), batchMs: Math.round(batchMs),
      cpuMs: Math.round((cpu.user + cpu.system) / 1000), results };
  } finally { clearInterval(sampler); }
}

if (process.argv[2] === "--fixtures") {
  console.log(JSON.stringify(await fixtures(process.argv[3])));
} else if (process.argv[2] === "--large-png-fixture") {
  console.log(JSON.stringify(await largePngFixture(process.argv[3])));
} else if (process.argv[2] === "--measure") {
  console.log(JSON.stringify(await measure(process.argv[3], process.argv[4])));
} else if (process.argv[2] === "--large-png") {
  assert.equal(process.argv.length, 4, "Pass the retained benchmark folder");
  const folder = resolve(process.argv[3]);
  assert(/^\/private\/tmp\/plates-photo-benchmark-[A-Za-z0-9]+$/.test(folder), "Use a retained benchmark folder");
  console.log("Generating high-resolution PNG separately...");
  const fixture = await child("--large-png-fixture", folder);
  console.log("Measuring png-50mp...");
  const result = await child("--measure", folder, "png-50mp");
  await writeFile(resolve(folder, "png-50mp-results.json"), JSON.stringify({ fixture, ...result }, null, 2), { flag: "wx" });
  console.log(`PASS: png-50mp peak ${result.osLifetimePeakRssMiB} MiB, idle ${result.idleRssMiB} MiB, wall ${result.batchMs} ms, CPU ${result.cpuMs} ms`);
  console.log(`Retained results: ${folder}/png-50mp-results.json`);
} else {
  assert.equal(process.argv.length, 2, "Run without arguments");
  const folder = await mkdtemp("/private/tmp/plates-photo-benchmark-");
  console.log(`Retained benchmark folder: ${folder}`);
  console.log("Generating synthetic fixtures in a separate process...");
  const generated = await child("--fixtures", folder);
  const measurements = [];
  for (const scenario of ["jpeg-12mp", "jpeg-48mp-near-limit", "screenshot", "burst-six"]) {
    console.log(`Measuring ${scenario}...`);
    const result = await child("--measure", folder, scenario);
    measurements.push(result);
    await writeFile(resolve(folder, `${scenario}-results.json`), JSON.stringify(result, null, 2), { flag: "wx" });
    console.log(`${scenario}: peak ${result.osLifetimePeakRssMiB} MiB, idle ${result.idleRssMiB} MiB, wall ${result.batchMs} ms, CPU ${result.cpuMs} ms`);
  }
  const report = { node: process.version, platform: platform(), architecture: arch(), osRelease: release(),
    generated, measurements, limitations: [
      "Synthetic fixtures; genuine phone photos and HEIC not measured.",
      "Generation occurs separately and is excluded from measured processes.",
      "OS high-water RSS includes process startup; sampled RSS can miss short peaks.",
      "Existing decoder/thread limits and asynchronous termination retained; photo plus Menu preview per job.",
      "No database, Storage, erasure, live polling, HTTP upload or hosted memory-limit test.",
      "Supabase module overhead included, but full live worker dependency/client/queue overhead is not.",
      "CPU and speed on this Mac do not predict shared hosted CPU; repeated batch is only six jobs.",
    ] };
  await writeFile(resolve(folder, "results.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(`PASS: transformations/dimensions checked; results retained at ${folder}/results.json`);
}
