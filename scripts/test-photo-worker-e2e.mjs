import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, open } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { photoWorkerConfig } from "./photo-worker-config.mjs";
import { createPhotoBackend } from "./photo-worker-backend.mjs";
import { createPhotoWorker, digest } from "./photo-worker-runtime.mjs";
import { createScopedPhotoBackend, validateE2ePlan, validateE2eResume } from "./photo-worker-e2e-scope.mjs";

// Execute only after separate approval of local schema activation and retained fixtures.
// No activation, removal, Auth API or global worker polling occurs in this driver.
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const literal = value => { if (!uuid(value)) throw new Error("Invalid fixture identifier"); return `'${value}'::uuid`; };
function sqlResult(body) {
  const output = execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",
    ["exec", "-i", "supabase_db_plates", "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-f", "-"],
    { input: `begin;\nset local statement_timeout='30s';\nset local lock_timeout='3s';\n${body}\ncommit;`, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 45_000 });
  const line = output.split("\n").find(value => value.startsWith("E2E_RESULT:"));
  if (!line) throw new Error("Fixture result missing");
  return JSON.parse(line.slice("E2E_RESULT:".length));
}
function createFixtures(plan) {
  const auth = literal(plan.authUserId), first = literal(plan.plateUploadId), bad = literal(plan.invalidUploadId), table = literal(plan.tableUploadId);
  return sqlResult(`
create temporary table e2e_result(owner_id uuid,group_id uuid) on commit drop;
do $$ declare owner_key uuid; group_key uuid; admission boolean; begin
  if (select active_run from private.photo_worker_control where singleton) is not null
    or exists(select 1 from private.photo_worker_journal where phase not in ('complete','rejected'))
    or exists(select 1 from public.media_upload_intents where state='processing')
    or exists(select 1 from public.table_upload_intents where state='processing')
    or exists(select 1 from public.menu_preview_jobs where state='processing') then
    raise exception 'Existing worker or unfinished jobs; fixture creation refused'; end if;
  select enabled into admission from private.app_admission_settings where singleton for update;
  update private.app_admission_settings set enabled=false where singleton;
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
    values(${auth},'photo-e2e-'||${auth}::text||'@example.test',clock_timestamp(),'{"display_name":"Photo worker E2E fixture"}');
  select profile_id into owner_key from private.profile_auth_links where auth_user_id=${auth};
  if owner_key is null then raise exception 'Fixture profile missing'; end if;
  insert into private.profile_usernames(profile_id,username) values(owner_key,'Photo'||left(replace(owner_key::text,'-',''),20));
  update private.app_admission_settings set enabled=admission where singleton;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',${auth}::text,true);
  group_key:=public.create_table_with_members('Photo worker E2E fixture','{}'::uuid[]);
  insert into public.media_upload_intents(id,uploader_id,staged_path)
    select id,owner_key,owner_key::text||'/'||id::text from unnest(array[${first},${bad}]) id;
  insert into public.table_upload_intents(id,uploader_id,group_id,staged_path)
    values(${table},owner_key,group_key,owner_key::text||'/'||${table}::text);
  insert into e2e_result values(owner_key,group_key);
end $$;
select 'E2E_RESULT:'||json_build_object('ownerId',owner_id,'groupId',group_id)::text from e2e_result;`);
}
function publishFixture(plan, fixture, assetId) {
  return sqlResult(`
create temporary table e2e_result(plate_id uuid) on commit drop;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',${literal(plan.authUserId)}::text,true);
insert into e2e_result select public.publish_plate((select id from public.categories where slug='meal'),
  'Photo worker E2E fixture','[]','[]',array[${literal(assetId)}]);
insert into public.menu_preview_jobs(id,saver_id,plate_id,source_asset_id,source_revision)
  select ${literal(plan.previewJobId)},${literal(fixture.ownerId)},plate_id,${literal(assetId)},1 from e2e_result;
select 'E2E_RESULT:'||json_build_object('plateId',plate_id)::text from e2e_result;`);
}
function saveFixture(plan, plateId, previewAssetId) {
  return sqlResult(`
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',${literal(plan.authUserId)}::text,true);
create temporary table e2e_saved(id uuid) on commit drop;
insert into e2e_saved select public.save_plate(${literal(plateId)},1,null,${literal(previewAssetId)});
select 'E2E_RESULT:'||json_build_object('saveId',s.id,'ownerId',s.saver_id,'plateId',s.plate_id,'previewAssetId',s.preview_asset_id)::text
  from e2e_saved saved join public.menu_plate_saves s on s.id=saved.id;`);
}

