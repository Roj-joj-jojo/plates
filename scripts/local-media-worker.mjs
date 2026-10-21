import { Worker } from "node:worker_threads";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { storageObjectExists } from "./storage-object-exists.mjs";
import { openLocalErasureStore, verifyWorkerIntent, completeRecordedErasure } from "./local-erasure-workflow.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) throw new Error("Set the local Supabase URL in .env.local before starting the media worker.");
const parsedUrl = new URL(url);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname)) {
  throw new Error("The media worker may connect only to local Supabase.");
}
// The key stays in this standalone process. Nothing is written to the app env file.
const localStatus = JSON.parse(execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const statusUrl = new URL(localStatus.API_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(statusUrl.hostname)
  || statusUrl.port !== parsedUrl.port) {
  throw new Error("The app URL does not match the running local Supabase project.");
}
const key = localStatus.SERVICE_ROLE_KEY;
if (!key) throw new Error("The local Supabase service key is unavailable.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
// A disposable erasure test can run cleanup without processing unrelated uploads.
const erasureJobProfile = process.argv[2] === "--erasure-job" ? process.argv[3] : null;
if (erasureJobProfile && (process.argv.length !== 4
  || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(erasureJobProfile))) {
  throw new Error("Use --erasure-job PROFILE_UUID for one confirmed admin deletion.");
}
const erasureOnlyProfile = process.argv[2] === "--erasure-only" ? process.argv[3] : null;
if (process.argv[2] && !erasureJobProfile && (!erasureOnlyProfile
  || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(erasureOnlyProfile)
  || process.argv[4] !== "--object-allowlist" || !process.argv[5] || process.argv.length !== 6)) {
  throw new Error("Use --erasure-only PROFILE_UUID --object-allowlist PATH for the approved test.");
}
const approvedObjects = erasureOnlyProfile ? new Set(JSON.parse(readFileSync(process.argv[5], "utf8"))
  .map((object) => `${object.bucket}/${object.path}`)) : null;

async function registerObjectAttempt(bucket, path, ownerId, sourcePlateId = null) {
  const { error } = await admin.rpc("register_media_object_attempt", {
    p_bucket_id: bucket, p_object_path: path, p_owner_id: ownerId,
    p_source_plate_id: sourcePlateId,
  });
  // The candidate erasure migration may not have been applied yet.
  if (error && !["PGRST202", "42883"].includes(error.code)) throw error;
}

async function finishObjectAttempt(bucket, path) {
  if (!path) return;
  const { error } = await admin.rpc("finish_media_object_attempt", {
    p_bucket_id: bucket, p_object_path: path,
  });
  if (error && !["PGRST202", "42883"].includes(error.code)) throw error;
}

async function removeFailedUpload(bucket, path, ownerId) {
  if (!path) return;
  const { error } = await admin.storage.from(bucket).remove([path]);
  if (!error) return;
  // An erasure job can retry this path even if this upload's own cleanup failed.
  const { error: queueError } = await admin.rpc("erasure_record_object", {
    p_profile_id: ownerId, p_bucket_id: bucket, p_object_path: path,
  });
  if (queueError && !["PGRST202", "42883", "23514"].includes(queueError.code))
    console.error("Could not queue failed upload cleanup:", bucket, queueError.code);
  console.error("Failed upload object needs cleanup:", bucket);
}

async function erasureRpc(name, args = {}) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw error;
  return data;
}

async function findObjectsUnderPrefix(bucket, prefix) {
  const paths = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(bucket)
      .list(prefix, { limit: 100, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.id) paths.push(`${prefix}/${item.name}`);
    }
    if ((data ?? []).length < 100) break;
  }
  return paths;
}

