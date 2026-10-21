import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const migration = readFileSync(
  "supabase/migrations/20261010000300_account_erasure_media_guard_fix.sql", "utf8",
).replace(/^begin;\s*/m, "").replace(/\s*commit;\s*$/i, "");
const tableMode = process.argv[2] === "--table";
const test = readFileSync(tableMode
  ? "supabase/tests/table_images.sql" : "supabase/tests/menu_photo_previews.sql", "utf8");
const sql = `begin;\n${migration}\n${test}\nrollback;\n`;
const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
let output;
try {
  output = execFileSync(docker, ["exec", "-i", "supabase_db_plates", "psql",
    "-X", "-qAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "-"], {
    input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
  });
} catch (error) {
  console.error(String(error.stderr || error.message).trim());
  process.exit(1);
}
const marker = output.split("\n").find((line) => line.includes("PASS:"));
if (!marker) throw new Error("Media test did not produce its PASS marker");
console.log(marker.trim());
