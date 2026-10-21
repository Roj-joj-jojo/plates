// Exact retained local fixture scope only; no account deletion, cleanup or worker.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, appendFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";
import { createLocalErasureAdmin } from "./local-erasure-workflow.mjs";

assert.equal(process.argv[2], "--approved-scope");
assert.equal(process.argv.length, 4);
const scopePath = process.argv[3];
assert.match(scopePath, /^\/private\/tmp\/plates-edge-cases-[A-Za-z0-9]+\/scope\.json$/);
const scope = JSON.parse(await readFile(scopePath, "utf8"));
assert.equal(scope.version, 1);
const journalPath = dirname(scopePath) + "/results.jsonl";
let started = false;
const clients = [], people = [], tables = new Set();
async function journal(event, data = {}) { await appendFile(journalPath, JSON.stringify({ event, ...data }) + "\n"); }
async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name} refused (${error.code})`);
  return data;
}
async function row(client, view, id) {
  const { data, error } = await client.from(view).select("*").eq("id", id).single();
  assert.equal(error, null, `${view} fixture read failed`);
  return data;
}
async function race(calls, permittedCodes) {
  const results = await Promise.all(calls.map(call => call()));
  assert.equal(results.filter(result => !result.error).length, 1, "race must have exactly one winner");
  const error = results.find(result => result.error)?.error;
  assert(permittedCodes.includes(error?.code), `unexpected race failure ${error?.code}`);
  return results;
}
async function passed(label) { await journal("passed", { label }); console.log(`PASS ${label}`); }
async function table(admin, definition, profileIds) {
  const id = await rpc(admin, "create_table_with_members", { p_name: definition.name, p_profile_ids: profileIds });
  tables.add(id); await journal("table", { label: definition.label, groupId: id, name: definition.name });
  return id;
}
async function members(client, group) {
  assert(tables.has(group));
  return rpc(client, "table_members", { p_group_id: group });
}
async function render(person, path, permittedStatuses = [200]) {
  const cookies = new Map();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: values => { for (const cookie of values) cookies.set(cookie.name, cookie.value); } },
  });
  const { error } = await client.auth.setSession(person.session);
  assert.equal(error, null);
  const response = await fetch(`http://127.0.0.1:3000${path}`, {
    headers: { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") },
    redirect: "manual", signal: AbortSignal.timeout(60_000),
  });
  assert(permittedStatuses.includes(response.status), "authenticated local render returned unexpected status");
  return response.text();
}
async function signedRead(url, expected) {
  const parsed = new URL(url);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname));
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  assert.equal(response.ok, expected, "signed photo delivery differed from expectation");
}