async function pollErasure() {
  let jobs;
  try { jobs = await erasureRpc("erasure_worker_jobs"); }
  catch (error) {
    if (["PGRST202", "42883"].includes(error.code)) return;
    throw error;
  }
  if (erasureJobProfile) jobs = (jobs ?? []).filter(job => job.profile_id === erasureJobProfile);
  if (!jobs?.length) return;
  const recordStore = await openLocalErasureStore();
  for (const job of jobs) await verifyWorkerIntent({store:recordStore,rpc:erasureRpc,profileId:job.profile_id});
  // Claiming currently spans all jobs. Refuse to claim anything if another account
  // has pending cleanup, keeping this test process within its approved scope.
  if (erasureOnlyProfile && jobs.some((job) => job.profile_id !== erasureOnlyProfile)) {
    throw new Error("Another erasure job exists; scoped test worker will not claim objects.");
  }
  const objects = erasureJobProfile
    ? await erasureRpc("erasure_claim_objects_for",{p_profile_id:erasureJobProfile})
    : await erasureRpc("erasure_claim_objects");
  for (const object of objects ?? []) {
    if (erasureJobProfile && object.profile_id !== erasureJobProfile) throw new Error("Worker refuses another account's object.");
    if (erasureOnlyProfile && object.profile_id !== erasureOnlyProfile) {
      throw new Error("Scoped test worker refuses another account's object.");
    }
    if (approvedObjects && !approvedObjects.has(`${object.bucket_id}/${object.object_path}`)) {
      throw new Error("Scoped test worker refuses an object outside the approved list.");
    }
    let removed = false;
    let failure = null;
    try {
      await verifyWorkerIntent({store:recordStore,rpc:erasureRpc,profileId:object.profile_id});
      const storage = admin.storage.from(object.bucket_id);
      const { error: removeError } = await storage.remove([object.object_path]);
      if (removeError) throw removeError;
      const exists = await storageObjectExists(storage, object.object_path);
      if (exists) throw new Error("Object is still present after removal");
      removed = true;
    } catch (error) {
      failure = error instanceof Error ? error.message : "Storage removal failed";
    }
    await erasureRpc("erasure_object_result", {
      p_profile_id: object.profile_id, p_bucket_id: object.bucket_id,
      p_object_path: object.object_path, p_removed: removed, p_error: failure,
    });
  }
  for (const job of jobs) {
    if (job.state === "auth_pending") {
      await verifyWorkerIntent({store:recordStore,rpc:erasureRpc,profileId:job.profile_id});
      const { error } = await admin.auth.admin.deleteUser(job.auth_user_id);
      if (error && error.status !== 404) throw error;
      await completeRecordedErasure({store:recordStore,rpc:erasureRpc,profileId:job.profile_id});
      console.log("Local account erasure complete:", job.profile_id);
      continue;
    }
    // These prefixes also catch staged uploads and previews missing an asset row.
    for (const bucket of ["staged-assets", "table-staged-assets", "menu-previews"]) {
      const paths = await findObjectsUnderPrefix(bucket, job.profile_id);
      for (const path of paths) {
        await erasureRpc("erasure_record_object", {
          p_profile_id: job.profile_id, p_bucket_id: bucket, p_object_path: path,
        });
      }
    }
    // Allow a running decode/upload attempt to finish or time out before finalizing.
    if (Date.now() - Date.parse(job.started_at) < 120_000) continue;
    await erasureRpc("erasure_mark_reconciled", { p_profile_id: job.profile_id });
    try {
      await erasureRpc("erasure_advance_identity", { p_profile_id: job.profile_id });
    } catch (error) {
      if (error.code !== "23514") throw error;
    }
  }
}

function decodeInWorker(bytes, kind = "plate") {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./image-decode-worker.mjs", import.meta.url),
      { resourceLimits: { maxOldGenerationSizeMb: 384, maxYoungGenerationSizeMb: 64 } });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("Image processing timed out"));
    }, 30_000);
    worker.once("message", (result) => {
      clearTimeout(timer);
      worker.terminate();
      if (result.ok) resolve(result);
      else reject(new Error(result.message));
    });
    worker.once("error", (error) => {
      clearTimeout(timer);
      worker.terminate();
      reject(error);
    });
    worker.once("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error("Image worker stopped unexpectedly"));
      }
    });
    worker.postMessage({ kind, bytes });
  });
}

