// Two phases: prepare creates labelled local fixtures; --erase-approved RUN_ID
// runs only after the owner approves the generated scope document's exact targets.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { storageObjectExists } from "../../scripts/storage-object-exists.mjs";
import { openLocalErasureStore, requestRecordedErasure, verifyWorkerIntent } from "../../scripts/local-erasure-workflow.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function check(ok, message) { if (!ok) throw new Error(message); }
function local(address) {
  const parsed = new URL(address);
  check(parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname),
    "Test may only contact loopback HTTP services");
  return parsed;
}
check(url && key, "Set the existing local Supabase environment before running this test");
const parsed = local(url);
const status = JSON.parse(execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
check(local(status.API_URL).port === parsed.port, "Local Supabase URL does not match this project");
const admin = createClient(url, status.SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}
function sql(query) {
  return execFileSync(docker, ["exec", "supabase_db_plates", "psql", "-X", "-qAt",
    "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", query],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function id(value) {
  check(/^[0-9a-f-]{36}$/i.test(value), "Fixture UUID is invalid");
  return `'${value}'::uuid`;
}
async function account(label, runId) {
  const email = `plates-erasure-${label}-${runId}@example.test`;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: sent } = await client.auth.signInWithOtp({ email,
    options: { data: { display_name: `Local erasure ${label}` }, shouldCreateUser: true } });
  if (sent) throw sent;
  let message;
  for (let i = 0; i < 30; i++) {
    const response = await fetch("http://127.0.0.1:54324/api/v1/messages",
      { signal: AbortSignal.timeout(10000) });
    check(response.ok, "Local mail listing failed");
    const listing = await response.json();
    const match = listing.messages.find((item) => item.To?.some((to) => to.Address === email));
    if (match) {
      const detail = await fetch(`http://127.0.0.1:54324/api/v1/message/${match.ID}`);
      check(detail.ok, "Local mail detail failed");
      message = await detail.json(); break;
    }
    await sleep(1000);
  }
  const token = message?.HTML.match(/<strong>\s*([0-9]{6})\s*<\/strong>/)?.[1];
  check(token, "Synthetic account's local email code did not arrive");
  const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  const profileId = sql(`select profile_id from private.profile_auth_links where auth_user_id=${id(data.user.id)}`);
  const { data: profile, error: profileError } = await client.from("profiles").select("id").eq("id", profileId).single();
  if (profileError) throw profileError;
  return { email, authId: data.user.id, profileId: profile.id, session: data.session, client };
}
const resumePreparation = process.argv[2] === "--resume-preparation";
const browserApproved = process.argv[2] === "--browser-approved";
const prepareCrashRecovery = process.argv[2] === "--prepare-crash-recovery";
const crashRecoveryApproved = process.argv[2] === "--crash-recovery-approved";
const runId = process.argv[2] === "--erase-approved" || browserApproved || resumePreparation || crashRecoveryApproved
  ? process.argv[3] : crypto.randomUUID();
check(/^[0-9a-f-]{36}$/i.test(runId), "Supply the approved run UUID");
const privatePath = `/private/tmp/plates-erasure-${runId}.json`;
let state;
let crashWriter = null;
async function stopCrashWriter() {
  if (!crashWriter) return;
  const child = crashWriter;
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Fixture writer exit was not observed; recovery refused")), 10000);
      child.once("exit", () => { clearTimeout(timeout); resolve(); });
      if (!child.kill("SIGKILL")) { clearTimeout(timeout); reject(new Error("Fixture writer kill failed")); }
    });
  }
  check(child.exitCode !== null || child.signalCode !== null, "Fixture writer is still running");
  crashWriter = null;
}
async function startCrashWriter() {
  check(!state.started && !state.writerStarted, "Crash drill cannot restart an earlier fixture writer");
  crashWriter = spawn(process.execPath, ["--env-file=.env.local", "supabase/tests/abandoned_upload_writer.mjs", runId],
    { stdio: ["ignore", "ignore", "ignore", "ipc"] });
  await new Promise((resolve, reject) => {
    const child = crashWriter;
    const timeout = setTimeout(() => reject(new Error("Fixture writer readiness timed out")), 45000);
    function fail() { clearTimeout(timeout); reject(new Error("Fixture writer failed before readiness")); }
    child.once("error", fail);
    child.once("exit", fail);
    child.on("message", (message) => {
      if (message.stage === "uploaded-awaiting-finalisation" && message.decoderStopped === true) {
        clearTimeout(timeout); child.removeListener("error", fail); child.removeListener("exit", fail); resolve();
      } else if (message.stage === "failed") fail();
    });
  });
  state.writerStarted = true; save();
  console.log("PASS: isolated writer uploaded the exact fixture path and awaited decoder shutdown; finalisation is paused");
}
function save() {
  writeFileSync(privatePath, JSON.stringify(state, (name, value) => name === "client" ? undefined : value),
    { mode: 0o600 });
}
async function upload(bucket, path, bytes) {
  const { error } = await admin.storage.from(bucket).upload(path, bytes,
    { contentType: bucket.endsWith("staged-assets") ? "application/octet-stream" : "image/webp", upsert: false });
  if (error) throw error;
}
async function signed(bucket, path, client) {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  check((await fetch(data.signedUrl)).ok, "Prepared image signed URL was not readable");
  return data.signedUrl;
}
async function photo(person, bucket, groupId = null) {
  const table = bucket === "table-media";
  const rows = await rpc(person.client, table ? "request_table_upload" : "request_plate_upload",
    table ? { p_group_id: groupId } : {});
  const intent = rows[0];
  const { error } = await admin.from(table ? "table_upload_intents" : "media_upload_intents")
    .update({ state: "processing" }).eq("id", intent.intent_id);
  if (error) throw error;
  const assetId = crypto.randomUUID();
  const path = table ? `${groupId}/${assetId}.webp` : `${assetId}.webp`;
  const stageBucket = table ? "table-staged-assets" : "staged-assets";
  state.objects.push({ bucket: stageBucket, path: intent.staged_path, erase: person === state.author },
    { bucket, path, erase: person === state.author }); save();
  await upload(stageBucket, intent.staged_path, state.png);
  await rpc(admin, "register_media_object_attempt", {
    p_bucket_id: bucket, p_object_path: path, p_owner_id: person.profileId,
  });
  await upload(bucket, path, state.webp);
  await rpc(admin, table ? "finish_table_upload" : "finish_plate_upload", {
    p_intent_id: intent.intent_id, p_asset_id: assetId, p_object_path: path, p_width: 64, p_height: 64,
  });
  await rpc(admin, "finish_media_object_attempt", { p_bucket_id: bucket, p_object_path: path });
  return assetId;
}
async function prepare() {
  check(sql("select count(*) from private.account_erasure_jobs where state <> 'complete'") === "0",
    "Existing erasure jobs need separate review before preparing this isolated test");
  if (resumePreparation) {
    state = JSON.parse(readFileSync(privatePath, "utf8"));
    check(!state.started && !state.author && state.objects.length === 0,
      "Resume only the initial account-setup stage; review later partial fixtures manually");
  } else { state = { runId, objects: [], started: false, crashRecovery: prepareCrashRecovery }; save(); }
  state.author = await account("author", runId); save();
  state.peer = await account("peer", runId); save();
  // Solid colours are synthetic: no personal photo enters this test.
  state.png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#8dba78" } }).png().toBuffer();
  state.webp = await sharp(state.png).webp().toBuffer();
  state.soleGroup = await rpc(state.author.client, "create_group", { p_name: "Local erasure sole-owner Table" });
  state.sharedGroup = await rpc(state.author.client, "create_group", { p_name: "Local erasure continuing Table" }); save();
  sql(`begin;
    select id from public.profiles where id in (${id(state.author.profileId)},${id(state.peer.profileId)}) order by id for update;
    select id from public.groups where id in (${id(state.soleGroup)},${id(state.sharedGroup)}) order by id for update;
    insert into public.group_memberships(group_id,user_id,role,state) values
      (${id(state.soleGroup)},${id(state.peer.profileId)},'member','active'),
      (${id(state.sharedGroup)},${id(state.peer.profileId)},'owner','active');
    insert into public.membership_periods(group_id,user_id) values
      (${id(state.soleGroup)},${id(state.peer.profileId)}),(${id(state.sharedGroup)},${id(state.peer.profileId)});
    commit;`);
  const { data: category, error } = await state.author.client.from("categories").select("id").eq("slug", "meal").single();
  if (error) throw error;
  const authorAsset = await photo(state.author, "plate-media");
  state.plate = await rpc(state.author.client, "publish_plate", { p_category_id: category.id,
    p_body: "Local erasure author Plate", p_attachment_ids: [authorAsset] }); save();
  const tableAsset = await photo(state.author, "table-media", state.soleGroup);
  state.message = await rpc(state.author.client, "post_message", { p_group_id: state.soleGroup,
    p_client_request_id: crypto.randomUUID(), p_body: "Local erasure author message", p_attachment_ids: [tableAsset] });
  state.share = await rpc(state.author.client, "share_plate", { p_group_id: state.sharedGroup,
    p_plate_id: state.plate, p_client_request_id: crypto.randomUUID(), p_body: "Local erasure author share" });
  const { data: thread, error: threadError } = await state.peer.client.from("threads")
    .select("id").eq("root_entry_id", state.share).single();
  if (threadError) throw threadError;
  state.reply = await rpc(state.peer.client, "reply_to_thread", { p_thread_id: thread.id,
    p_client_request_id: crypto.randomUUID(), p_body: "Local erasure independent peer reply" });
  const job = await rpc(state.peer.client, "request_menu_preview", { p_plate_id: state.plate, p_expected_revision: 1 });
  const { error: jobError } = await admin.from("menu_preview_jobs").update({ state: "processing" }).eq("id", job);
  if (jobError) throw jobError;
  const previewId = crypto.randomUUID();
  const previewPath = `${state.peer.profileId}/${previewId}.webp`;
  state.objects.push({ bucket: "menu-previews", path: previewPath, erase: true }); save();
  await rpc(admin, "register_media_object_attempt", { p_bucket_id: "menu-previews",
    p_object_path: previewPath, p_owner_id: state.peer.profileId, p_source_plate_id: state.plate });
  await upload("menu-previews", previewPath, state.webp);
  await rpc(admin, "finish_menu_preview", { p_job_id: job, p_asset_id: previewId,
    p_object_path: previewPath, p_width: 64, p_height: 64 });
  await rpc(admin, "finish_media_object_attempt", { p_bucket_id: "menu-previews", p_object_path: previewPath });
  state.saveId = await rpc(state.peer.client, "save_plate", { p_plate_id: state.plate,
    p_expected_revision: 1, p_preview_asset_id: previewId });
  const peerAsset = await photo(state.peer, "plate-media");
  state.peerPlate = await rpc(state.peer.client, "publish_plate", { p_category_id: category.id,
    p_body: "Local erasure retained peer Plate", p_attachment_ids: [peerAsset] });
  const blockedRows = await rpc(state.author.client, "request_plate_upload");
  state.blockedIntent = blockedRows[0].intent_id;
  state.blockedAsset = crypto.randomUUID();
  const { error: blockedError } = await admin.from("media_upload_intents")
    .update({ state: "processing" }).eq("id", state.blockedIntent);
  if (blockedError) throw blockedError;
  state.blocker = `erasure-test-${runId}.webp`;
  state.objects.push({ bucket: "plate-media", path: state.blocker, erase: true },
    { bucket: "staged-assets", path: blockedRows[0].staged_path, erase: true }); save();
  await upload("staged-assets", blockedRows[0].staged_path, state.png);
  if (!state.crashRecovery) {
    await rpc(admin, "register_media_object_attempt", { p_bucket_id: "plate-media",
      p_object_path: state.blocker, p_owner_id: state.author.profileId });
    await upload("plate-media", state.blocker, state.webp);
  }
  for (const object of state.objects.filter((item) => !item.bucket.endsWith("staged-assets"))) {
    const client = object.bucket === "menu-previews" || !object.erase ? state.peer.client : state.author.client;
    if (object.path !== state.blocker) object.signedUrl = await signed(object.bucket, object.path, client);
  }
  // Image buffers are unnecessary for execution; keep the private state compact.
  state.png = undefined; state.webp = undefined; state.prepared = true; save();
  const directory = "supabase/tests/account-erasure-scopes";
  mkdirSync(directory, { recursive: true });
  const scopePath = `${directory}/${runId}.md`;
  const scope = `# Local account-erasure test scope\n\nRun: ${runId}\n\n`
    + `Erase only synthetic author Auth identity \`${state.author.authId}\` (\`${state.author.email}\`), unlink its private Auth link and blank profile \`${state.author.profileId}\`.\n\n`
    + `Blank its Plate \`${state.plate}\`, message \`${state.message}\`, share \`${state.share}\` and peer Menu copy \`${state.saveId}\`. Archive sole-owner Table \`${state.soleGroup}\`; transfer creator attribution and reset the name of continuing Table \`${state.sharedGroup}\`.\n\n`
    + `Retain peer Auth identity \`${state.peer.authId}\`, profile \`${state.peer.profileId}\`, Plate \`${state.peerPlate}\` and independent reply \`${state.reply}\`.\n\n`
    + `## Exact Storage removal targets\n\n${state.objects.filter((o) => o.erase).map((o) => `- \`${o.bucket}/${o.path}\``).join("\n")}\n\n`
    + `## Retained Storage objects\n\n${state.objects.filter((o) => !o.erase).map((o) => `- \`${o.bucket}/${o.path}\``).join("\n")}\n\n`
    + "Run a fresh worker in `--erasure-only` mode for this author with an exact object allowlist. The script starts and stops only that test worker. It refuses deletion for another profile or an object outside the list above. No existing account, other object, email message, file or database structural record is to be deleted.\n\n"
    + "Before accepting the request, append only this disposable author's keyed intent to the selected independent local log/checkpoint histories and mirror its receipt in the database. After verified cleanup, append and mirror its completion. These records remain for future restore matching; no history or key is reset or removed.\n\n"
    + "The processing-attempt test recreates bytes at the same listed `erasure-test` path after its early removal. That exact path is removed again before Auth completion; this adds no deletion target.\n\n"
    + "The erased synthetic identity and photos are not recoverable through this test. Anonymous structural rows remain. Private test session state stays in a restricted temporary file and is not included here.\n";
  writeFileSync(scopePath, scope, { flag: "wx" });
  if (state.crashRecovery) {
    writeFileSync(scopePath, "\n## Proposed crash-recovery drill — separate approval required\n\n"
      + "For this run, the blocker path listed above is reserved but not yet registered/uploaded. Execution starts only its isolated fixture writer, decodes the staged synthetic image, awaits decoder termination, registers the exact blocker attempt and uploads once without overwrite. The writer then pauses before finalisation.\n\n"
      + "Approve starting this writer and abruptly stopping only this harness-owned process with SIGKILL after its upload is acknowledged, its decoder stopped and initial cleanup checked. No pre-existing process is targeted. This is a crash between Storage acknowledgement and database finalisation, not a crash during an in-flight Storage/Auth call.\n\n"
      + "Approve starting/stopping/restarting only this author-restricted cleanup worker, finishing the single abandoned attempt through the scoped recovery tool, and repeating removal of the already listed exact blocker path. The generic late-upload replay described above is replaced by writer-stop verification and scoped recovery; no bytes are recreated after writer shutdown.\n\n"
      + `Recovery scope: profile \`${state.author.profileId}\`, bucket \`plate-media\`, path \`${state.blocker}\`. Recovery can unblock the same author's Auth deletion. The author/content/Table/seven-object erasure scope and retained peer above also require approval for this fresh run. No browser/preview restart is involved.\n`, { flag: "a" });
  }
  console.log(`PREPARED ${scopePath}`);
  console.log(`Prepared ${state.objects.filter((o) => o.erase).length} exact object removals; no erasure has run.`);
}
async function execute() {
  state = JSON.parse(readFileSync(privatePath, "utf8"));
  check(state.runId === runId && state.prepared && !state.completed, "Prepared unfinished fixture state is required");
  check(Boolean(state.crashRecovery) === crashRecoveryApproved,
    "Crash fixtures require --crash-recovery-approved; other modes cannot execute them");
  if (crashRecoveryApproved) await startCrashWriter();
  const jobs = await rpc(admin, "erasure_worker_jobs");
  check(jobs.every((job) => job.profile_id === state.author.profileId),
    "Another job exists; do not run scoped erasure");
  check(!state.started || jobs.some((job) => job.profile_id === state.author.profileId && job.state === "cleaning"),
    "Resume only this approved account's unfinished cleaning stage");
  const author = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const peer = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const [client, person] of [[author, state.author], [peer, state.peer]]) {
    const { error } = await client.auth.setSession(person.session); if (error) throw error;
  }
  if (!state.started) {
    if (browserApproved) {
      console.log("READY: waiting up to ten minutes for the approved author's browser confirmation");
      let accepted = false;
      for (let i = 0; i < 600; i++) {
        const current = await rpc(admin, "erasure_worker_jobs");
        check(current.every((job) => job.profile_id === state.author.profileId),
          "Another job appeared while waiting for browser confirmation");
        if (current.some((job) => job.profile_id === state.author.profileId && job.state === "cleaning")) {
          accepted = true; break;
        }
        await sleep(1000);
      }
      check(accepted, "No browser erasure request was observed; no test worker was started");
    } else {
      const {data:{user},error:identityError}=await author.auth.getUser();
      check(!identityError && user?.id===state.author.authId,"Verified fixture identity required");
      await requestRecordedErasure({authId:user.id,store:await openLocalErasureStore(),
        rpc:(name,args)=>rpc(admin,name,args)});
    }
    state.started = true; save();
  }
  const recordStore = await openLocalErasureStore();
  const recordReceipt = await verifyWorkerIntent({store:recordStore,
    rpc:(name,args)=>rpc(admin,name,args),profileId:state.author.profileId});
  console.log("PASS: accepted database receipt matches the verified independent durable intent");
  const { data: inaccessible, error: accessError } = await author.from("plates").select("id");
  check(accessError || inaccessible.length === 0, "Old session still reads Plates after cutoff");
  const { error: writeError } = await author.rpc("create_group", { p_name: "Must be denied" });
  check(writeError, "Old session still writes after cutoff");
  const { error: completionError } = await admin.rpc("finish_plate_upload", {
    p_intent_id: state.blockedIntent, p_asset_id: state.blockedAsset,
    p_object_path: state.blocker, p_width: 64, p_height: 64,
  });
  check(completionError, "Upload completed after its owner was disabled");
  const { data: archived, error: groupError } = await peer.from("groups").select("id").eq("id", state.soleGroup);
  check(!groupError && archived.length === 0, "Peer still reads archived sole-owner Table");
  const { data: reply, error: replyError } = await peer.from("thread_replies").select("body").eq("id", state.reply).single();
  check(!replyError && reply.body === "Local erasure independent peer reply", "Independent peer reply was lost");
  const expectedObjects = state.objects.filter((object) => object.erase);
  const queued = JSON.parse(sql(`select coalesce(json_agg(json_build_object('bucket',bucket_id,'path',object_path)), '[]')
    from private.account_erasure_objects where profile_id=${id(state.author.profileId)}`));
  check(JSON.stringify(queued.map((o) => `${o.bucket}/${o.path}`).sort())
    === JSON.stringify(expectedObjects.map((o) => `${o.bucket}/${o.path}`).sort()),
  "Cleanup queue differs from the approved exact object list; worker will not start");
  const allowlistPath = `/private/tmp/plates-erasure-${runId}-objects.json`;
  const allowlist = JSON.stringify(expectedObjects.map(({ bucket, path }) => ({ bucket, path })));
  if (existsSync(allowlistPath)) check(readFileSync(allowlistPath, "utf8") === allowlist,
    "Existing object allowlist does not match the approved fixture state");
  else writeFileSync(allowlistPath, allowlist, { flag: "wx", mode: 0o600 });
  console.log("PASS: real HTTP old-session access cutoff, sole-owner archive and continuing peer reply");
  let workerFailed = false;
  function startWorker() {
    workerFailed = false;
    const child = spawn(process.execPath, ["--env-file=.env.local", "scripts/local-media-worker.mjs",
      "--erasure-only", state.author.profileId, "--object-allowlist", allowlistPath],
    { stdio: ["ignore", "ignore", "pipe"] });
    child.on("error", () => { workerFailed = true; });
    child.on("exit", () => { workerFailed = true; });
    child.stderr.on("data", () => {}); // Diagnostics may contain paths; report only the failing stage.
    return child;
  }
  async function stopWorker(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise((resolve) => { child.once("exit", resolve); child.kill("SIGTERM"); });
  }
  let worker = startWorker();
  try {
    // Keep the registered attempt processing beyond the reconciliation wait.
    const currentJobs = await rpc(admin, "erasure_worker_jobs");
    const startedAt = currentJobs.find((job) => job.profile_id === state.author.profileId)?.started_at;
    check(startedAt, "Approved job is missing");
    const guardDeadline = Date.now() + Math.max(10_000, 130_000 - (Date.now() - Date.parse(startedAt)));
    while (Date.now() < guardDeadline) {
      await sleep(Math.min(5000, guardDeadline - Date.now()));
      check(!workerFailed, "Scoped test worker stopped during the unfinished-upload guard check");
    }
    check(!workerFailed, "Scoped test worker stopped before assertions");
    const jobState = sql(`select state from private.account_erasure_jobs where profile_id=${id(state.author.profileId)}`);
    check(jobState === "cleaning", "Identity advanced while an upload attempt was still processing");
    const { error: identityError } = await admin.auth.admin.getUserById(state.author.authId);
    check(!identityError, "Auth identity disappeared before the processing attempt settled");
    console.log("PASS: worker keeps Auth identity pending while an upload attempt is in progress");
    const earlyExists = await storageObjectExists(admin.storage.from("plate-media"), state.blocker);
    check(!earlyExists, "Worker has not performed the early path removal");
    await stopWorker(worker);
    check(sql(`select state from private.account_erasure_jobs where profile_id=${id(state.author.profileId)}`)
      === "cleaning", "Stopping the worker incorrectly completed the job");
    if (crashRecoveryApproved) {
      check(crashWriter && crashWriter.exitCode === null && crashWriter.signalCode === null,
        "Expected isolated fixture writer to still be paused before the crash");
      await stopCrashWriter();
      state.writerStopped = true; save();
      check(sql(`select state from private.media_object_attempts where bucket_id='plate-media'
        and object_path='${state.blocker}'`) === "processing", "Abrupt writer exit did not leave the expected unfinished attempt");
      console.log("PASS: SIGKILL exit observed for the exact fixture writer; its attempt remains unfinished");
    }
    worker = startWorker();
    await sleep(5000);
    check(!workerFailed, "Restarted scoped worker stopped before recovery assertions");
    check(sql(`select state from private.account_erasure_jobs where profile_id=${id(state.author.profileId)}`)
      === "cleaning", "Restart bypassed the unfinished upload guard");
    console.log("PASS: isolated worker restart resumes cleanup without bypassing an unfinished upload");
    // Recreate the same approved target to model an upload finishing after that removal.
    if (crashRecoveryApproved) {
      await stopWorker(worker);
      check(state.writerStopped && crashWriter === null, "Writer-stop proof missing; recovery refused");
      const recoveryPath = `/private/tmp/plates-erasure-${runId}-recovery.json`;
      const recoveryScope = JSON.stringify({ profileId: state.author.profileId,
        bucket: "plate-media", objectPath: state.blocker });
      if (existsSync(recoveryPath)) check(readFileSync(recoveryPath, "utf8") === recoveryScope,
        "Recovery file differs from the approved target");
      else writeFileSync(recoveryPath, recoveryScope, { mode: 0o600, flag: "wx" });
      const recovered = JSON.parse(execFileSync(process.execPath, ["scripts/recover-abandoned-upload.mjs",
        recoveryPath, "--apply", "--scope-approved", "--writer-stopped"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
      check(recovered.recovered && recovered.cleanupRequired, "Scoped recovery did not succeed");
      check(sql(`select state from private.account_erasure_objects where profile_id=${id(state.author.profileId)}
        and bucket_id='plate-media' and object_path='${state.blocker}'`) === "pending",
      "Recovery did not requeue the exact blocker");
      console.log("PASS: scoped recovery requeued the abandoned path; final cleanup still required");
      worker = startWorker();
    } else {
      const lateBytes = await sharp({ create: { width: 64, height: 64, channels: 3,
        background: "#a5c77b" } }).webp().toBuffer();
      await upload("plate-media", state.blocker, lateBytes);
      await rpc(admin, "finish_media_object_attempt", { p_bucket_id: "plate-media", p_object_path: state.blocker });
    }
    let complete = false;
    for (let i = 0; i < 60; i++) {
      if (sql(`select state from private.account_erasure_jobs where profile_id=${id(state.author.profileId)}`) === "complete") {
        complete = true; break;
      }
      await sleep(1000);
    }
    check(complete, "Worker did not finish Storage/Auth cleanup");
    const completedReceipt = await verifyWorkerIntent({store:recordStore,
      rpc:(name,args)=>rpc(admin,name,args),profileId:state.author.profileId});
    const records = (await recordStore.load()).records;
    const completion = records.find(record=>record.event==="complete"
      && record.operationId===recordReceipt.operation_id);
    check(completion && completedReceipt.completion
      && Object.keys(completion).every(key=>completion[key]===completedReceipt.completion[key]),
    "Database completion does not match the independent durable completion");
    check(sql(`select completed_at is not null and auth_user_id is null
      from private.account_erasure_records where profile_id=${id(state.author.profileId)}`)==="t",
    "Completed mirror still holds the raw Auth identity");
    console.log("PASS: durable completion matches the database mirror; raw Auth identity cleared");
    for (const object of state.objects) {
      const exists = await storageObjectExists(admin.storage.from(object.bucket), object.path);
      check(exists === !object.erase, "Storage removal/preservation did not match approved scope");
      if (object.signedUrl) {
        const response = await fetch(object.signedUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        check(response.ok === !object.erase, "Previously issued signed URL had unexpected access after cleanup");
      }
    }
    const { error: deletedIdentity } = await admin.auth.admin.getUserById(state.author.authId);
    check(deletedIdentity?.status === 404, "Erased Auth identity still exists or check failed unexpectedly");
    const { error: retainedIdentity } = await admin.auth.admin.getUserById(state.peer.authId);
    check(!retainedIdentity, "Peer Auth identity was affected");
    const { error: refreshError } = await author.auth.refreshSession({ refresh_token: state.author.session.refresh_token });
    check(refreshError, "Deleted account refreshed its old session");
    const { data: retained, error: retainedError } = await peer.from("plates").select("body").eq("id", state.peerPlate).single();
    check(!retainedError && retained.body === "Local erasure retained peer Plate", "Peer Plate was affected");
    const blank = sql(`select snapshot_body='' and snapshot_author_name='' and preview_asset_id is null
      from public.menu_plate_saves where id=${id(state.saveId)}`);
    check(blank === "t", "Copied Menu content was not blanked");
    state.completed = true; save();
    console.log("PASS: exact Storage cleanup, old signed URL denial, Auth removal, refresh denial and retained peer content");
  } finally {
    await stopWorker(worker);
  }
}
try {
  if (process.argv[2] === "--erase-approved" || browserApproved || crashRecoveryApproved) await execute();
  else { check(!process.argv[2] || resumePreparation || prepareCrashRecovery,
    "Use no arguments to prepare, --resume-preparation RUN_ID for initial account setup, or --erase-approved/--browser-approved RUN_ID after owner approval"); await prepare(); }
} catch (error) {
  console.error(`FAIL (${runId}): ${error?.message || "Local erasure test failed"}`);
  process.exitCode = 1;
} finally {
  if (crashWriter) {
    try { await stopCrashWriter(); }
    catch { console.error("Fixture writer shutdown was not verified; do not run recovery."); process.exitCode = 1; }
  }
}
