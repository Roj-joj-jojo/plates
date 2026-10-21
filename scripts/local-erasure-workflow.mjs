// Shared trusted local server/worker boundary. Hosted URLs are refused.
import { execFileSync } from "node:child_process";
import { resolve, dirname, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { LocalDeletionRecords } from "./local-deletion-records.mjs";
import { outsideProject, privateDirectory, readPrivateFile } from "./encrypted-backup.mjs";

const namespace = "plates/local/erasure-policy-20261010";
// Next bundles this module, so import.meta.dirname is unavailable there.
// Both the local app and operator commands run from the project root.
const project = resolve(process.cwd());
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function check(ok) { if (!ok) throw new Error("Recorded erasure unavailable"); }
export function localErasureEnabled(env, authId) {
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    return env.ACCOUNT_ERASURE_ENABLED === "true" && env.ACCOUNT_ERASURE_RECORDS_MODE === "local"
      && (!env.ACCOUNT_ERASURE_TEST_AUTH_ID || env.ACCOUNT_ERASURE_TEST_AUTH_ID === authId)
      && url.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  } catch { return false; }
}
export async function openLocalErasureStore(env = process.env) {
  check(env.ACCOUNT_ERASURE_RECORDS_MODE === "local");
  const paths = [env.LOCAL_ERASURE_RECORDS_FOLDER,env.LOCAL_ERASURE_CHECKPOINTS_FOLDER,env.LOCAL_ERASURE_KEY_PATH];
  check(paths.every((path) => typeof path === "string" && path.startsWith("/")));
  const recordsFolder = await outsideProject(await privateDirectory(paths[0]),project);
  const checkpointsFolder = await outsideProject(await privateDirectory(paths[1]),project);
  const keyFolder = await outsideProject(await privateDirectory(dirname(paths[2])),project);
  for (const folder of [recordsFolder,checkpointsFolder]) check(folder !== keyFolder
    && !folder.startsWith(keyFolder+sep) && !keyFolder.startsWith(folder+sep));
  const key = await readPrivateFile(paths[2],32); check(key.length === 32);
  return new LocalDeletionRecords({recordsFolder,checkpointsFolder,namespace,keys:new Map([["v1",key]])});
}
export function createLocalErasureAdmin(env = process.env) {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  check(url.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(url.hostname));
  const status = JSON.parse(execFileSync(resolve(project,"node_modules/.bin/supabase"),["status","-o","json"],
    {cwd:project,encoding:"utf8",stdio:["ignore","pipe","ignore"]}));
  const actual = new URL(status.API_URL);
  check(actual.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(actual.hostname)
    && actual.port === url.port && status.SERVICE_ROLE_KEY);
  return createClient(url.href,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function requestRecordedErasure({ authId, store, rpc }) {
  check(uuid.test(authId));
  // Check the history/key before reserving anything; permit only a same-event retry.
  await store.load({allowPending:true});
  const rows = await rpc("reserve_account_erasure_record",{p_auth_user_id:authId});
  check(rows?.length === 1 && uuid.test(rows[0].profile_id) && uuid.test(rows[0].operation_id));
  const row = rows[0];
  const intent = await store.intent({operationId:row.operation_id,profileId:row.profile_id,authId,keyVersion:"v1"});
  const profile = await rpc("begin_recorded_account_erasure",{p_operation_id:row.operation_id,p_intent:intent});
  check(profile === row.profile_id);
  return {accepted:true};
}
export async function requestAdminRecordedErasure({actorAuthId,profileId,store,rpc}) {
  check(uuid.test(actorAuthId)&&uuid.test(profileId));
  await store.load({allowPending:true});
  const rows=await rpc("reserve_admin_account_erasure",{p_actor_auth_id:actorAuthId,p_profile_id:profileId});
  check(rows?.length===1&&rows[0].profile_id===profileId&&uuid.test(rows[0].operation_id)&&uuid.test(rows[0].auth_user_id));
  const row=rows[0];
  const intent=await store.intent({operationId:row.operation_id,profileId,authId:row.auth_user_id,keyVersion:"v1"});
  const result=await rpc("begin_admin_recorded_erasure",{p_actor_auth_id:actorAuthId,p_operation_id:row.operation_id,p_intent:intent});
  check(result===profileId);
  return {accepted:true};
}
export async function verifyWorkerIntent({store,rpc,profileId}) {
  const state = await store.load();
  const rows = await rpc("account_erasure_record_receipt",{p_profile_id:profileId});
  check(rows?.length === 1 && rows[0].intent && rows[0].operation_id === rows[0].intent.operationId);
  const expected = rows[0].intent;
  const actual = state.records.find((record)=>record.event==="intent" && record.operationId===rows[0].operation_id);
  check(actual && Object.keys(actual).sort().join(",") === Object.keys(expected).sort().join(",")
    && Object.keys(actual).every((key)=>actual[key]===expected[key]));
  return rows[0];
}
export async function completeRecordedErasure({store,rpc,profileId}) {
  const receipt = await verifyWorkerIntent({store,rpc,profileId});
  const completion = await store.complete(receipt.operation_id);
  await rpc("complete_recorded_account_erasure",{p_profile_id:profileId,p_completion:completion});
}
