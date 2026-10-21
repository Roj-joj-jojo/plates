// Local, read-only recovery summary. Never print Auth IDs, paths or credentials.
import { execFileSync } from "node:child_process";

const profileId = process.argv[2];
if (process.argv.length !== 3 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
  throw new Error("Supply one local profile UUID");
}
const query = `begin read only;
select json_build_object(
  'state', j.state,
  'reconciled', j.reconciled_at is not null,
  'objects_pending', (select count(*) from private.account_erasure_objects o
    where o.profile_id=j.profile_id and o.state='pending'),
  'objects_processing', (select count(*) from private.account_erasure_objects o
    where o.profile_id=j.profile_id and o.state='processing'),
  'expired_cleanup_claims', (select count(*) from private.account_erasure_objects o
    where o.profile_id=j.profile_id and o.state='processing'
      and o.updated_at < clock_timestamp() - interval '2 minutes'),
  'objects_removed', (select count(*) from private.account_erasure_objects o
    where o.profile_id=j.profile_id and o.state='removed'),
  'objects_with_errors', (select count(*) from private.account_erasure_objects o
    where o.profile_id=j.profile_id and o.last_error is not null),
  'unfinished_upload_attempts', (select count(*) from private.media_object_attempts a
    where a.state='processing' and exists (select 1 from private.account_erasure_objects o
      where o.profile_id=j.profile_id and o.bucket_id=a.bucket_id and o.object_path=a.object_path))
) from private.account_erasure_jobs j where j.profile_id='${profileId}'::uuid;
commit;`;
try {
  const output = execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",
    ["exec", "supabase_db_plates", "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-c", query],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  console.log(output ? JSON.stringify(JSON.parse(output), null, 2) : "No local erasure job for this profile.");
} catch {
  console.error("Could not inspect the local erasure job; check that this project's local database is running.");
  process.exitCode = 1;
}
