import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import { mkdir,mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import { LocalDeletionRecords } from "./local-deletion-records.mjs";
import { localErasureEnabled,requestRecordedErasure,verifyWorkerIntent,completeRecordedErasure } from "./local-erasure-workflow.mjs";

const root=await mkdtemp("/private/tmp/plates-recorded-request-test-");
async function makeStore(name,afterRecordSync) {
  const recordsFolder=resolve(root,name+"-records"),checkpointsFolder=resolve(root,name+"-checkpoints");
  await mkdir(recordsFolder,{mode:0o700});await mkdir(checkpointsFolder,{mode:0o700});
  const store=new LocalDeletionRecords({recordsFolder,checkpointsFolder,namespace:"plates/local/erasure-policy-20261010",
    keys:new Map([["v1",randomBytes(32)]]),afterRecordSync});await store.initialise();return store;
}
const authId=randomUUID(),profileId=randomUUID(),operationId=randomUUID();
const store=await makeStore("request");let receipt,cutoffs=0,reservations=0,failCommit=true;
async function rpc(name,args) {
  if(name==="reserve_account_erasure_record") {reservations++;assert.equal(args.p_auth_user_id,authId);
    return [{profile_id:profileId,operation_id:operationId,accepted:cutoffs>0}];}
  if(name==="begin_recorded_account_erasure") {
    const state=await store.load();assert(state.records.some(record=>record.mac===args.p_intent.mac));
    if(failCommit) throw new Error("Synthetic DB failure after durable intent");
    receipt={operation_id:operationId,intent:args.p_intent};cutoffs++;return profileId;
  }
  if(name==="account_erasure_record_receipt") return [receipt];
  if(name==="complete_recorded_account_erasure") {
    assert.equal((await store.load()).records.at(-1).mac,args.p_completion.mac);return null;
  }
  throw new Error("Unexpected operation");
}
await assert.rejects(requestRecordedErasure({authId,store,rpc}));assert.equal(cutoffs,0);
assert.equal((await store.load()).records.length,1);
failCommit=false;assert.deepEqual(await requestRecordedErasure({authId,store,rpc}),{accepted:true});
await requestRecordedErasure({authId,store,rpc});assert.equal((await store.load()).records.length,1);
// Database JSONB returns reordered keys; equality must be independent of ordering.
receipt.intent=Object.fromEntries(Object.entries(receipt.intent).reverse());
await verifyWorkerIntent({store,rpc,profileId});await completeRecordedErasure({store,rpc,profileId});
await completeRecordedErasure({store,rpc,profileId});assert.equal((await store.load()).records.length,2);
const valid=receipt.intent;receipt.intent={...valid,mac:"f".repeat(64)};
await assert.rejects(verifyWorkerIntent({store,rpc,profileId}));receipt.intent=valid;
store.keys=new Map();const before=reservations;
await assert.rejects(requestRecordedErasure({authId,store,rpc}));assert.equal(reservations,before);
await assert.rejects(verifyWorkerIntent({store,rpc,profileId}));
let interrupted=true;
const crash=await makeStore("interrupted",()=>{if(interrupted)throw new Error("Synthetic sync interruption");});
let calls=0;const callback=async(name)=>{calls++;return name==="reserve_account_erasure_record"
  ?[{profile_id:profileId,operation_id:operationId}]:profileId;};
await assert.rejects(requestRecordedErasure({authId,store:crash,rpc:callback}));assert.equal(calls,1);
interrupted=false;await requestRecordedErasure({authId,store:crash,rpc:callback});assert.equal(calls,3);
const env={NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321",ACCOUNT_ERASURE_ENABLED:"true",ACCOUNT_ERASURE_RECORDS_MODE:"local"};
assert(localErasureEnabled(env,authId));assert(!localErasureEnabled({...env,ACCOUNT_ERASURE_ENABLED:"false"},authId));
assert(!localErasureEnabled({...env,ACCOUNT_ERASURE_RECORDS_MODE:""},authId));
assert(!localErasureEnabled({...env,NEXT_PUBLIC_SUPABASE_URL:"https://example.test"},authId));
assert(!localErasureEnabled({...env,ACCOUNT_ERASURE_TEST_AUTH_ID:randomUUID()},authId));
console.log("PASS recorded erasure coordinator: durable intent before cutoff, stable retries after DB/sync failure, missing-key refusal before mutation, JSONB ordering, worker receipt conflict refusal, durable completion before DB completion and disabled/hosted/test-identity gates; synthetic files retained");
