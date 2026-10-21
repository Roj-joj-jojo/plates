import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const applied=process.argv[2]==="--applied";
if(process.argv.length>3 || (process.argv[2]&&!applied)) throw new Error("Use no argument for candidate or --applied for installed schema");
function body(path,end) {
  const lines=readFileSync(path,"utf8").split("\n");
  const first=lines.findIndex(line=>/^begin;\s*$/.test(line));
  const last=lines.findLastIndex(line=>line.trim());
  if(first<0||lines[last].trim()!==end+";")throw new Error("Unexpected transaction wrapper");
  return lines.slice(first+1,last).join("\n");
}
try {
  const sql=`begin;\n${applied?"":body("supabase/migrations/20261011000100_signup_allowlist.sql","commit")}\n${body("supabase/tests/signup_allowlist.sql","rollback")}\nrollback;`;
  const output=execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",["exec","-i","supabase_db_plates","psql",
    "-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-f","-"],
  {input:sql,encoding:"utf8",stdio:["pipe","pipe","pipe"]});
  const marker=output.split("\n").find(line=>line.trim().startsWith("PASS signup allowlist"));
  if(!marker)throw new Error("Missing acceptance marker");console.log(marker.trim());
} catch(error) {
  const line=String(error.stderr??"").match(/ERROR:\s+([^\n]+)/)?.[1];
  console.error(line?`Allowlist SQL failed: ${line.replace(/"[^"]*"|'[^']*'/g,"[identifier]")}`:"Allowlist SQL checks refused/failed");
  process.exitCode=1;
}
