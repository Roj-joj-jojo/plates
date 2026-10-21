import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Fixed isolated target only. Never use the original database or hosted URLs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const container = "supabase_db_dinnerfolk-rehearsal-agwrjf";
const suites = [
  ["photo_worker_ownership", "PASS photo worker ownership"],
  ["photo_worker_flows", "PASS photo worker flows"],
  ["social_menu_updates", "PASS social Menu updates"],
  ["menu_removal", "PASS Menu removal"],
  ["plate_interactions", "PASS Plate interactions"],
  ["introduction", "PASS Introduction"],
  ["activity_notifications", "PASS Activity notifications"],
];

try {
  if (process.argv.length !== 2) throw new Error("No target overrides or activation options allowed");
  const manifest = JSON.parse(readFileSync(resolve(root,
    "supabase/releases/dinnerfolk-alpha-20261021.json"), "utf8"));
  const versions = manifest.files.map(file => file.version);
  if (versions.length !== 33 || versions.some(version => !/^\d{14}$/.test(version))) {
    throw new Error("Unexpected release inventory");
  }
  const fixtures = suites.map(([name]) => {
    const sql = readFileSync(resolve(root, `supabase/tests/${name}.sql`), "utf8");
    const statements = sql.split("\n").map(line => line.trim());
    if (!statements.includes("begin;") || statements.findLast(line => line) !== "rollback;"
      || /^\s*commit\s*;/im.test(sql) || /^\s*\\/m.test(sql)) {
      throw new Error(`Unexpected fixture transaction wrapper: ${name}`);
    }
    return sql;
  });
  // No fixture executes unless this separate rehearsal still has no accounts.
  const preflight = `begin read only;
do $$ begin
  if current_database() <> 'postgres'
    or (select array_agg(version::text order by version) from supabase_migrations.schema_migrations)
      is distinct from array[${versions.map(version => `'${version}'`).join(",")}]::text[]
    or exists(select 1 from auth.users)
    or exists(select 1 from public.profiles) then
    raise exception 'Expected empty isolated 33-migration rehearsal';
  end if;
end $$;
rollback;`;
  const output = execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker", [
    "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-f", "-",
  ], {
    input: `set statement_timeout='30s';\nset lock_timeout='3s';\n${preflight}\n${fixtures.join("\n")}\n`,
    encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 120_000,
  });
  if (output.split("\n").filter(line => line.trim() === "ROLLBACK").length !== 8) {
    throw new Error("Expected preflight plus seven completed rollback transactions");
  }
  for (const [, marker] of suites) {
    if (!output.split("\n").some(line => line.trim().startsWith(marker))) {
      throw new Error(`Missing fixed result marker: ${marker}`);
    }
    console.log(marker);
  }
  console.log("PASS isolated alpha schema: seven existing SQL suites; all fixture transactions rolled back.");
  console.log("No migrations reapplied, external API requests, photo bytes, worker process or Git operation.");
} catch (error) {
  const state = String(error.stderr ?? "").match(/ERROR:\s+([0-9A-Z]{5})\b/)?.[1];
  const line = String(error.stderr ?? "").match(/psql:<stdin>:(\d+):/)?.[1];
  console.error(`Isolated alpha checks failed${state ? ` (SQL state ${state})` : ""}${line ? ` at SQL input line ${line}` : ""}; stop and review. Open SQL transactions roll back on disconnect.`);
  if (!error.stderr) console.error(error.message);
  process.exitCode = 1;
}
