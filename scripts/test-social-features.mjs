import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const feature=process.argv[2],applied=process.argv[3]==="--applied";
const migrations={usernames:"20261011000300_usernames_mentions.sql",tables:"20261011000400_table_membership.sql",updates:"20261011000500_conversation_updates.sql"};
if(!migrations[feature]||process.argv.length>4||(process.argv[3]&&!applied))throw new Error("Use usernames|tables|updates and optional --applied");
function body(path,end){const lines=readFileSync(path,"utf8").split("\n"),first=lines.findIndex(line=>line.trim()==="begin;"),last=lines.findLastIndex(line=>line.trim());
  if(first<0||lines[last].trim()!==end+";")throw new Error("Unexpected transaction wrapper");return lines.slice(first+1,last).join("\n");}
try {
  const sql=`begin;\n${applied?"":body((feature==="updates"?"supabase/candidates/":"supabase/migrations/")+migrations[feature],"commit")}\n${body("supabase/tests/"+feature+".sql","rollback")}\nrollback;`;
  const output=execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",["exec","-i","supabase_db_plates","psql","-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-f","-"],{input:sql,encoding:"utf8",stdio:["pipe","pipe","pipe"]});
  const marker=output.split("\n").find(line=>line.trim().startsWith("PASS "+feature));if(!marker)throw new Error("Missing marker");console.log(marker.trim());
} catch(error){const line=String(error.stderr??"").match(/ERROR:\s+([^\n]+)/)?.[1];console.error(line?`Social SQL failed: ${line.replace(/"[^"]*"|'[^']*'/g,"[identifier]")}`:"Social SQL checks refused/failed");process.exitCode=1;}
