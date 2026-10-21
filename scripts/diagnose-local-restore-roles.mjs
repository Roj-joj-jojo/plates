// Retry only the role transaction in the exact retained, isolated scratch copy.
import { execFileSync } from "node:child_process";
import { readEntry, readManifest, readPrivateFile } from "./encrypted-backup.mjs";

const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
const container = "plates_restore_check_1365e643";
const operator = "plates_restore_1365e643";
const run = (args, input) => execFileSync(docker, args, {
  input, encoding: "utf8", maxBuffer: 1024 * 1024, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"],
}).trim();
let started = false;
try {
  if (process.argv.slice(2).join(" ") !== "--approved-scratch-role-diagnostic") throw new Error();
  const isolation = JSON.parse(run(["inspect", "--format", "{{json .HostConfig}}", container]));
  const state = JSON.parse(run(["inspect", "--format", "{{json .State}}", container]));
  if (state.Running || isolation.NetworkMode !== "none"
    || Object.keys(isolation.PortBindings ?? {}).length || (isolation.Binds ?? []).length
    || (isolation.Mounts ?? []).length) throw new Error();
  const key = await readPrivateFile("/Users/roryjohnson/Plates Backup Keys/backup.key", 32);
  const { directory, manifest } = await readManifest(
    "/Users/roryjohnson/Plates Backups/plates-backup-1365e643-0d3e-4514-a4f4-2a664c1344b2", key);
  const entry = manifest.entries.find((item) => item.description.kind === "postgres-roles");
  const roles = await readEntry(directory, manifest, entry, key);
  run(["start", container]);
  started = true;
  run(["exec", "-d", "--user", "postgres", container, "postgres", "-D", "/tmp/plates_restore_check",
    "-k", "/tmp", "-c", "listen_addresses=", "-c", "shared_preload_libraries="]);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      run(["exec", "--user", "postgres", container, "pg_isready", "-h", "/tmp", "-U", operator]);
      ready = true; break;
    } catch { await new Promise((done) => setTimeout(done, 500)); }
  }
  if (!ready) throw new Error();
  console.log(run(["exec", "--user", "postgres", container, "psql", "-X", "-qAt", "-h", "/tmp", "-U", operator,
    "-d", "postgres", "-c", "select json_build_object('operatorSuperuser',(select rolsuper from pg_roles where rolname=current_user), 'sharedPreload',current_setting('shared_preload_libraries'), 'sessionPreload',current_setting('session_preload_libraries'))"]));
  try {
    run(["exec", "-i", "--user", "postgres", container, "psql", "-X", "-h", "/tmp", "-U", operator,
      "-d", "postgres", "--single-transaction", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-f", "-"], roles);
    console.log("Scratch role transaction passed.");
  } catch (error) {
    // Emit only the error code and fixed boolean classifications, never raw diagnostics.
    const diagnostic = String(error.stderr ?? "");
    const match = diagnostic.match(/ERROR:\s+([0-9A-Z]{5})\b/);
    console.log(JSON.stringify({ roleRestorePassed: false, sqlstate: match?.[1] ?? "unavailable",
      mentionsSuperuser: /superuser/i.test(diagnostic), mentionsReserved: /reserved/i.test(diagnostic),
      mentionsSupautils: /supautils/i.test(diagnostic), mentionsMembership: /member/i.test(diagnostic),
      sourceLine: Number(diagnostic.match(/<stdin>:(\d+):/)?.[1] ?? 0),
      routine: diagnostic.match(/LOCATION:\s+([a-z_]+),/)?.[1] ?? "unavailable",
      knownGrantor: ["postgres", "supabase_admin"].find((name) =>
        new RegExp(`GRANTED BY ${name};`).test(roles.toString().split("\n")[Number(diagnostic.match(/<stdin>:(\d+):/)?.[1] ?? 0) - 1] ?? "")) ?? "other" }));
    process.exitCode = 1;
  }
} catch {
  console.error("Scratch diagnostic refused or failed; no original database was targeted.");
  process.exitCode = 1;
} finally {
  if (started) {
    try { run(["stop", container]); }
    catch { console.error("Scratch stop could not be confirmed."); process.exitCode = 1; }
  }
}
