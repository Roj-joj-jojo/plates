"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function AccountActivity() {
  const pathname=usePathname();
  useEffect(()=>{
    if(!isSupabaseConfigured()||pathname==="/signin")return;
    const client=createClient();let disposed=false,pending=false,lastInteraction=Date.now(),unavailable=false;
    async function pulse() {
      if(disposed||pending||unavailable||document.visibilityState!=="visible"||Date.now()-lastInteraction>5*60*1000)return;
      pending=true;
      try {
        const {data:{user},error}=await client.auth.getUser();
        if(disposed||error||!user)return;
        const {error:activityError}=await client.rpc("record_account_activity");
        if(activityError&&["PGRST202","42883"].includes(activityError.code))unavailable=true;
      } catch { /* Activity is best effort; never interrupt the user's task. */ }
      finally {pending=false;}
    }
    function interact() {lastInteraction=Date.now();}
    function visible() {if(document.visibilityState==="visible"){interact();void pulse();}}
    window.addEventListener("pointerdown",interact,{passive:true});
    window.addEventListener("keydown",interact);
    window.addEventListener("scroll",interact,{passive:true});
    document.addEventListener("visibilitychange",visible);
    void pulse();const timer=window.setInterval(()=>{void pulse();},60_000);
    return ()=>{disposed=true;window.clearInterval(timer);window.removeEventListener("pointerdown",interact);
      window.removeEventListener("keydown",interact);window.removeEventListener("scroll",interact);
      document.removeEventListener("visibilitychange",visible);};
  },[pathname]);
  return null;
}
