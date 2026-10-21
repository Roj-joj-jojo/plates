// Local operator tool. Preparing a scope never grants permission to apply it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateScope(scope) {
  if (!scope || Object.keys(scope).sort().join(",") !== "bucket,objectPath,profileId"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope.profileId)
    || !["plate-media", "table-media", "menu-previews"].includes(scope.bucket)
    || typeof scope.objectPath !== "string" || scope.objectPath.length > 1024
    || !/^[A-Za-z0-9_./-]+$/.test(scope.objectPath)
    || scope.objectPath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid recovery scope; supply exactly profileId, bucket and objectPath.");
  }
  return scope;
}

export function recoverySql(input, apply = false) {
  const { profileId, bucket, objectPath } = validateScope(input);
  // Validation excludes SQL delimiters. Paths stay in stdin, never command arguments.
  const match = `bucket_id='${bucket}' and object_path='${objectPath}'`;
  const eligible = `select 1 from private.account_erasure_jobs j
    join private.account_erasure_objects o on o.profile_id=j.profile_id
    join private.media_object_attempts a on a.bucket_id=o.bucket_id and a.object_path=o.object_path
    where j.profile_id='${profileId}'::uuid and j.state='cleaning'
      and o.bucket_id='${bucket}' and o.object_path='${objectPath}' and a.state='processing'`;
  const shared = `select 1 from private.account_erasure_objects o
    join private.account_erasure_jobs j on j.profile_id=o.profile_id
    where o.bucket_id='${bucket}' and o.object_path='${objectPath}'
      and j.state='cleaning' and j.profile_id<>'${profileId}'::uuid`;
  if (!apply) return `begin read only;
select json_build_object('eligible', exists (${eligible}),
  'other_cleaning_job', exists (${shared}));
commit;`;
  return `begin;
set local lock_timeout='5s';
set local statement_timeout='15s';
-- Same lock order as finish_media_object_attempt and identity advancement.
select 1 from private.account_erasure_jobs where profile_id='${profileId}'::uuid for update;
-- Prevent a concurrent erasure from adding this path after the shared-scope check.
lock table private.account_erasure_objects in share row exclusive mode;
select 1 from private.media_object_attempts where ${match} for update;
do $$ begin
  if not exists (${eligible}) then raise exception 'Recovery target is not eligible'; end if;
  if exists (${shared}) then raise exception 'Recovery would affect another cleaning job'; end if;
end $$;
select set_config('request.jwt.claim.role','service_role',true);
select public.finish_media_object_attempt('${bucket}','${objectPath}');
do $$ begin
  if not exists (select 1 from private.media_object_attempts where ${match} and state='finished')
    or not exists (select 1 from private.account_erasure_objects
      where profile_id='${profileId}'::uuid and ${match} and state='pending')
    or not exists (select 1 from private.account_erasure_jobs
      where profile_id='${profileId}'::uuid and state='cleaning' and reconciled_at is null)
  then raise exception 'Recovery recheck failed'; end if;
end $$;
commit;`;
}

export function runRecovery(args, { readScope, execute }) {
  const [scopeFile, ...flags] = args;
  const apply = flags.includes("--apply");
  const expected = apply ? ["--apply", "--scope-approved", "--writer-stopped"] : [];
  if (!scopeFile || flags.length !== expected.length
    || new Set(flags).size !== flags.length || flags.some((flag) => !expected.includes(flag))) {
    throw new Error("Use SCOPE.json for inspection; application requires --apply --scope-approved --writer-stopped.");
  }
  const scope = validateScope(JSON.parse(readScope(scopeFile)));
  const inspection = JSON.parse(execute(recoverySql(scope)).trim());
  if (!apply) return inspection;
  if (!inspection.eligible || inspection.other_cleaning_job) {
    throw new Error("Recovery refused: target is ineligible or affects another cleaning job.");
  }
  execute(recoverySql(scope, true));
  return { recovered: true, cleanupRequired: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = runRecovery(process.argv.slice(2), {
      readScope: (file) => readFileSync(file, "utf8"),
      execute: (sql) => execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",
        ["exec", "-i", "supabase_db_plates", "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres",
          "-v", "ON_ERROR_STOP=1", "-f", "-"],
        { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }),
    });
    console.log(JSON.stringify(result, null, 2));
  } catch {
    // Database errors can include private paths; never echo them.
    console.error("Recovery failed or refused. Check the exact scope, required confirmations and local database; no completion is claimed.");
    process.exitCode = 1;
  }
}