function resumeFixtures(plan, fixture) {
  const owner = literal(fixture.ownerId), group = literal(fixture.groupId);
  const first = literal(plan.plateUploadId), bad = literal(plan.invalidUploadId), table = literal(plan.tableUploadId);
  return sqlResult(`
set transaction read only;
do $$ begin
  if (select active_run from private.photo_worker_control where singleton) is not null
    or exists(select 1 from private.photo_worker_journal where phase not in ('complete','rejected'))
    or exists(select 1 from public.media_upload_intents where state='processing')
    or exists(select 1 from public.table_upload_intents where state='processing')
    or exists(select 1 from public.menu_preview_jobs where state='processing') then raise exception 'Active work; resume refused'; end if;
  if not exists(select 1 from private.profile_auth_links l join public.profiles p on p.id=l.profile_id
      where l.auth_user_id=${literal(plan.authUserId)} and p.id=${owner} and p.state='active')
    or not exists(select 1 from public.groups g join public.group_memberships m on m.group_id=g.id
      where g.id=${group} and g.created_by=${owner} and g.availability='available' and m.user_id=${owner} and m.state='active') then
    raise exception 'Fixture identity changed'; end if;
  if (select count(*) from public.media_upload_intents where id in (${first},${bad}) and uploader_id=${owner}
      and staged_path=${owner}::text||'/'||id::text and state='pending' and asset_id is null)<>2
    or (select count(*) from public.table_upload_intents where id=${table} and uploader_id=${owner} and group_id=${group}
      and staged_path=${owner}::text||'/'||id::text and state='pending' and asset_id is null)<>1
    or exists(select 1 from public.menu_preview_jobs where id=${literal(plan.previewJobId)})
    or exists(select 1 from public.media_assets where source_intent_id in (${first},${bad}))
    or exists(select 1 from public.table_media_assets where source_intent_id=${table})
    or exists(select 1 from private.photo_worker_journal where job_id in (${first},${bad},${table},${literal(plan.previewJobId)}))
    or exists(select 1 from storage.objects where bucket_id in ('staged-assets','table-staged-assets')
      and name in (${owner}::text||'/'||${first}::text,${owner}::text||'/'||${bad}::text,${owner}::text||'/'||${table}::text)) then
    raise exception 'Fixture processing or source metadata changed'; end if;
end $$;
select 'E2E_RESULT:'||json_build_object('ownerId',${owner},'groupId',${group})::text;`);
}

