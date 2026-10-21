"use server";

import { createActionClient } from "@/lib/supabase/server";
import { createLocalErasureAdmin, localErasureEnabled, openLocalErasureStore,
  requestRecordedErasure } from "../../../scripts/local-erasure-workflow.mjs";

export async function requestAccountErasure(confirmation: string) {
  try {
    if (confirmation !== "ERASE") return { accepted: false };
    const client = await createActionClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || !localErasureEnabled(process.env,user.id)) return { accepted: false };
    const store = await openLocalErasureStore();
    const admin = createLocalErasureAdmin();
    return await requestRecordedErasure({authId:user.id,store,rpc:async(name,args)=>{
      const {data,error:rpcError}=await admin.rpc(name,args);
      if(rpcError) throw new Error("Erasure request unavailable");
      return data;
    }});
  } catch {
    // Never return internal errors, paths, keys or database receipts to the browser.
    return { accepted: false };
  }
}
