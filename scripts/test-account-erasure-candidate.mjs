import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const migrationPath = "supabase/migrations/20261010000200_account_erasure.sql";
const testPath = "supabase/tests/account_erasure.sql";

function transactionBody(path, expectedEnd) {
  const source = readFileSync(path, "utf8");
  const lines = source.split("\n");
  const first = lines.findIndex((line) => /^\s*begin\s*;\s*$/i.test(line));
  const last = lines.findLastIndex((line) => line.trim().length > 0);
  if (first < 0 || !new RegExp(`^\\s*${expectedEnd}\\s*;\\s*$`, "i").test(lines[last])) {
    throw new Error(`${path} no longer has the expected transaction wrapper`);
  }
  const body = lines.slice(first + 1, last).join("\n");
  if (/^\s*(begin|commit|rollback)\s*;\s*$/im.test(body)) {
    throw new Error(`${path} contains another transaction boundary`);
  }
  return body;
}

const sql = `begin;\n${transactionBody(migrationPath, "commit")}\n${transactionBody(testPath, "rollback")}\nrollback;\n`;
const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
let output;
try {
  output = execFileSync(docker, ["exec", "-i", "supabase_db_plates", "psql",
    "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "-"], {
    input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
  });
} catch (error) {
  console.error(String(error.stderr || error.message).trim());
  process.exit(1);
}
const marker = output.split("\n").find((line) => line.trim() === "PASS account erasure transaction");
if (!marker) throw new Error("Account erasure test did not produce its PASS marker");
console.log(marker.trim());
