// Restore only into a newly created, network-isolated container. Never target Plates.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { outsideProject, readEntry, readManifest, readPrivateFile, verifyBundle } from "./encrypted-backup.mjs";

const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
const project = resolve(import.meta.dirname, "..");
let stage = "argument validation";
let created = false;
let startedExisting = false;
let container;
function check(ok, message) { if (!ok) throw new Error(message); }
function run(args, input) {
  return execFileSync(docker, args, { input, encoding: "utf8", maxBuffer: 1024 * 1024,
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] }).trim();
}
function target(program, args, input) {
  return run(["exec", ...(input ? ["-i"] : []), "--user", "postgres", container, program, ...args], input);
}
try {
  const [directory, keyPath, name, approval, ...extra] = process.argv.slice(2);
  check(directory && keyPath && /^plates_restore_check_[0-9a-f]{8}$/.test(name)
    && ["--approved-new-container", "--approved-existing-bootstrap-retry"].includes(approval) && extra.length === 0,
  "Supply backup, key, reserved container name and exact new-container approval");
  container = name;
  await outsideProject(directory, project);
  const key = await readPrivateFile(keyPath, 32);
  stage = "backup authentication";
  await verifyBundle(directory, key);
  const { directory: actual, manifest } = await readManifest(directory, key);
  const dumpEntry = manifest.entries.filter((entry) => entry.description.kind === "postgres-custom");
  const roleEntry = manifest.entries.filter((entry) => entry.description.kind === "postgres-roles");
  check(dumpEntry.length === 1 && roleEntry.length === 1 && manifest.metadata.databaseCounts,
    "Expected complete local backup with database counts");
  const dump = await readEntry(actual, manifest, dumpEntry[0], key);
  const roles = await readEntry(actual, manifest, roleEntry[0], key);
  let operator = `plates_restore_${name.slice(-8)}`;
  check(!roles.toString().includes(operator), "Scratch operator conflicts with source role");
  stage = "source image lookup";
  const image = run(["inspect", "--format", "{{.Image}}", "supabase_db_plates"]);
  check(/^sha256:[0-9a-f]{64}$/.test(image), "Expected already cached source image");
  stage = "new isolated container creation";
  // Existing names fail at create. No force, pull, volume reuse or published port.
  const retry = approval === "--approved-existing-bootstrap-retry";
  if (retry) {
    check(name === "plates_restore_check_1365e643", "Retry is restricted to the diagnosed scratch container");
    check(run(["inspect", "--format", "{{.Image}}", container]) === image
      && run(["inspect", "--format", "{{.State.Running}}", container]) === "false", "Wrong scratch image/state");
  } else {
    run(["create", "--pull=never", "--network", "none", "--name", container,
      "--entrypoint", "tail", image, "-f", "/dev/null"]);
    created = true;
  }
  const beforeStart = JSON.parse(run(["inspect", "--format", "{{json .HostConfig}}", container]));
  check(beforeStart.NetworkMode === "none" && Object.keys(beforeStart.PortBindings ?? {}).length === 0
    && (beforeStart.Binds ?? []).length === 0 && (beforeStart.Mounts ?? []).length === 0, "Scratch isolation failed");
  run(["start", container]);
  startedExisting = retry;
  const isolation = JSON.parse(run(["inspect", "--format", "{{json .HostConfig}}", container]));
  check(isolation.NetworkMode === "none" && Object.keys(isolation.PortBindings ?? {}).length === 0
    && (isolation.Binds ?? []).length === 0 && (isolation.Mounts ?? []).length === 0,
  "Scratch isolation check failed");
  stage = "fresh database initialisation";
  const dataPath = "/tmp/plates_restore_check";
  if (!retry) target("initdb", ["-D", dataPath, "-U", operator, "--auth-local=trust", "--auth-host=reject"]);
  run(["exec", "-d", "--user", "postgres", container, "postgres", "-D", dataPath,
    "-k", "/tmp", "-c", "listen_addresses=", "-c", "shared_preload_libraries="]);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { target("pg_isready", ["-h", "/tmp", "-U", operator, "-d", "postgres"]); ready = true; break; }
    catch { await new Promise((done) => setTimeout(done, 500)); }
  }
  check(ready, "Scratch database did not start");
  stage = "role restore into scratch only";
  let restoreRoles = roles;
  {
    check(target("psql", ["-X", "-qAt", "-h", "/tmp", "-U", operator, "-d", "postgres", "-c",
      "select (select oid=10 and rolsuper from pg_roles where rolname=current_user) and to_regclass('public.profiles') is null and not exists(select 1 from pg_roles where rolname='supabase_admin')"]) === "t", "Retry requires the unmodified bootstrap-only scratch database");
    const text = roles.toString();
    const helper = `plates_restore_helper_${name.slice(-8)}`;
    check(text.split("CREATE ROLE supabase_admin;").length === 2
      && /ALTER ROLE supabase_admin WITH SUPERUSER\b/.test(text)
      && !text.includes(helper), "Expected exact source bootstrap role");
    // Preserve bootstrap OID 10, required by PostgreSQL 17 GRANTED BY semantics.
    // Only the in-memory CREATE for this already-existing identity is adapted.
    // PostgreSQL refuses to rename the current session identity. Use a separate
    // scratch-only session identity; all these changes share the role transaction.
    restoreRoles = Buffer.from(`CREATE ROLE ${helper} SUPERUSER LOGIN;\nSET SESSION AUTHORIZATION ${helper};\n`
      + text.replace("CREATE ROLE supabase_admin;", `ALTER ROLE ${operator} RENAME TO supabase_admin;`));
  }
  target("psql", ["-X", "-h", "/tmp", "-U", operator, "-d", "postgres",
    "--single-transaction", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-f", "-"], restoreRoles);
  operator = "supabase_admin";
  stage = "database restore into scratch only";
  target("pg_restore", ["-h", "/tmp", "-U", operator, "-d", "postgres",
    "--single-transaction", "--exit-on-error"], dump);
  stage = "restored counts and access policy check";
  const counts = JSON.parse(target("psql", ["-X", "-qAt", "-h", "/tmp", "-U", operator, "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", `select json_build_object('profiles',(select count(*) from public.profiles),
      'plates',(select count(*) from public.plates),'authUsers',(select count(*) from auth.users),
      'erasureJobs',(select count(*) from private.account_erasure_jobs),
      'storageObjects',(select count(*) from storage.objects))`]));
  check(JSON.stringify(counts) === JSON.stringify(manifest.metadata.databaseCounts), "Restored counts differ");
  check(target("psql", ["-X", "-qAt", "-h", "/tmp", "-U", operator, "-d", "postgres", "-c",
    "select relrowsecurity from pg_class where oid='public.profiles'::regclass"]) === "t", "Profile RLS was not restored");
  console.log(JSON.stringify({ restoredDatabaseCountsMatch: true, profileRlsRestored: true,
    networkIsolated: true, restoredStorageBytes: false, deletionReplayTested: false,
    retainedScratchContainer: container }, null, 2));
} catch (error) {
  console.error(`Isolated restore check failed or was refused at ${stage}. Original Plates data was not targeted. Preserve the scratch container for review.`);
  const code = String(error.stderr ?? "").match(/ERROR:\s+([0-9A-Z]{5})\b/)?.[1];
  if (code) console.error(`Database error code: ${code}`);
  process.exitCode = 1;
} finally {
  if (created || startedExisting) {
    try { run(["stop", container]); }
    catch { console.error("Scratch container stop could not be confirmed; review that exact container."); process.exitCode = 1; }
  }
}
