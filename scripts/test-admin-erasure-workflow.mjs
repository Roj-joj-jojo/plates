import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { requestAdminRecordedErasure } from "./local-erasure-workflow.mjs";
const actorAuthId=randomUUID(),profileId=randomUUID(),authId=randomUUID(),operationId=randomUUID();
let loaded=false,intent=null,cutoffs=0,fail=false,calls=0;
const store={load:async()=>{if(fail)throw new Error("Unavailable key");loaded=true;},intent:async(input)=>{assert.equal(input.authId,authId);intent=input;return input;}};
const rpc=async(name,args)=>{calls++;assert(loaded);assert.equal(args.p_actor_auth_id,actorAuthId);
  if(name==="reserve_admin_account_erasure"){assert.equal(args.p_profile_id,profileId);return[{profile_id:profileId,auth_user_id:authId,operation_id:operationId}];}
  assert.equal(name,"begin_admin_recorded_erasure");assert.equal(args.p_intent,intent);cutoffs++;return profileId;};
assert.deepEqual(await requestAdminRecordedErasure({actorAuthId,profileId,store,rpc}),{accepted:true});assert.equal(cutoffs,1);
fail=true;const before=calls;await assert.rejects(requestAdminRecordedErasure({actorAuthId,profileId,store,rpc}));assert.equal(calls,before);
fail=false;await assert.rejects(requestAdminRecordedErasure({actorAuthId,profileId,store,rpc:async()=>[{profile_id:randomUUID(),operation_id:operationId,auth_user_id:authId}]}));assert.equal(cutoffs,1);
await assert.rejects(requestAdminRecordedErasure({actorAuthId,profileId,store,rpc:async()=>{throw new Error("Owner refused");}}));assert.equal(cutoffs,1);
console.log("PASS admin erasure coordinator: verified actor/selected target, server-derived Auth identity, durable intent before cutoff, missing-key and mismatched reservation refusal; no database or worker access");
