// Synthetic metadata only; one rollback-only local transaction, no Storage/Auth API.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { recoverySql } from "./recover-abandoned-upload.mjs";

const profileId = randomUUID();
const peerId = randomUUID();
const authorAuthId = randomUUID();
const peerAuthId = randomUUID();
const scopes = ["plate-media", "table-media", "menu-previews"].map((bucket) => ({
  profileId, bucket, objectPath: `recovery-sql-${randomUUID()}.webp`,
}));
const wrong = { ...scopes[0], profileId: peerId };
const missing = { ...scopes[0], objectPath: `missing-${randomUUID()}.webp` };
function body(scope, apply) {
  return recoverySql(scope, apply).replace(/^begin(?: read only)?;\s*/, "").replace(/\s*commit;$/, "");
}
function functions(name, scope) {
  return `create function pg_temp.inspect_${name}() returns json language plpgsql as $fn$
declare result json; begin execute $query$${body(scope, false)}$query$ into result; return result; end $fn$;
create function pg_temp.recover_${name}() returns void language plpgsql as $fn$
begin execute $query$${body(scope, true)}$query$; end $fn$;`;
}
function refuse(name, message) {
  return `do $test$ begin
    begin perform pg_temp.recover_${name}(); raise exception 'Unexpected recovery success';
    exception when raise_exception then
      if sqlerrm <> '${message}' then raise; end if;
    end;
  end $test$;`;
}
const sql = `begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
create function pg_temp.check_ok(ok boolean, reason text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', reason; end if; end $$;
insert into public.profiles(id,state,display_name) values
  ('${profileId}','disabled',null), ('${peerId}','disabled',null);
-- Model already acknowledged jobs under the optional recorded-erasure guard.
-- These synthetic receipts only exercise recovery metadata and roll back.
do $$ begin
  if to_regclass('private.account_erasure_records') is not null then
    insert into private.account_erasure_records(profile_id,auth_user_id,intent) values
      ('${profileId}','${authorAuthId}','{"event":"intent"}'),
      ('${peerId}','${peerAuthId}','{"event":"intent"}');
    perform set_config('request.jwt.claim.role','service_role',true);
  end if;
end $$;
insert into private.account_erasure_jobs(profile_id,auth_user_id) values
  ('${profileId}','${authorAuthId}'), ('${peerId}','${peerAuthId}');
${scopes.map((scope) => `insert into private.media_object_attempts(bucket_id,object_path,owner_id)
  values ('${scope.bucket}','${scope.objectPath}','${profileId}');
insert into private.account_erasure_objects(profile_id,bucket_id,object_path,state)
  values ('${profileId}','${scope.bucket}','${scope.objectPath}','removed');`).join("\n")}
update private.account_erasure_jobs set reconciled_at=clock_timestamp() where profile_id='${profileId}';
${scopes.map((scope, index) => functions(`bucket${index}`, scope)).join("\n")}
${functions("wrong", wrong)}
${functions("missing", missing)}
select pg_temp.check_ok((pg_temp.inspect_wrong()->>'eligible')::boolean=false,'wrong profile refused');
select pg_temp.check_ok((pg_temp.inspect_missing()->>'eligible')::boolean=false,'missing path refused');
${refuse("wrong", "Recovery target is not eligible")}
${refuse("missing", "Recovery target is not eligible")}
insert into private.account_erasure_objects(profile_id,bucket_id,object_path)
  values ('${peerId}','${scopes[0].bucket}','${scopes[0].objectPath}');
select pg_temp.check_ok((pg_temp.inspect_bucket0()->>'other_cleaning_job')::boolean,'shared job identified');
${refuse("bucket0", "Recovery would affect another cleaning job")}
select pg_temp.check_ok((select state='processing' from private.media_object_attempts
  where bucket_id='${scopes[0].bucket}' and object_path='${scopes[0].objectPath}'),'shared refusal preserves attempt');
-- Preserve the peer's queue row; it no longer participates in cleaning.
update private.account_erasure_jobs set state='auth_pending' where profile_id='${peerId}';
-- Prove SQL mutations roll back on a later transaction error.
do $test$ begin
  begin perform pg_temp.recover_bucket1(); raise exception 'Synthetic later failure';
  exception when raise_exception then
    if sqlerrm <> 'Synthetic later failure' then raise; end if;
  end;
end $test$;
select pg_temp.check_ok((select state='processing' from private.media_object_attempts
  where bucket_id='${scopes[1].bucket}' and object_path='${scopes[1].objectPath}'),'failed subtransaction rolls back attempt');
select pg_temp.check_ok((select reconciled_at is not null from private.account_erasure_jobs
  where profile_id='${profileId}'),'failed subtransaction rolls back reconciliation');
${scopes.map((scope, index) => `select pg_temp.check_ok((pg_temp.inspect_bucket${index}()->>'eligible')::boolean,
  '${scope.bucket} eligible');
select pg_temp.recover_bucket${index}();
${refuse(`bucket${index}`, "Recovery target is not eligible")}
select pg_temp.check_ok((select state='pending' from private.account_erasure_objects
  where profile_id='${profileId}' and bucket_id='${scope.bucket}' and object_path='${scope.objectPath}'),
  '${scope.bucket} must be checked again');`).join("\n")}
select pg_temp.check_ok((select reconciled_at is null and state='cleaning' from private.account_erasure_jobs
  where profile_id='${profileId}'),'reconciliation cleared without advancing Auth');
select pg_temp.check_ok((select state='pending' from private.account_erasure_objects
  where profile_id='${peerId}' and bucket_id='${scopes[0].bucket}' and object_path='${scopes[0].objectPath}'),
  'non-cleaning peer queue preserved');
set constraints all immediate;
rollback;
select 'PASS scoped recovery SQL: three buckets, wrong/missing target, shared cleaning job, repeat refusal, requeue and rollback; all fixtures rolled back';`;
try {
  const output = execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",
    ["exec", "-i", "supabase_db_plates", "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-f", "-"],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  const marker = output.split("\n").find((line) => line.startsWith("PASS scoped recovery SQL:"));
  if (!marker) throw new Error("Missing rollback PASS marker");
  console.log(marker);
} catch (error) {
  // This suite contains only synthetic IDs/paths; report concise diagnostic lines.
  console.error(String(error.stderr || error.message).split("\n")
    .filter((line) => /ERROR:|DETAIL:|FAIL:/.test(line)).join("\n") || "Rollback-only recovery SQL test failed.");
  process.exitCode = 1;
}