try {
  const admin = createLocalErasureAdmin();
  // Refuse a second mutation run; inspect retained state before preparing another scope.
  await writeFile(journalPath, JSON.stringify({ event: "started", run: scope.run }) + "\n", { flag: "wx", mode: 0o600 });
  started = true;
  const original = (await readFile(scope.fixtureJournal, "utf8")).trim().split("\n").map(line => JSON.parse(line));
  const fixtureScope = original.find(event => event.event === "scope");
  assert.equal(scope.accounts.length, 3);
  assert.equal(scope.tables.length, 4);
  assert.equal(scope.photos.length, 2);
  for (const approved of scope.accounts) {
    assert(original.some(item => item.event === "auth-created" && item.label === approved.label && item.authId === approved.authId));
    assert(original.some(item => item.event === "profile-ready" && item.label === approved.label && item.profileId === approved.profileId));
    const expectedEmail = fixtureScope.accounts.find(person => person.label === approved.label)?.email;
    assert.match(expectedEmail, /^plates-social-(author|peer|outsider)-[0-9a-f-]+@example\.test$/);
    const { data: existing, error } = await admin.auth.admin.getUserById(approved.authId);
    assert.equal(error, null); assert.equal(existing.user.email, expectedEmail);
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: expectedEmail });
    assert.equal(linkError, null);
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    clients.push(client);
    const { data: login, error: loginError } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
    assert.equal(loginError, null);
    const { data: profile, error: profileError } = await client.from("my_profile").select("id").single();
    assert.equal(profileError, null); assert.equal(profile.id, approved.profileId);
    people.push({ ...approved, client, session: { access_token: login.session.access_token, refresh_token: login.session.refresh_token }, username: await rpc(client, "my_username") });
  }
  const [author, peer, outsider] = people;

  const dual = await table(author.client, scope.tables[0], [peer.profileId]);
  await rpc(author.client, "set_table_admin", { p_group_id: dual, p_profile_id: peer.profileId, p_admin: true });
  await race([
    () => author.client.rpc("set_table_admin", { p_group_id: dual, p_profile_id: author.profileId, p_admin: false }),
    () => peer.client.rpc("set_table_admin", { p_group_id: dual, p_profile_id: peer.profileId, p_admin: false }),
  ], ["23514"]);
  const afterSelf = await members(author.client, dual);
  assert.equal(afterSelf.filter(member => member.role === "owner").length, 1);
  const survivor = afterSelf.find(member => member.role === "owner").profile_id === author.profileId ? author : peer;
  const demoted = survivor === author ? peer : author;
  await rpc(survivor.client, "set_table_admin", { p_group_id: dual, p_profile_id: demoted.profileId, p_admin: true });
  await race([
    () => author.client.rpc("set_table_admin", { p_group_id: dual, p_profile_id: peer.profileId, p_admin: false }),
    () => peer.client.rpc("set_table_admin", { p_group_id: dual, p_profile_id: author.profileId, p_admin: false }),
  ], ["42501"]);
  const afterOther = await members(author.client, dual);
  assert.equal(afterOther.filter(member => member.role === "owner").length, 1);
  const remaining = afterOther.find(member => member.role === "owner").profile_id === author.profileId ? author : peer;
  await rpc(remaining.client, "set_table_admin", { p_group_id: dual, p_profile_id: (remaining === author ? peer : author).profileId, p_admin: true });
  const leaves = await race([
    () => author.client.rpc("leave_table", { p_group_id: dual }),
    () => peer.client.rpc("leave_table", { p_group_id: dual }),
  ], ["23514"]);
  const staying = leaves[0].error ? author : peer;
  assert.equal((await members(staying.client, dual)).filter(member => member.role === "owner").length, 1);
  await passed("simultaneous self-demotion, cross-demotion and Admin departure retain one Admin");

  const replacement = await table(author.client, scope.tables[1], [peer.profileId]);
  const handoff = await race([
    () => author.client.rpc("leave_table", { p_group_id: replacement, p_replacement_id: peer.profileId }),
    () => peer.client.rpc("leave_table", { p_group_id: replacement }),
  ], ["23514"]);
  const replacementOwner = handoff[0].error ? author : peer;
  assert.equal((await members(replacementOwner.client, replacement)).filter(member => member.role === "owner").length, 1);
  await passed("replacement racing with member departure never leaves an Admin-less Table");

  const closure = await table(author.client, scope.tables[2], [peer.profileId]);
  const closureResults = await Promise.all([
    author.client.rpc("leave_table", { p_group_id: closure, p_close: true }),
    author.client.rpc("add_table_members", { p_group_id: closure, p_profile_ids: [outsider.profileId] }),
  ]);
  if (!closureResults[0].error) {
    assert(closureResults[1].error === null || closureResults[1].error.code === "42501");
    for (const person of people) assert.equal((await person.client.rpc("table_members", { p_group_id: closure })).error?.code, "42501");
  } else {
    assert.equal(closureResults[0].error.code, "40001"); assert.equal(closureResults[1].error, null);
    assert.equal((await members(author.client, closure)).filter(member => member.role === "owner").length, 1);
  }
  await passed("closure racing with member addition remains closed or requests fresh review");

  const group = await table(author.client, scope.tables[3], [peer.profileId]);
  const message = await rpc(peer.client, "post_message", { p_group_id: group, p_client_request_id: randomUUID(), p_body: "Edit/remove race fixture" });
  await journal("message", { id: message, purpose: "edit-remove-race" });
  const originalMessage = await row(peer.client, "timeline_content", message);
  await race([
    () => peer.client.rpc("edit_table_content", { p_entry_id: message, p_expected_updated_at: originalMessage.updated_at, p_body: "Changed race fixture" }),
    () => author.client.rpc("remove_table_content", { p_entry_id: message, p_expected_updated_at: originalMessage.updated_at }),
  ], ["40001", "42501"]);
  const finalMessage = await row(peer.client, "timeline_content", message);
  assert(finalMessage.availability === "removed" ? finalMessage.body === "" : finalMessage.body === "Changed race fixture");
  await passed("concurrent edit/removal cannot overwrite a newer version or resurrect removed text");

  const request = await rpc(peer.client, "post_table_request", { p_group_id: group, p_client_request_id: randomUUID(), p_question: "Race Request question" });
  await journal("request", { id: request });
  const { data: thread, error: threadError } = await peer.client.from("threads").select("id").eq("root_entry_id", request).single();
  assert.equal(threadError, null);
  const reply = await rpc(peer.client, "reply_to_thread", { p_thread_id: thread.id, p_client_request_id: randomUUID(), p_body: `Kept reply @${author.username}` });
  await journal("reply", { id: reply, root: request });
  const requestVersion = await row(peer.client, "timeline_content", request);
  const rootRace = await Promise.all([
    author.client.rpc("remove_table_content", { p_entry_id: request, p_expected_updated_at: requestVersion.updated_at }),
    peer.client.rpc("reply_to_thread", { p_thread_id: thread.id, p_client_request_id: randomUUID(), p_body: "Concurrent new reply" }),
  ]);
  assert.equal(rootRace[0].error, null);
  assert(rootRace[1].error === null || rootRace[1].error.code === "42501");
  if (rootRace[1].data) await journal("reply", { id: rootRace[1].data, root: request });
  assert.equal((await row(peer.client, "reply_content", reply)).availability, "available");
  const requestHtml = await render(author, `/tables/${group}/requests/${request}`);
  assert(requestHtml.includes("Request withdrawn. Existing replies remain below."));
  assert(requestHtml.includes(`id="reply-${reply}"`));
  assert((await rpc(author.client, "my_mention_notifications")).some(item => item.url.endsWith(`#reply-${reply}`)));
  await passed("withdrawal racing with a reply retains prior replies and renders their notification context");

  const old = await rpc(peer.client, "post_message", { p_group_id: group, p_client_request_id: randomUUID(), p_body: `Older mention fixture @${author.username}` });
  await journal("message", { id: old, purpose: "older-mention" });
  for (let i = 0; i < 51; i += 1) {
    const id = await rpc(peer.client, "post_message", { p_group_id: group, p_client_request_id: randomUUID(), p_body: `History boundary fixture ${i + 1}` });
    await journal("message", { id, purpose: "history-boundary" });
  }
  const ordinaryHtml = await render(author, `/tables/${group}`);
  assert(!ordinaryHtml.includes(`id="entry-${old}"`));
  const targetHtml = await render(author, `/tables/${group}?entry=${old}`);
  assert(targetHtml.includes(`id="entry-${old}"`));
  assert(targetHtml.includes("Mentioned message"));
  const notificationsHtml = await render(author, "/notifications");
  assert(notificationsHtml.includes(`/tables/${group}?entry=${old}#entry-${old}`));
  const oldRow = await row(peer.client, "timeline_content", old);
  await rpc(author.client, "remove_table_content", { p_entry_id: old, p_expected_updated_at: oldRow.updated_at });
  assert((await render(author, `/tables/${group}?entry=${old}`)).includes("The mentioned message is no longer available in this Table."));
  assert(!(await rpc(author.client, "my_mention_notifications")).some(item => item.url.includes(old)));
  const outsiderHtml = await render(outsider, `/tables/${group}?entry=${old}`, [200, 404]);
  assert(!outsiderHtml.includes("History boundary fixture"));
  await passed("older mention navigation, missing targets and outsider rendering preserve visibility boundaries");

  const pixels = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#326b49" } }).webp().toBuffer();
  const tablePhoto = scope.photos.find(photo => photo.bucket === "table-media");
  const platePhoto = scope.photos.find(photo => photo.bucket === "plate-media");
  for (const photo of [tablePhoto, platePhoto]) {
    const isTable = photo.bucket === "table-media";
    const intents = await rpc(peer.client, isTable ? "request_table_upload" : "request_plate_upload", isTable ? { p_group_id: group } : {});
    const intent = intents[0];
    const path = isTable ? `${group}/${photo.assetId}.webp` : `${photo.assetId}.webp`;
    await journal("photo-intent", { intentId: intent.intent_id, bucket: photo.bucket, objectPath: path, assetId: photo.assetId });
    const { error: processingError } = await admin.from(isTable ? "table_upload_intents" : "media_upload_intents").update({ state: "processing" }).eq("id", intent.intent_id);
    assert.equal(processingError, null);
    const { error: uploadError } = await admin.storage.from(photo.bucket).upload(path, pixels, { contentType: "image/webp", upsert: false });
    assert.equal(uploadError, null);
    await rpc(admin, isTable ? "finish_table_upload" : "finish_plate_upload", { p_intent_id: intent.intent_id, p_asset_id: photo.assetId, p_object_path: path, p_width: 2, p_height: 2 });
    photo.path = path;
  }
  const photoMessage = await rpc(peer.client, "post_message", { p_group_id: group, p_client_request_id: randomUUID(), p_body: "Photo removal fixture", p_attachment_ids: [tablePhoto.assetId] });
  await journal("message", { id: photoMessage, purpose: "photo-removal" });
  const { data: signedTable, error: tableSignError } = await author.client.storage.from("table-media").createSignedUrl(tablePhoto.path, 3);
  assert.equal(tableSignError, null); await signedRead(signedTable.signedUrl, true);
  const photoRow = await row(peer.client, "timeline_content", photoMessage);
  await rpc(author.client, "remove_table_content", { p_entry_id: photoMessage, p_expected_updated_at: photoRow.updated_at });
  assert(!(await rpc(author.client, "table_image_locations", { p_group_id: group })).some(item => item.entry_id === photoMessage));
  assert((await author.client.storage.from("table-media").createSignedUrl(tablePhoto.path, 60)).error);
  await new Promise(resolve => setTimeout(resolve, 4500));
  await signedRead(signedTable.signedUrl, false);
  await passed("removed Table photo denies new signing and an existing short-lived URL expires");

  const { data: category, error: categoryError } = await peer.client.from("categories").select("id").eq("slug", "meal").single();
  assert.equal(categoryError, null);
  const plate = await rpc(peer.client, "publish_plate", { p_category_id: category.id, p_body: "Photo Plate fixture", p_attachment_ids: [platePhoto.assetId] });
  await journal("plate", { id: plate });
  const share = await rpc(peer.client, "share_plate", { p_group_id: group, p_plate_id: plate, p_client_request_id: randomUUID(), p_body: "Photo Plate share fixture" });
  await journal("share", { id: share, plate });
  // Saving a photo Plate requires a ready private preview, so verify snapshot retention
  // using a second text-only Plate instead of bypassing the preview pipeline.
  const textPlate = await rpc(peer.client, "publish_plate", { p_category_id: category.id, p_body: "Retained snapshot fixture" });
  await journal("plate", { id: textPlate });
  const save = await rpc(author.client, "save_plate", { p_plate_id: textPlate, p_expected_revision: 1 });
  await journal("save", { id: save, plate: textPlate });
  await rpc(peer.client, "unpublish_plate", { p_plate_id: textPlate, p_expected_revision: 1 });
  assert.equal((await row(author.client, "menu_plate_saves", save)).snapshot_body, "Retained snapshot fixture");
  await rpc(peer.client, "edit_plate", { p_plate_id: plate, p_expected_revision: 1, p_category_id: category.id,
    p_body: "Updated Photo Plate fixture", p_attachment_ids: [platePhoto.assetId] });
  assert.equal((await peer.client.rpc("unpublish_plate", { p_plate_id: plate, p_expected_revision: 1 })).error?.code, "40001");
  const { data: signedPlate, error: plateSignError } = await author.client.storage.from("plate-media").createSignedUrl(platePhoto.path, 3);
  assert.equal(plateSignError, null); await signedRead(signedPlate.signedUrl, true);
  await race([
    () => peer.client.rpc("edit_plate", { p_plate_id: plate, p_expected_revision: 2, p_category_id: category.id,
      p_body: "Concurrent Photo Plate edit", p_attachment_ids: [platePhoto.assetId] }),
    () => peer.client.rpc("unpublish_plate", { p_plate_id: plate, p_expected_revision: 2 }),
  ], ["40001", "42501"]);
  const { data: availablePlate } = await peer.client.from("plates").select("revision").eq("id", plate).maybeSingle();
  if (availablePlate) await rpc(peer.client, "unpublish_plate", { p_plate_id: plate, p_expected_revision: availablePlate.revision });
  assert.equal((await rpc(author.client, "plate_image_locations", { p_plate_id: plate })).length, 0);
  assert((await author.client.storage.from("plate-media").createSignedUrl(platePhoto.path, 60)).error);
  await new Promise(resolve => setTimeout(resolve, 4500));
  await signedRead(signedPlate.signedUrl, false);
  const shareHtml = await render(author, `/tables/${group}/discussion/${share}`);
  assert(shareHtml.includes("This Plate is no longer available. The discussion remains here."));
  await passed("Plate revision races, unpublish photo denial/URL expiry, retained Menu snapshot and share context");
  await journal("complete", { retained: true, limits: "server-render/API/storage/concurrency acceptance; no interactive browser click or full one-hour wait" });
  console.log("PASS local edge acceptance; retained scope:", dirname(scopePath));
} catch (error) {
  if (started) await journal("failed", { message: String(error.message).slice(0,300) });
  console.error("Local edge check failed:", error.message); console.error("Retain scope:", dirname(scopePath));
  process.exitCode = 1;
} finally {
  await Promise.allSettled(clients.map(client => client.realtime.disconnect()));
}