async function processIntent(intent) {
  const { data: file, error: downloadError } = await admin.storage
    .from("staged-assets").download(intent.staged_path);
  // The browser may not have finished uploading yet.
  if (downloadError) return;
  const { data: claimed, error: claimError } = await admin.from("media_upload_intents")
    .update({ state: "processing", updated_at: new Date().toISOString() })
    .eq("id", intent.id).eq("state", "pending").select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;
  let uploadedPath = null;
  let attemptPath = null;
  try {
    const result = await decodeInWorker(Buffer.from(await file.arrayBuffer()));
    const assetId = crypto.randomUUID();
    const path = `${assetId}.webp`;
    attemptPath = path;
    await registerObjectAttempt("plate-media", path, intent.uploader_id);
    const { error: uploadError } = await admin.storage.from("plate-media")
      .upload(path, Buffer.from(result.bytes), { contentType: "image/webp", upsert: false });
    if (uploadError) throw uploadError;
    uploadedPath = path;
    const { error: finishError } = await admin.rpc("finish_plate_upload", {
      p_intent_id: intent.id, p_asset_id: assetId, p_object_path: path,
      p_width: result.width, p_height: result.height,
    });
    if (finishError) throw finishError;
    console.log("Plate image ready:", intent.id);
  } catch (error) {
    await removeFailedUpload("plate-media", uploadedPath, intent.uploader_id);
    const message = error instanceof Error ? error.message : "Image processing failed";
    await admin.rpc("fail_plate_upload", { p_intent_id: intent.id,
      p_message: /image|format|timed out|10 MB/i.test(message) ? message : "Image processing failed" });
    console.error("Plate image failed:", intent.id);
  } finally {
    await finishObjectAttempt("plate-media", attemptPath);
  }
}

async function processTableIntent(intent) {
  const { data: file, error: downloadError } = await admin.storage
    .from("table-staged-assets").download(intent.staged_path);
  if (downloadError) return;
  const { data: claimed, error: claimError } = await admin.from("table_upload_intents")
    .update({ state: "processing", updated_at: new Date().toISOString() })
    .eq("id", intent.id).eq("state", "pending").select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;
  let uploadedPath = null;
  let attemptPath = null;
  try {
    const result = await decodeInWorker(Buffer.from(await file.arrayBuffer()));
    const assetId = crypto.randomUUID();
    const path = `${intent.group_id}/${assetId}.webp`;
    attemptPath = path;
    await registerObjectAttempt("table-media", path, intent.uploader_id);
    const { error: uploadError } = await admin.storage.from("table-media")
      .upload(path, Buffer.from(result.bytes), { contentType: "image/webp", upsert: false });
    if (uploadError) throw uploadError;
    uploadedPath = path;
    const { error: finishError } = await admin.rpc("finish_table_upload", {
      p_intent_id: intent.id, p_asset_id: assetId, p_object_path: path,
      p_width: result.width, p_height: result.height,
    });
    if (finishError) throw finishError;
    console.log("Table image ready:", intent.id);
  } catch (error) {
    await removeFailedUpload("table-media", uploadedPath, intent.uploader_id);
    const message = error instanceof Error ? error.message : "Image processing failed";
    await admin.rpc("fail_table_upload", { p_intent_id: intent.id,
      p_message: /image|format|timed out|10 MB/i.test(message) ? message : "Image processing failed" });
    console.error("Table image failed:", intent.id);
  } finally {
    await finishObjectAttempt("table-media", attemptPath);
  }
}

