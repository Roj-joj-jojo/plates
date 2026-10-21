import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const migration="supabase/migrations/20261010000500_recorded_account_erasure.sql";
const applied=process.argv[2]==="--applied";
if(process.argv.length>3 || (process.argv[2] && !applied)) throw new Error("Use no arguments for candidate or --applied for installed schema");
function body(path,end) {
  const lines=readFileSync(path,"utf8").split("\n");
  const first=lines.findIndex(line=>/^begin;\s*$/.test(line));
  const last=lines.findLastIndex(line=>line.trim());
  if(first<0||lines[last].trim()!==end+";")throw new Error("Unexpected transaction wrapper");
  return lines.slice(first+1,last).join("\n");
}
try {
  for(const path of ["supabase/tests/recorded_account_erasure.sql","supabase/tests/account_erasure.sql"]) {
    const sql=`begin;\n${applied ? "" : body(migration,"commit")}\n${body(path,"rollback")}\nrollback;`;
    const output=execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",["exec","-i","supabase_db_plates","psql",
      "-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-f","-"],{input:sql,encoding:"utf8",stdio:["pipe","pipe","pipe"]});
    const marker=output.split("\n").find(line=>line.trim().startsWith("PASS "));
    if(!marker)throw new Error("Missing PASS marker");console.log(marker.trim());
  }
} catch(error) {
  // This runner contains only synthetic SQL values; expose the SQLSTATE, not data.
  const line=String(error.stderr??"").match(/ERROR:\s+([^\n]+)/)?.[1];
  console.error(line ? `Candidate SQL failed: ${line.replace(/"[^"]*"|'[^']*'/g,"[identifier]")}` : "Candidate SQL checks failed/refused");
  process.exitCode=1;
}
