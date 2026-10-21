// Test-only writer: upload one exact fixture, then wait without finalising its attempt.
// It is started/killed only by the explicitly approved crash-recovery harness.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { createClient } from "@supabase/supabase-js";

let decoder;
try {
  const runId = process.argv[2];
  if (!process.send || process.argv.length !== 3
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    throw new Error("Approved harness IPC and one run UUID required");
  }
  const state = JSON.parse(readFileSync(`/private/tmp/plates-erasure-${runId}.json`, "utf8"));
  if (state.runId !== runId || !state.crashRecovery || !state.prepared || state.started
    || state.completed || state.writerStarted
    || state.blocker !== `erasure-test-${runId}.webp`) throw new Error("Unexpected fixture state");
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Loopback HTTP required");
  }
  const status = JSON.parse(execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  const statusUrl = new URL(status.API_URL);
  if (statusUrl.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(statusUrl.hostname)
    || statusUrl.port !== url.port) throw new Error("Local project mismatch");
  const admin = createClient(url.href, status.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: intent, error: intentError } = await admin.from("media_upload_intents")
    .select("uploader_id,staged_path,state").eq("id", state.blockedIntent).single();
  if (intentError || intent.uploader_id !== state.author.profileId || intent.state !== "processing"
    || !state.objects.some((object) => object.bucket === "staged-assets"
      && object.path === intent.staged_path && object.erase)) throw new Error("Wrong upload intent");
  const { data: file, error: downloadError } = await admin.storage.from("staged-assets").download(intent.staged_path);
  if (downloadError) throw downloadError;
  const inputBytes = Buffer.from(await file.arrayBuffer());
  decoder = new Worker(new URL("../../scripts/image-decode-worker.mjs", import.meta.url));
  const decoded = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Decoder timeout")), 30000);
    decoder.once("message", (result) => {
      clearTimeout(timer);
      if (result.ok) resolve(result); else reject(new Error("Decode failed"));
    });
    decoder.once("error", (error) => { clearTimeout(timer); reject(error); });
    decoder.postMessage({ kind: "plate", bytes: inputBytes });
  });
  await decoder.terminate();
  decoder = null;
  const { error: attemptError } = await admin.rpc("register_media_object_attempt", {
    p_bucket_id: "plate-media", p_object_path: state.blocker, p_owner_id: state.author.profileId,
  });
  if (attemptError) throw attemptError;
  const { error: uploadError } = await admin.storage.from("plate-media").upload(state.blocker,
    Buffer.from(decoded.bytes), { contentType: "image/webp", upsert: false });
  if (uploadError) throw uploadError;
  // Ready means upload acknowledged, decoder exit awaited, no pending Storage call.
  process.send({ stage: "uploaded-awaiting-finalisation", decoderStopped: true });
  setInterval(() => {}, 1000);
} catch {
  if (decoder) await decoder.terminate();
  process.send?.({ stage: "failed" });
  process.exitCode = 1;
  process.disconnect?.();
}
