// Retained, labelled local fixtures only; no erasure, Storage, worker or email send.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp,appendFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createLocalErasureAdmin } from "./local-erasure-workflow.mjs";
if(process.argv.length!==3||process.argv[2]!=="--approved-local-fixtures")throw new Error("Exact local fixture permission required");
const admin=createLocalErasureAdmin(),run=randomUUID(),suffix=run.replaceAll("-","").slice(0,12);
const root=await mkdtemp("/private/tmp/plates-social-http-");
const clients=[],channels=[];
async function journal(event,data){await appendFile(root+"/scope.jsonl",JSON.stringify({event,...data})+"\n",{mode:0o600});}
const people=["Author","Peer","Outsider"].map(label=>({label,email:`plates-social-${label.toLowerCase()}-${run}@example.test`,username:`Alpha${label}_${suffix}`}));
await journal("scope",{run,accounts:people,limits:"Three labelled accounts, two labelled Tables, username/membership changes, one Request, one reply and three messages; retained, no erasure/Storage/worker/email"});
const addresses=people.map(person=>`select public.allow_signup_email('${person.email}');`).join("\n");
const admission=`begin; select set_config('request.jwt.claim.role','authenticated',true); select set_config('request.jwt.claim.sub',(select l.auth_user_id::text from private.app_admission_settings s join private.profile_auth_links l on l.profile_id=s.owner_profile_id where s.singleton),true); set local role authenticated; ${addresses} commit;`;
execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker",["exec","-i","supabase_db_plates","psql","-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-f","-"],{input:admission,stdio:["pipe","ignore","pipe"]});
async function rpc(client,name,args={}){const {data,error}=await client.rpc(name,args);if(error)throw new Error(`Local RPC refused: ${name} (${error.code})`);return data;}
async function refused(client,name,args,code){const {error}=await client.rpc(name,args);assert.equal(error?.code,code);}
async function waitFor(check,label){const deadline=Date.now()+20_000;while(!check()){if(Date.now()>deadline)throw new Error(`Timed out: ${label}`);await new Promise(resolve=>setTimeout(resolve,100));}}
async function subscribe(client,table,key,id,events){
  const channel=client.channel(`fixture-${randomUUID()}`).on("postgres_changes",{event:"*",schema:"public",table,filter:`${key}=eq.${id}`},payload=>events.push(payload.new));
  channels.push({client,channel});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Local Realtime subscription timed out")),20_000);
    channel.subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timer);resolve();}else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){clearTimeout(timer);reject(new Error("Local Realtime subscription failed"));}});
  });
}
try {
  for(const person of people){
    const {data:created,error}=await admin.auth.admin.createUser({email:person.email,email_confirm:true,user_metadata:{display_name:`Social HTTP ${person.label} fixture`}});
    if(error)throw new Error("Fixture account creation refused");
    await journal("auth-created",{label:person.label,authId:created.user.id});
    const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:"magiclink",email:person.email});
    if(linkError)throw new Error("Fixture sign-in link refused");
    const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    clients.push(client);
    const {error:verifyError}=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:"magiclink"});
    if(verifyError)throw new Error("Fixture session verification refused");
    const {data:profile,error:profileError}=await client.from("my_profile").select("id").single();
    if(profileError)throw new Error("Fixture profile read refused");
    person.profileId=profile.id;person.client=client;
    await rpc(client,"choose_username",{p_username:person.username});
    await journal("profile-ready",{label:person.label,profileId:profile.id,username:person.username});
  }
  const [author,peer,outsider]=people;
  await refused(outsider.client,"choose_username",{p_username:peer.username.toLowerCase()},"23514"); // Fixed account cannot rename.
  const group=await rpc(author.client,"create_table_with_members",{p_name:`Social HTTP ${suffix}`,p_profile_ids:[peer.profileId]});
  await journal("table-created",{groupId:group,label:"main"});
  assert.equal((await rpc(peer.client,"table_members",{p_group_id:group})).length,2);
  await refused(outsider.client,"table_members",{p_group_id:group},"42501");
  await refused(peer.client,"add_table_members",{p_group_id:group,p_profile_ids:[outsider.profileId]},"42501");
  await refused(author.client,"set_table_admin",{p_group_id:group,p_profile_id:author.profileId,p_admin:false},"23514");
  const peerEvents=[],ownerEvents=[],outsiderEvents=[],notificationEvents=[];
  await Promise.all([subscribe(peer.client,"conversation_updates","group_id",group,peerEvents),subscribe(author.client,"conversation_updates","group_id",group,ownerEvents),subscribe(outsider.client,"conversation_updates","group_id",group,outsiderEvents),subscribe(peer.client,"account_updates","profile_id",peer.profileId,notificationEvents)]);
  const requestId=randomUUID(),body=`Hello @${peer.username.toLowerCase()}`;
  const message=await rpc(author.client,"post_message",{p_group_id:group,p_client_request_id:requestId,p_body:body});
  await journal("message-created",{entryId:message});
  assert.equal(await rpc(author.client,"post_message",{p_group_id:group,p_client_request_id:requestId,p_body:body}),message);
  await waitFor(()=>peerEvents.length&&ownerEvents.length&&notificationEvents.length,"member and recipient Realtime signals");
  assert.deepEqual(Object.keys(peerEvents[0]).sort(),["group_id","revision","updated_at"]);
  assert.deepEqual(Object.keys(notificationEvents[0]).sort(),["profile_id","revision","updated_at"]);
  const {data:content,error:contentError}=await peer.client.from("timeline_content").select("body").eq("id",message).single();
  assert(!contentError);assert.equal(content.body,`Hello @[${peer.profileId}]`);
  assert.equal((await rpc(peer.client,"resolve_mentions",{p_ids:[peer.profileId]}))[0].username,peer.username);
  let notifications=await rpc(peer.client,"my_mention_notifications");assert.equal(notifications.length,1);
  await rpc(peer.client,"read_mention_notification",{p_id:notifications[0].id});
  assert((await rpc(peer.client,"my_mention_notifications"))[0].read_at);
  const request=await rpc(author.client,"post_table_request",{p_group_id:group,p_client_request_id:randomUUID(),p_question:"Social fixture question"});
  await journal("request-created",{entryId:request});
  const {data:thread,error:threadError}=await author.client.from("threads").select("id").eq("root_entry_id",request).single();assert(!threadError);
  const beforeReply=peerEvents.length;
  const reply=await rpc(author.client,"reply_to_thread",{p_thread_id:thread.id,p_client_request_id:randomUUID(),p_body:`Reply to @${peer.username}`});
  await journal("reply-created",{replyId:reply});
  await waitFor(()=>peerEvents.length>beforeReply,"reply Realtime signal");
  notifications=await rpc(peer.client,"my_mention_notifications");assert.equal(notifications.length,2);assert(notifications.some(item=>item.url.endsWith(`#reply-${reply}`)));
  await rpc(author.client,"remove_table_member",{p_group_id:group,p_profile_id:peer.profileId});
  await refused(peer.client,"table_members",{p_group_id:group},"42501");
  assert.equal((await rpc(peer.client,"my_mention_notifications")).length,0);
  await new Promise(resolve=>setTimeout(resolve,2000));
  const removedCount=peerEvents.length,ownerCount=ownerEvents.length;
  const afterRemoval=await rpc(author.client,"post_message",{p_group_id:group,p_client_request_id:randomUUID(),p_body:"Only current members can receive this update"});
  await journal("message-created",{entryId:afterRemoval});
  await waitFor(()=>ownerEvents.length>ownerCount,"active owner receives signal after removal");
  await new Promise(resolve=>setTimeout(resolve,1500));assert.equal(peerEvents.length,removedCount);assert.equal(outsiderEvents.length,0);
  await rpc(author.client,"add_table_members",{p_group_id:group,p_profile_ids:[peer.profileId]});
  await rpc(author.client,"set_table_admin",{p_group_id:group,p_profile_id:peer.profileId,p_admin:true});
  await rpc(author.client,"set_table_admin",{p_group_id:group,p_profile_id:peer.profileId,p_admin:false});
  await rpc(author.client,"leave_table",{p_group_id:group,p_replacement_id:peer.profileId});
  assert((await rpc(peer.client,"table_members",{p_group_id:group})).some(item=>item.is_me&&item.role==="owner"));
  await refused(author.client,"table_members",{p_group_id:group},"42501");
  const closed=await rpc(author.client,"create_table_with_members",{p_name:`Social close fixture ${suffix}`,p_profile_ids:[]});
  await journal("table-created",{groupId:closed,label:"closure"});
  await rpc(author.client,"leave_table",{p_group_id:closed,p_close:true});
  await journal("passed",{tests:"Real Auth/RPC/member changes, mention/read/reply privacy, member/recipient WebSocket delivery and outsider/former-member denial",retained:true});
  console.log("PASS local social HTTP/Realtime: selected membership, fixed casing, private linked mentions, deduplicated/read notifications, reply links, actual content-free member/recipient events, outsider/former-member denial, Admin replacement and retained closure; fixtures retained at",root);
} catch(error){console.error("Local social acceptance failed:",error.message);console.error("Retain fixture journal:",root);process.exitCode=1;}
finally {await Promise.allSettled(channels.map(({client,channel})=>client.removeChannel(channel)));await Promise.allSettled(clients.map(client=>client.realtime.disconnect()));}