async function main() {
  const args = process.argv.slice(2);
  const resume = args.length === 5 && args[4] === "--resume-approved-fixtures";
  if ((!resume && args.length !== 4) || args[0] !== "--execute" || args[1] !== "--original-worker-stopped" || args[2] !== "--expected-origin") {
    throw new Error("Explicit execute/stopped/origin arguments required");
  }
  const plan = validateE2ePlan(JSON.parse(await readFile("PHOTO_WORKER_E2E_PLAN.json", "utf8")));
  const previous = resume ? validateE2eResume(plan, (await readFile("PHOTO_WORKER_E2E_RESULTS.ndjson", "utf8"))
    .trim().split("\n").map(line => JSON.parse(line))) : null;
  // Local key is captured in memory only. No app .env reading, key logging or output file.
  const status = JSON.parse(execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000 }));
  const config = photoWorkerConfig({ PHOTO_WORKER_ENABLED: "true", PHOTO_WORKER_ENVIRONMENT: "local",
    PHOTO_WORKER_SUPABASE_URL: status.API_URL, PHOTO_WORKER_SERVICE_KEY: status.SERVICE_ROLE_KEY,
    PHOTO_WORKER_EXPECTED_ORIGIN: args[3] });
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options = {}) => fetch(url, { ...options,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) }) } });
  const ready = await client.rpc("photo_worker_ready");
  if (ready.error || ready.data !== 1) throw new Error("Approved candidate activation required first");
  const runId = randomUUID();
  const report = await open("PHOTO_WORKER_E2E_RESULTS.ndjson", resume ? "a" : "wx", 0o600);
  const record = data => report.write(`${JSON.stringify({ at: new Date().toISOString(), ...data })}\n`);
  let backend = null, failure = null, stage = "fixture_creation";
  try {
    await record({ event: resume ? "resume_started" : "started", plan, runId });
    const fixture = resume ? resumeFixtures(plan, previous) : createFixtures(plan);
    assert(uuid(fixture.ownerId) && uuid(fixture.groupId));
    await record({ event: resume ? "fixtures_revalidated" : "fixtures_created", ...fixture });
    stage = "backend_check";
    const upload = await client.from("media_upload_intents").select("id,uploader_id,staged_path,state").eq("id", plan.plateUploadId).single();
    if (upload.error || upload.data?.state !== "pending" || upload.data?.uploader_id !== fixture.ownerId
      || upload.data?.staged_path !== `${fixture.ownerId}/${plan.plateUploadId}`) {
      throw new Error("API backend does not contain the created fixture");
    }
    stage = "ownership_open";
    const opened = await client.rpc("photo_worker_open", { p_run_id: runId });
    if (opened.error) throw new Error("Worker ownership unavailable");
    backend = createPhotoBackend(client, runId);
    stage = "source_upload";
    const inputs = [
      { id: plan.plateUploadId, kind: "plate", bytes: await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#a94732" } }).jpeg().toBuffer(), type: "image/jpeg" },
      { id: plan.invalidUploadId, kind: "plate", bytes: Buffer.from("synthetic malformed image"), type: "image/jpeg" },
      { id: plan.tableUploadId, kind: "table", bytes: await sharp({ create: { width: 1200, height: 2400, channels: 3, background: "#3267a9" } }).png().toBuffer(), type: "image/png" },
    ];
    for (const input of inputs) {
      const { error } = await client.storage.from(input.kind === "table" ? "table-staged-assets" : "staged-assets")
        .upload(`${fixture.ownerId}/${input.id}`, input.bytes, { contentType: input.type, upsert: false });
      if (error) throw new Error("Fixture source upload uncertain; preserve for review");
    }
    await record({ event: "sources_uploaded", count: inputs.length });
    stage = "upload_processing";
    const readJobs = async specs => Promise.all(specs.map(async spec => {
      const table = spec.kind === "plate" ? "media_upload_intents" : spec.kind === "table" ? "table_upload_intents" : "menu_preview_jobs";
      const { data, error } = await client.from(table).select("*").eq("id", spec.id).single();
      if (error || !data) throw new Error("Fixture job unavailable");
      return { kind: spec.kind, id: spec.id, data };
    }));
    const scope = createScopedPhotoBackend({ backend, readJobs, expected: inputs.map(input => ({
      kind: input.kind, id: input.id, ownerId: fixture.ownerId, groupId: fixture.groupId,
    })) });
    const events = [];
    const worker = createPhotoWorker({ backend: scope, emit: event => events.push(event) });
    const result = await worker.tick();
    await record({ event: "upload_stage", ...result, events });
    assert.equal(result.stopped, false); assert.equal(result.totals.completed, 2); assert.equal(result.totals.rejected, 1);
    assert.equal((await scope.poll()).jobs.length, 0);
    const plateEntry = scope.entries.get(`plate:${plan.plateUploadId}`);
    const tableEntry = scope.entries.get(`table:${plan.tableUploadId}`);
    for (const [entry, expectedWidth, expectedHeight] of [[plateEntry, 2048, 1024], [tableEntry, 1024, 2048]]) {
      const bytes = await scope.output(entry);
      assert.equal(digest(bytes), entry.sha256);
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, "webp"); assert.equal(metadata.width, expectedWidth); assert.equal(metadata.height, expectedHeight);
    }
    stage = "plate_publication";
    const { plateId } = publishFixture(plan, fixture, plateEntry.asset_id);
    assert(uuid(plateId));
    await record({ event: "plate_published", plateId });
    stage = "preview_processing";
    const previewScope = createScopedPhotoBackend({ backend, readJobs, expected: [{ kind: "preview", id: plan.previewJobId,
      ownerId: fixture.ownerId, plateId, sourceAssetId: plateEntry.asset_id }] });
    const previewResult = await createPhotoWorker({ backend: previewScope }).tick();
    assert.equal(previewResult.stopped, false); assert.equal(previewResult.totals.completed, 1);
    assert.equal((await previewScope.poll()).jobs.length, 0);
    const previewEntry = previewScope.entries.get(`preview:${plan.previewJobId}`);
    const previewBytes = await previewScope.output(previewEntry);
    assert.equal(digest(previewBytes), previewEntry.sha256);
    const previewMetadata = await sharp(previewBytes).metadata();
    assert.equal(previewMetadata.format, "webp"); assert.equal(previewMetadata.width, 640); assert.equal(previewMetadata.height, 320);
    stage = "menu_save";
    const saved = saveFixture(plan, plateId, previewEntry.asset_id);
    const { saveId } = saved;
    assert(uuid(saveId));
    assert.equal(saved.previewAssetId, previewEntry.asset_id);
    assert.equal(saved.ownerId, fixture.ownerId); assert.equal(saved.plateId, plateId);
    await record({ event: "pipeline_verified", saveId, plateId, outputs: [plateEntry, tableEntry, previewEntry],
      rssBytes: process.memoryUsage().rss, note: "Service-role Storage roundtrip and DB linkage; browser/HEIC/host capacity not verified" });
  } catch (error) {
    failure = error;
    await record({ event: "failed", stage, note: "Retain all fixtures and objects; inspect scoped job state before any retry" });
  } finally {
    if (backend) {
      try {
        const drained = await backend.close();
        await record({ event: "ownership_close", drained: drained === true });
        if (drained !== true) failure ??= new Error("Unfinished ownership retained");
      } catch { failure ??= new Error("Ownership close uncertain"); }
    }
    await report.close();
  }
  if (failure) throw failure;
  console.log("PASS photo worker E2E: fixture Storage roundtrip/DB linkage; all accounts, records and objects retained");
}
try { await main(); } catch {
  console.error("Photo worker E2E refused/failed. No automatic retry or cleanup; inspect retained report and approved fixture state.");
  process.exitCode = 1;
}
