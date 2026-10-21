// Two-phase local-only owner setup. Prepare reads one account; apply needs exact approval.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { createLocalErasureAdmin } from "./local-erasure-workflow.mjs";
import { readPrivateFile,privateDirectory } from "./encrypted-backup.mjs";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=value=>createHash("sha256").update(value).digest("hex");
function check(ok,message) { if(!ok)throw new Error(message); }
function query(where) {
  const output=execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",["exec","-i","supabase_db_plates",
    "psql","-X","-qAt","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-f","-"],
  {input:`begin read only; select coalesce(json_agg(json_build_object('authId',u.id,'profileId',p.id,
    'email',lower(btrim(u.email)),'confirmed',u.email_confirmed_at is not null,'active',p.state='active')),'[]')
    from auth.users u join private.profile_auth_links l on l.auth_user_id=u.id
    join public.profiles p on p.id=l.profile_id where ${where}; commit;`,
    encoding:"utf8",stdio:["pipe","pipe","pipe"]});
  return JSON.parse(output.trim());
}
try {
  const mode=process.argv[2];
  check(mode==="--prepare"||mode==="--apply-approved","Use --prepare or --apply-approved SCOPE_FOLDER");
  check(process.argv.length===(mode==="--prepare"?3:4),"Unexpected setup arguments");
  const admin=createLocalErasureAdmin(); // Verifies loopback/project match; credential stays in memory.
  if(mode==="--prepare") {
    const prompt=createInterface({input:process.stdin,output:process.stdout});
    let email;
    try { email=(await prompt.question("Selected owner email: ")).trim().toLowerCase(); }
    finally { prompt.close(); }
    check(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),"Enter the selected owner email");
    const encoded=Buffer.from(email).toString("base64");
    const rows=query(`lower(btrim(u.email))=convert_from(decode('${encoded}','base64'),'UTF8')`);
    check(rows.length===1&&rows[0].active&&rows[0].confirmed,
      "Selected account is not yet active and verified in local Plates; create/sign in to it first");
    const row=rows[0];check(uuid.test(row.profileId)&&uuid.test(row.authId),"Invalid owner identity");
    const folder=await mkdtemp("/private/tmp/plates-allowlist-owner-");
    await privateDirectory(folder);
    await writeFile(resolve(folder,"owner.json"),JSON.stringify({version:1,localUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
      profileId:row.profileId,authId:row.authId,emailHash:hash(row.email)})+"\n",{flag:"wx",mode:0o600});
    await writeFile(resolve(folder,"scope.md"),`# Local allowlist owner activation\n\nAppoint only verified active profile \`${row.profileId}\`,
linked to Auth identity \`${row.authId}\`, as the app allowlist owner. Activate the signup guard; preserve all existing accounts.
No accounts, content, files or Storage objects are deleted. No emails are sent. The selected email was checked without embedding it in this scope.
\nRun from the project folder after exact approval:\n\n\`node --env-file=.env.local scripts/local-allowlist-owner.mjs --apply-approved '${folder}'\`\n`,
    {flag:"wx",mode:0o600});
    console.log(`PREPARED ${folder}/scope.md; owner not appointed and guard not activated`);
  } else {
    const folder=await privateDirectory(process.argv[3]);
    check(folder.startsWith("/private/tmp/plates-allowlist-owner-"),"Use the reviewed setup scope folder");
    const scope=JSON.parse((await readPrivateFile(resolve(folder,"owner.json"),16384)).toString());
    check(scope.version===1&&uuid.test(scope.profileId)&&uuid.test(scope.authId)
      && /^[0-9a-f]{64}$/.test(scope.emailHash)&&scope.localUrl===process.env.NEXT_PUBLIC_SUPABASE_URL,"Setup scope mismatch");
    const rows=query(`u.id='${scope.authId}'::uuid and p.id='${scope.profileId}'::uuid`);
    check(rows.length===1&&rows[0].active&&rows[0].confirmed&&hash(rows[0].email)===scope.emailHash,
      "Selected owner identity changed; prepare a new scope");
    const {error}=await admin.rpc("activate_signup_allowlist",{p_owner_profile_id:scope.profileId});
    check(!error,"Owner activation refused/failed; do not change the scope to bypass refusal");
    // Status is deliberately granted to anon/authenticated, not the setup service.
    const statusClient=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error:statusError}=await statusClient.rpc("app_access_status");
    check(!statusError&&data?.enabled===true,"Activation status could not be verified");
    console.log("PASS selected owner appointed; signup allowlist activated; existing accounts preserved");
  }
} catch(error) {
  // Database/CLI diagnostics may contain identities or credentials; never print them.
  console.error(error?.message?.startsWith("Selected")?error.message:"Local owner setup failed/refused; no automatic recovery or cleanup attempted");
  process.exitCode=1;
}
