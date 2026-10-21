import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const runId = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new Error("Supply the prepared local erasure run UUID");
const state = JSON.parse(readFileSync(`/private/tmp/plates-erasure-${runId}.json`, "utf8"));
if (!state.prepared || state.completed || !/^[0-9a-f-]{36}$/i.test(state.author.profileId)
  || state.blocker !== `erasure-test-${runId}.webp`) throw new Error("Expected unfinished fixture state");
const correction = process.argv[3] === "--baseline" ? "" : readFileSync(
  "supabase/migrations/20261010000400_erasure_recheck_finished_upload.sql", "utf8",
).replace(/^begin;\s*/m, "").replace(/\s*commit;\s*$/i, "");
const sql = `begin;
${correction}
select set_config('request.jwt.claim.role','service_role',true);
update private.account_erasure_objects set state='removed'
  where profile_id='${state.author.profileId}' and bucket_id='plate-media' and object_path='${state.blocker}';
update private.account_erasure_jobs set reconciled_at=clock_timestamp() where profile_id='${state.author.profileId}';
select public.finish_media_object_attempt('plate-media','${state.blocker}');
do $$ begin
  if not exists (select 1 from private.account_erasure_objects where profile_id='${state.author.profileId}'
    and bucket_id='plate-media' and object_path='${state.blocker}' and state='pending') then
    raise exception 'FAIL: finishing an upload did not requeue its previously removed path'; end if;
  if not exists (select 1 from private.account_erasure_jobs where profile_id='${state.author.profileId}'
    and state='cleaning' and reconciled_at is null) then
    raise exception 'FAIL: finishing an upload did not invalidate earlier reconciliation'; end if;
end $$;
rollback;
select 'PASS: finished upload queues a fresh cleanup check; all changes rolled back';`;
try {
  const output = execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",
    ["exec", "-i", "supabase_db_plates", "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-f", "-"],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  const marker = output.split("\n").find((line) => line.startsWith("PASS:"));
  if (!marker) throw new Error("Missing rollback test PASS marker");
  console.log(marker);
} catch (error) {
  console.error(String(error.stderr || error.message).trim());
  process.exitCode = 1;
}