async function processPreviewJob(job) {
  const { data: claimed, error: claimError } = await admin.from("menu_preview_jobs")
    .update({ state: "processing", updated_at: new Date().toISOString() })
    .eq("id", job.id).eq("state", "pending").select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;
  let uploadedPath = null;
  let attemptPath = null;
  try {
    const { data: source, error: sourceError } = await admin.from("media_assets")
      .select("object_path").eq("id", job.source_asset_id).single();
    if (sourceError || !source) throw new Error("Menu preview source unavailable");
    const { data: file, error: downloadError } = await admin.storage
      .from("plate-media").download(source.object_path);
    if (downloadError || !file) throw new Error("Menu preview source unavailable");
    const result = await decodeInWorker(Buffer.from(await file.arrayBuffer()), "menu-preview");
    const assetId = crypto.randomUUID();
    const path = `${job.saver_id}/${assetId}.webp`;
    attemptPath = path;
    await registerObjectAttempt("menu-previews", path, job.saver_id, job.plate_id);
    const { error: uploadError } = await admin.storage.from("menu-previews")
      .upload(path, Buffer.from(result.bytes), { contentType: "image/webp", upsert: false });
    if (uploadError) throw uploadError;
    uploadedPath = path;
    const { error: finishError } = await admin.rpc("finish_menu_preview", {
      p_job_id: job.id, p_asset_id: assetId, p_object_path: path,
      p_width: result.width, p_height: result.height,
    });
    if (finishError) throw finishError;
    console.log("Menu preview ready:", job.id);
  } catch {
    await removeFailedUpload("menu-previews", uploadedPath, job.saver_id);
    await admin.rpc("fail_menu_preview", {
      p_job_id: job.id, p_message: "Menu preview processing failed",
    });
    console.error("Menu preview failed:", job.id);
  } finally {
    await finishObjectAttempt("menu-previews", attemptPath);
  }
}

async function pollPictureCleanup() {
  // Scoped object-allowlist tests must not acquire newly introduced cleanup work.
  if (erasureOnlyProfile) return;
  const { data, error } = await admin.rpc("claim_picture_cleanup", { p_profile_id: erasureJobProfile });
  if (error && ["PGRST202", "42883"].includes(error.code)) return;
  if (error) throw error;
  for (const picture of data ?? []) {
    let ok = true;
    // Both paths come from trusted asset/intent records, never from browser input.
    for (const [bucket, path] of [["plate-media", picture.object_path], ["staged-assets", picture.staged_path]]) {
      try {
        const { error: removeError } = await admin.storage.from(bucket).remove([path]);
        if (removeError && await storageObjectExists(admin.storage.from(bucket), path)) ok = false;
      } catch { ok = false; }
    }
    const finished = await admin.rpc("finish_picture_cleanup", { p_asset_id: picture.asset_id, p_ok: ok });
    if (finished.error) throw finished.error;
  }
}

async function poll() {
  await pollErasure();
  // Erasure verifies independent recorded intent first. Its picture gate may wait
  // one cycle for this queue, then safely advance identity on the following cycle.
  await pollPictureCleanup();
  if (erasureOnlyProfile || erasureJobProfile) return;
  const { data, error } = await admin.from("media_upload_intents")
    .select("id, uploader_id, staged_path").eq("state", "pending").order("created_at").limit(10);
  if (error) throw error;
  for (const intent of data ?? []) await processIntent(intent);
  const { data: tableIntents, error: tableError } = await admin.from("table_upload_intents")
    .select("id, uploader_id, group_id, staged_path").eq("state", "pending").order("created_at").limit(10);
  if (tableError && tableError.code !== "PGRST205" && tableError.code !== "42P01") throw tableError;
  for (const intent of tableIntents ?? []) await processTableIntent(intent);
  const { data: jobs, error: jobsError } = await admin.from("menu_preview_jobs")
    .select("id, saver_id, plate_id, source_asset_id").eq("state", "pending").order("created_at").limit(10);
  if (jobsError?.code === "PGRST205" || jobsError?.code === "42P01") return;
  if (jobsError) throw jobsError;
  for (const job of jobs ?? []) await processPreviewJob(job);
}

console.log(erasureJobProfile ? "Confirmed account cleanup worker started." : "Local media worker started. Keep this process running while uploading or saving photos.");
const erasureJobDeadline=Date.now()+15*60*1000;
while (true) {
  try { await poll(); }
  catch (error) {
    console.error("Media worker cycle failed; retrying.", error?.code ?? "unknown error");
    if (erasureJobProfile) break;
  }
  if (erasureJobProfile && (Date.now()>=erasureJobDeadline
    || !(await erasureRpc("erasure_worker_jobs")).some(job=>job.profile_id===erasureJobProfile))) break;
  await new Promise((resolve) => setTimeout(resolve, 1500));
}
