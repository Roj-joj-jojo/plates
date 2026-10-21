// Two-phase disposable drill in fixed isolated copies. Never targets Plates services.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { resolve } from "node:path";
import sharp from "sharp";
import { createBundle, createKey, readEntry, readManifest, readPrivateFile } from "./encrypted-backup.mjs";
import { LocalDeletionRecords } from "./local-deletion-records.mjs";
import { SimulatedRestoreGate } from "./deletion-index-prototype.mjs";
import { IsolatedReplayRuntime, check, dump, run } from "./isolated-replay-runtime.mjs";

const project = resolve(import.meta.dirname, "..");
const namespace = "plates/isolated-restore/erasure-policy-20261010";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
let stage = "arguments", runtime;
async function save(root, state) { await writeFile(resolve(root, "state.json"), JSON.stringify(state), { mode: 0o600 }); }
async function store(root) {
  return new LocalDeletionRecords({ recordsFolder: resolve(root, "records"), checkpointsFolder: resolve(root, "checkpoints"),
    namespace, keys: new Map([["v1", await readPrivateFile(resolve(root, "keys/index.key"), 32)]]) });
}
function baseline() {
  return runtime.sql(`select json_build_object('profiles',(select count(*) from public.profiles),'plates',(select count(*) from public.plates),
    'authUsers',(select count(*) from auth.users),'erasureJobs',(select count(*) from private.account_erasure_jobs),
    'storageObjects',(select count(*) from storage.objects));`);
}
try {
  const [mode, suppliedRoot, ...extra] = process.argv.slice(2);
  check(extra.length === 0 && ((mode === "--prepare" && !suppliedRoot) || (mode === "--apply-approved" && suppliedRoot)));
  if (mode === "--prepare") {
    stage = "isolated fixture preparation";
    const root = await mkdtemp("/private/tmp/plates-replay-drill-");
    for (const folder of ["records", "checkpoints", "keys", "snapshots"]) await mkdir(resolve(root, folder), { mode: 0o700 });
    await createKey(resolve(root, "keys/index.key")); await createKey(resolve(root, "keys/backup.key"));
    const log = await store(root); await log.initialise();
    const state = { root, operationId: randomUUID(), authorAuth: randomUUID(), peerAuth: randomUUID(),
      authorPath: `restore-replay/${randomUUID()}.webp`, copyPath: `restore-replay/${randomUUID()}.webp`,
      peerPath: `restore-replay/${randomUUID()}.webp`, prepared: false, started: false, complete: false };
    await save(root, state);
    runtime = new IsolatedReplayRuntime("42a10f01"); await runtime.start(true);
    state.originalCounts = JSON.parse(baseline());
    check(state.originalCounts.storageObjects === 32);
    runtime.sql(`begin; insert into auth.users(id, raw_user_meta_data) values
      ('${state.authorAuth}', '{"display_name":"Isolated restore replay author"}'),
      ('${state.peerAuth}', '{"display_name":"Isolated restore replay peer"}'); commit;`);
    state.authorProfile = runtime.sql(`select profile_id from private.profile_auth_links where auth_user_id='${state.authorAuth}';`);
    state.peerProfile = runtime.sql(`select profile_id from private.profile_auth_links where auth_user_id='${state.peerAuth}';`);
    for (const id of [state.authorProfile, state.peerProfile]) check(/^[0-9a-f-]{36}$/.test(id));
    state.plate = runtime.claims("authenticated", state.authorAuth,
      "select public.publish_plate((select id from public.categories where slug='meal'),'Isolated restore replay Plate');");
    check(/^[0-9a-f-]{36}$/.test(state.plate));
    runtime.claims("authenticated", state.peerAuth, `select public.save_plate('${state.plate}',1);`);
    const blue = await sharp({ create: { width: 16, height: 16, channels: 3, background: "blue" } }).webp().toBuffer();
    const red = await sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } }).webp().toBuffer();
    state.peerHash = hash(red);
    const targets = [{ bucket: "plate-media", path: state.authorPath, owner: state.authorProfile, source: state.plate, bytes: blue },
      { bucket: "menu-previews", path: state.copyPath, owner: state.peerProfile, source: state.plate, bytes: blue },
      { bucket: "plate-media", path: state.peerPath, owner: state.peerProfile, source: null, bytes: red }];
    for (const item of targets) {
      runtime.claims("service_role", null, `select public.register_media_object_attempt('${item.bucket}',${literal(item.path)},
        '${item.owner}',${item.source ? `'${item.source}'::uuid` : "null"});`);
      runtime.upload(item.bucket, item.path, item.bytes);
      runtime.claims("service_role", null, `select public.finish_media_object_attempt('${item.bucket}',${literal(item.path)});`);
    }
    stage = "pre-intent isolated backup";
    const inventory = JSON.parse(runtime.sql("select json_agg(json_build_object('bucket',bucket_id,'path',name,'mime',metadata->>'mimetype') order by bucket_id,name) from storage.objects;"));
    const metadata = { databaseCounts: JSON.parse(baseline()), scope: "isolated-replay-synthetic-additions", namespace };
    const source = runtime;
    async function* entries() {
      yield { kind: "postgres-custom", data: dump(source.db) };
      yield { kind: "postgres-roles", data: dump(source.db, true) };
      for (const item of inventory) yield { kind: "storage-object", ...item, data: source.download(item.bucket, item.path) };
    }
    state.backup = await createBundle(resolve(root, "snapshots"), await readPrivateFile(resolve(root, "keys/backup.key"), 32), entries(), metadata);
    stage = "independent later intent acknowledgement";
    await log.intent({ operationId: state.operationId, profileId: state.authorProfile, authId: state.authorAuth, keyVersion: "v1" });
    state.prepared = true; await save(root, state);
    const scope = `# Exact isolated restore-replay scope\n\nPrepared 2026-10-10.\n\n` +
      `Command from the project folder:\n\n\`node scripts/local-restore-replay-drill.mjs --apply-approved '${root}'\`\n\n` +
      `Create/start/stop only plates_restore_check_42a10f02 and plates_storage_restore_42a10f02 from installed images, network isolated with no host ports. ` +
      `Restore the private pre-intent database/photo snapshot \`${state.backup}\` (35 exact objects) into these new copies. ` +
      `Read only this drill's independent records/checkpoints/key.\n\n` +
      `Replay the recorded intent for synthetic profile \`${state.authorProfile}\` and Auth \`${state.authorAuth}\`: ` +
      `blank Plate \`${state.plate}\`, its peer Menu copy, profile name and affected attribution; unlink the author, ` +
      `delete only that Auth row in the new scratch database and remove only these two new-copy objects:\n\n` +
      `- plate-media / ${state.authorPath}\n- menu-previews / ${state.copyPath}\n\n` +
      `Preserve peer profile \`${state.peerProfile}\`, Auth \`${state.peerAuth}\`, plate-media / ${state.peerPath}, ` +
      `and all 32 original backed-up photo paths. No original Plates database/Storage/account is targeted. ` +
      `Stop both scratch containers and retain all files/copies. General erasure remains disabled; no public access is opened.\n`;
    await writeFile(resolve(root, "scope.md"), scope, { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ prepared: true, privateScope: resolve(root, "scope.md"), fixtureRoot: root,
      recordedIntents: 1, erasureExecuted: false }, null, 2));
  } else {
    check(/^\/private\/tmp\/plates-replay-drill-[A-Za-z0-9]+$/.test(suppliedRoot));
    const root = suppliedRoot;
    const state = JSON.parse((await readPrivateFile(resolve(root, "state.json"), 16384)).toString());
    check(state.root === root && state.prepared && !state.started && !state.complete);
    const log = await store(root); const acknowledged = await log.load(); check(acknowledged.records.length === 1);
    stage = "new pre-intent database restore";
    state.started = true; await save(root, state);
    run([resolve(project, "scripts/local-backup-restore-check.mjs"), state.backup, resolve(root, "keys/backup.key"),
      "plates_restore_check_42a10f02", "--approved-new-container"], undefined, process.execPath);
    runtime = new IsolatedReplayRuntime("42a10f02"); await runtime.start(false);
    stage = "new pre-intent photo restore";
    const key = await readPrivateFile(resolve(root, "keys/backup.key"), 32);
    const bundle = await readManifest(state.backup, key);
    const photos = bundle.manifest.entries.filter((entry) => entry.description.kind === "storage-object");
    check(photos.length === 35);
    for (const entry of photos) runtime.upload(entry.description.bucket, entry.description.path,
      await readEntry(bundle.directory, bundle.manifest, entry, key), entry.description.mime || "application/octet-stream", true);
    stage = "durable-intent match and real isolated replay";
    const inventory = JSON.parse(runtime.sql(`select json_agg(json_build_object('profileId',p.id,'authId',l.auth_user_id))
      from public.profiles p left join private.profile_auth_links l on l.profile_id=p.id;`));
    const authIds = JSON.parse(runtime.sql("select json_agg(id) from auth.users;"));
    const gate = new SimulatedRestoreGate(namespace, log.keys);
    await gate.sweep({ records: acknowledged.records, checkpoint: acknowledged.checkpoint,
      restoredProfiles: inventory, restoredAuthIds: authIds, apply: async (plan) => {
        check(JSON.stringify(plan) === JSON.stringify({ profiles: [state.authorProfile], authIds: [state.authorAuth] }));
        check(runtime.claims("authenticated", state.authorAuth, "select public.begin_account_erasure();") === state.authorProfile);
        const queue = JSON.parse(runtime.sql(`select json_agg(json_build_object('bucket',bucket_id,'path',object_path) order by bucket_id,object_path)
          from private.account_erasure_objects where profile_id='${state.authorProfile}';`));
        const exact = [{ bucket: "menu-previews", path: state.copyPath }, { bucket: "plate-media", path: state.authorPath }];
        check(JSON.stringify(queue) === JSON.stringify(exact));
        for (const item of exact) {
          runtime.sql(`update private.account_erasure_objects set state='processing', attempts=attempts+1
            where profile_id='${state.authorProfile}' and bucket_id=${literal(item.bucket)} and object_path=${literal(item.path)} and state='pending';`);
          check(runtime.request({ method: "DELETE", path: "/object/" + item.bucket,
            headers: runtime.headers({ "Content-Type": "application/json" }), json: { prefixes: [item.path] } }).status === 200);
          check(runtime.request({ path: runtime.route(item.bucket, item.path), headers: runtime.headers() }).status >= 400);
          runtime.claims("service_role", null, `select public.erasure_object_result('${state.authorProfile}',${literal(item.bucket)},${literal(item.path)},true);`);
        }
        runtime.claims("service_role", null, `select public.erasure_mark_reconciled('${state.authorProfile}');`);
        check(runtime.claims("service_role", null, `select public.erasure_advance_identity('${state.authorProfile}');`) === state.authorAuth);
        runtime.sql(`delete from auth.users where id='${state.authorAuth}';`);
        runtime.claims("service_role", null, `select public.erasure_auth_removed('${state.authorProfile}');`);
      }, verify: async () => {
        check(runtime.sql(`select (select state='complete' from private.account_erasure_jobs where profile_id='${state.authorProfile}')
          and (select state='erased' and display_name is null from public.profiles where id='${state.authorProfile}')
          and (select availability='erased' and body='' and author_id is null from public.plates where id='${state.plate}')
          and (select availability='erased' and snapshot_body='' and snapshot_author_name='' from public.menu_plate_saves
            where plate_id='${state.plate}' and saver_id='${state.peerProfile}')
          and not exists(select 1 from auth.users where id='${state.authorAuth}')
          and exists(select 1 from auth.users where id='${state.peerAuth}')
          and (select state='active' from public.profiles where id='${state.peerProfile}');`) === "t");
        for (const entry of photos.filter((item) => ![state.authorPath, state.copyPath].includes(item.description.path)))
          check(hash(runtime.download(entry.description.bucket, entry.description.path)) === entry.sha256);
        check(runtime.sql("select count(*) from storage.objects;") === "33");
        return true;
      } });
    check(!gate.allows("app") && !gate.allows("storage"));
    await log.complete(state.operationId); check((await log.load()).records.length === 2);
    state.complete = true; await save(root, state);
    console.log(JSON.stringify({ oldSnapshotRestored: true, durableLaterIntentMatched: true, exactTwoPhotosRemoved: true,
      original32PhotosAndPeerPreserved: true, profilePlateMenuCopyBlanked: true, scratchAuthRowRemoved: true,
      networkIsolationRetained: true, publicAccessOpened: false, generalErasureEnabled: false }, null, 2));
  }
} catch {
  console.error(`Isolated restore-replay drill failed/refused at ${stage}. Preserve all scratch copies/files; original Plates data was not targeted.`);
  process.exitCode = 1;
} finally {
  if (runtime) { try { runtime.stop(); } catch { console.error("Scratch stop could not be confirmed."); process.exitCode = 1; } }
}
