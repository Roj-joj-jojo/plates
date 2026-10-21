// Local-only database/Storage export. No restore, removal or hosted credentials.
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createBundle, createKey, MAX_PART_BYTES, outsideProject, privateDirectory,
  readPrivateFile, verifyBundle } from "./encrypted-backup.mjs";

const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
const project = resolve(import.meta.dirname, "..");
let stage = "argument validation";
function check(ok, message) { if (!ok) throw new Error(message); }
function local(value) {
  const url = new URL(value);
  check(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local HTTP only");
  return url;
}
function db(program, args) {
  return execFileSync(docker, ["exec", "supabase_db_plates", program, ...args],
    { maxBuffer: MAX_PART_BYTES, stdio: ["ignore", "pipe", "pipe"] });
}
function sql(query) {
  return db("psql", ["-X", "-qAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", query]).toString().trim();
}
async function setup(parent, keyPath) {
  for (const directory of [resolve(parent), resolve(dirname(keyPath))]) {
    await mkdir(directory, { mode: 0o700, recursive: true });
    await privateDirectory(directory);
    await outsideProject(directory, project);
  }
  check(await privateDirectory(parent) !== await privateDirectory(dirname(keyPath)), "Keep key separate from backup folder");
  await createKey(resolve(keyPath));
  console.log("Created private backup folders and a new encryption key. No backup/export ran; key contents are not printed.");
}
async function backup(parent, keyPath, confirmation) {
  stage = "private folder/key validation";
  check(confirmation === "--writers-stopped", "Confirm writers stopped before taking a consistent database/photo copy");
  const base = await outsideProject(await privateDirectory(parent), project);
  const keyFolder = await outsideProject(await privateDirectory(dirname(keyPath)), project);
  check(base !== keyFolder, "Keep key separate from backups");
  const key = await readPrivateFile(resolve(keyPath), 32);
  check(key.length === 32, "Encryption key must contain exactly 32 bytes");
  const url = local(process.env.NEXT_PUBLIC_SUPABASE_URL);
  stage = "local service validation";
  const status = JSON.parse(execFileSync(resolve(project, "node_modules/.bin/supabase"), ["status", "-o", "json"],
    { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  check(local(status.API_URL).port === url.port, "Wrong local project");
  const admin = createClient(url.href, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const inventoryQuery = `begin read only;
    select json_build_object('buckets',(select coalesce(json_agg(id order by id),'[]') from storage.buckets),
      'objects',(select coalesce(json_agg(json_build_object('bucket',bucket_id,'path',name,
        'id',id,'updatedAt',updated_at) order by bucket_id,name),'[]') from storage.objects)); commit;`;
  stage = "Storage inventory";
  const before = sql(inventoryQuery);
  const inventory = JSON.parse(before);
  const metadata = { scope: "local-supabase-full-postgres-and-storage", postgresVersion: sql("select version()"),
    databaseCounts: JSON.parse(sql(`select json_build_object('profiles',(select count(*) from public.profiles),
      'plates',(select count(*) from public.plates),'authUsers',(select count(*) from auth.users),
      'erasureJobs',(select count(*) from private.account_erasure_jobs),
      'storageObjects',(select count(*) from storage.objects))`)),
    buckets: inventory.buckets, writersStoppedByOperator: true,
    rolesContainPasswords: false, includesAppEnvironmentSecrets: false,
    deletionRecordIsIndependent: false };
  async function* entries() {
    stage = "PostgreSQL export";
    yield { kind: "postgres-custom", data: db("pg_dump", ["-U", "postgres", "-d", "postgres", "--format=custom"]) };
    stage = "role export";
    yield { kind: "postgres-roles", data: db("pg_dumpall", ["-U", "postgres", "--roles-only", "--no-role-passwords"]) };
    stage = "Storage download/encryption";
    for (const object of inventory.objects) {
      const { data, error } = await admin.storage.from(object.bucket).download(object.path);
      if (error || !data) throw new Error("A Storage object could not be backed up");
      yield { kind: "storage-object", bucket: object.bucket, path: object.path,
        data: Buffer.from(await data.arrayBuffer()) };
    }
    stage = "Storage consistency check";
    check(sql(inventoryQuery) === before, "Storage inventory changed during backup; do not use this partial bundle");
  }
  const directory = await createBundle(base, key, entries(), metadata);
  stage = "encrypted backup verification";
  const result = await verifyBundle(directory, key);
  console.log(JSON.stringify({ backupDirectory: directory, ...result,
    restoreTested: false, independentDeletionRecordIncluded: false }, null, 2));
}
try {
  const [mode, first, second, confirmation, ...extra] = process.argv.slice(2);
  check(first && second && extra.length === 0, "Expected mode and two paths");
  if (mode === "setup") { check(!confirmation, "Unexpected setup flag"); await setup(first, second); }
  else if (mode === "backup") await backup(first, second, confirmation);
  else if (mode === "verify") {
    check(!confirmation, "Unexpected verification flag");
    const directory = await outsideProject(first, project);
    await outsideProject(dirname(second), project);
    console.log(JSON.stringify(await verifyBundle(directory, await readPrivateFile(second, 32)), null, 2));
  } else throw new Error("Use setup, backup or verify");
} catch {
  // External diagnostics can contain account data/paths or credentials.
  console.error(`Local backup operation failed or was refused at ${stage}. No restore or deletion ran. Preserve partial files for review; do not overwrite them.`);
  process.exitCode = 1;
}
