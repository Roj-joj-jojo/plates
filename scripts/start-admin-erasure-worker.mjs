import { spawn } from "node:child_process";
import { mkdtemp,open } from "node:fs/promises";
import { resolve } from "node:path";
import { createLocalErasureAdmin,openLocalErasureStore,verifyWorkerIntent } from "./local-erasure-workflow.mjs";

export async function startAdminErasureWorker(profileId,env=process.env) {
  if(env.APP_ADMIN_ACCOUNT_ERASURE_ENABLED!=="true"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) throw new Error("Admin cleanup disabled");
  const admin=createLocalErasureAdmin(env),store=await openLocalErasureStore(env);
  await verifyWorkerIntent({store,profileId,rpc:async(name,args)=>{
    const {data,error}=await admin.rpc(name,args);if(error)throw new Error("Receipt unavailable");return data;
  }});
  const folder=await mkdtemp("/private/tmp/plates-admin-cleanup-");
  const log=await open(resolve(folder,"worker.log"),"wx",0o600);
  try {
    const child=spawn(process.execPath,["--env-file=.env.local","scripts/local-media-worker.mjs","--erasure-job",profileId],
      {cwd:process.cwd(),env,detached:true,stdio:["ignore",log.fd,log.fd]});
    await new Promise((accept,reject)=>{child.once("spawn",accept);child.once("error",reject);});
    child.unref();
  } finally {await log.close();}
}
