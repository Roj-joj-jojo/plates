import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

if (process.argv.length !== 2) throw new Error("No activation or applied mode is supported");
function body(path, end) {
  const lines = readFileSync(path, "utf8").split("\n");
  const first = lines.findIndex(line => line.trim() === "begin;");
  const last = lines.findLastIndex(line => line.trim());
  if (first < 0 || lines[last].trim() !== `${end};`) throw new Error("Unexpected transaction wrapper");
  return lines.slice(first + 1, last).join("\n");
}
try {
  const sql = `begin;\nset local statement_timeout='30s';\nset local lock_timeout='3s';\n${body("supabase/candidates/20261014000100_photo_worker.sql", "commit")}\n${body("supabase/tests/photo_worker_ownership.sql", "rollback")}\nrollback;`;
  const output = execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",
    ["exec", "-i", "supabase_db_plates", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-f", "-"],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 60_000 });
  const marker = output.split("\n").find(line => line.trim().startsWith("PASS photo worker ownership"));
  if (!marker) throw new Error("Missing test marker");
  console.log(marker.trim());
} catch (error) {
  const stderr = String(error.stderr ?? "");
  const state = stderr.match(/ERROR:\s+([0-9A-Z]{5})\b/)?.[1];
  const line = stderr.match(/psql:<stdin>:(\d+):/)?.[1];
  const reason = /permission denied|operation not permitted/i.test(stderr) ? "Docker access denied"
    : /cannot connect|is the docker daemon running|no such container/i.test(stderr) ? "Local Docker database unavailable"
    : state === "P7501" ? "Existing photo processing work; ownership tests intentionally refused"
    : state ? `SQL state ${state}${line ? ` at test input line ${line}` : ""}` : "Runner or database check failed";
  console.error(`Photo worker SQL checks refused/failed: ${reason}; no activation was requested.`);
  process.exitCode = 1;
}
