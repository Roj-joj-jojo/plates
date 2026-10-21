import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { localPhotoWorkerEnvironment } from "./start-local-photo-worker.mjs";
import { decodePhoto } from "./photo-worker-runtime.mjs";

const url = "http://127.0.0.1:54321";
const status = { API_URL: url, SERVICE_ROLE_KEY: "PLACEHOLDER_TEST_KEY" };
assert.equal(localPhotoWorkerEnvironment(url, status).PHOTO_WORKER_ENVIRONMENT, "local");
for (const invalid of [undefined, "https://example.supabase.co", "http://127.0.0.1:54322",
  `${url}/other`, `${url}/?token=PLACEHOLDER`, "http://PLACEHOLDER@127.0.0.1:54321"]) {
  assert.throws(() => localPhotoWorkerEnvironment(invalid, status));
}
assert.throws(() => localPhotoWorkerEnvironment(url, { ...status, SERVICE_ROLE_KEY: "" }));
assert.throws(() => localPhotoWorkerEnvironment(url, { ...status, API_URL: "https://example.supabase.co" }));
assert.throws(() => localPhotoWorkerEnvironment(url, status, ["--writer-stopped"]));
const recovery = ["--recover-stopped-run", "11111111-1111-4111-8111-111111111111",
  "--writer-stopped", "--requests-drained"];
assert.equal(localPhotoWorkerEnvironment(url, status, recovery).PHOTO_WORKER_EXPECTED_ORIGIN, url);
console.log("PASS: local origin, credential and explicit recovery guards (offline)");

// Verify the installed npm command avoids the flag responsible for the decoder crash.
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(manifest.scripts["photo:worker"], "node --env-file=.env.local scripts/start-local-photo-worker.mjs");
const sharp = (await import("sharp")).default;
const input = await sharp({ create: { width: 16, height: 8, channels: 3, background: "#336699" } }).png().toBuffer();
const output = await decodePhoto(input);
assert.equal(output.width, 16);
assert.equal(output.height, 8);
assert.equal(Buffer.from(output.bytes).toString("ascii", 8, 12), "WEBP");
console.log("PASS: file-based launch supports real in-memory decoder processing (offline)");
