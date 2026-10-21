import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const applied = process.argv[2] === "--applied";
if (process.argv.length > 3 || (process.argv[2] && !applied)) throw new Error("Use optional --applied only");
function body(path, end) {
  const lines = readFileSync(path, "utf8").split("\n");
  const first = lines.findIndex(line => line.trim() === "begin;");
  const last = lines.findLastIndex(line => line.trim());
  if (first < 0 || lines[last].trim() !== `${end};`) throw new Error("Unexpected transaction wrapper");
  return lines.slice(first + 1, last).join("\n");
}
try {
  const candidates = applied ? "" : ["20261015000100_follow_notifications", "20261015000200_menu_photo_gallery"]
    .map(name => body(`supabase/candidates/${name}.sql`, "commit")).join("\n");
  const sql = `begin;\nset local statement_timeout='30s';\nset local lock_timeout='3s';\n${candidates}\n${body("supabase/tests/social_menu_updates.sql", "rollback")}\nrollback;`;
  const output = execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker", ["exec", "-i", "supabase_db_plates", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-f", "-"],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 120_000 });
  const marker = output.split("\n").find(line => line.trim().startsWith("PASS social Menu updates"));
  if (!marker) throw new Error("Missing result marker");
  console.log(marker.trim());
} catch (error) {
  const state = String(error.stderr ?? "").match(/ERROR:\s+([0-9A-Z]{5})\b/)?.[1];
  console.error(`Social/Menu fixture checks refused or failed${state ? ` (${state})` : ""}; transaction rolled back when the connection closed.`);
  process.exitCode = 1;
}
