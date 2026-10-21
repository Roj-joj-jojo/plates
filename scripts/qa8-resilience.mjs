// Owner-approved bounded local rehearsal; no erasure, cleanup, migrations or global polling.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, appendFile, open, readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createLocalErasureAdmin } from "./local-erasure-workflow.mjs";
import { createPhotoBackend } from "./photo-worker-backend.mjs";
import { createPhotoWorker } from "./photo-worker-runtime.mjs";
import { createScopedPhotoBackend } from "./photo-worker-e2e-scope.mjs";

const PEER = "22fdcb4c-f882-4eed-bf2b-9a99b9e179dc";
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function localOrigin(value) {
  const url = new URL(value);
  assert(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  return url.origin;
}
export function take(counts, kind) {
  const limits = { accounts: 3, tables: 1, plates: 1, questions: 1, messages: 6, replies: 6, comments: 4, saves: 1, jobs: 4 };
  assert(Object.hasOwn(limits, kind) && Number.isInteger(counts[kind] ?? 0));
  assert((counts[kind] ?? 0) < limits[kind], `Approved ${kind} budget exhausted`);
  counts[kind] = (counts[kind] ?? 0) + 1;
}
async function selfTest() {
  assert.equal(localOrigin("http://127.0.0.1:54321"), "http://127.0.0.1:54321");
  for (const origin of ["https://example.com", "http://192.168.1.1", "file:///tmp/a"]) assert.throws(() => localOrigin(origin));
  const c = {}; for (let i = 0; i < 3; i++) take(c, "accounts");
  assert.throws(() => take(c, "accounts")); assert.throws(() => take(c, "unknown"));
  // Existing scope helper refuses foreign jobs before any backend operation.
  const id = randomUUID(), ownerId = randomUUID(); let touched = false;
  const scoped = createScopedPhotoBackend({ backend: { claim() { touched = true; } },
    expected: [{ kind: "plate", id, ownerId }], readJobs: async () => [] });
  await assert.rejects(scoped.poll());
  await assert.rejects(scoped.claim({ kind: "plate", id: randomUUID(), data: {} }));
  assert.equal(touched, false);
  console.log("PASS local-origin, fixture-budget and scoped-job refusal checks");
}

async function run(resumeRoot, continuing = false, extraPhotoRetry = false) {
  const origin = localOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert(key);
  // Local service discovery validates the same loopback destination; never prints credentials.
  const admin = createLocalErasureAdmin();
  let root, state;
  if (resumeRoot) {
    const pointer = JSON.parse(await readFile("QA_BATCH_8_RESILIENCE_RUN.json", "utf8"));
    assert.equal(pointer.root, resumeRoot);
    root = resumeRoot; state = JSON.parse(await readFile(root + "/manifest.json", "utf8"));
    assert.equal(pointer.run, state.run); assert.equal(state.root, root); assert.equal(state.origin, origin);
    // Reviewed failure was before the question RPC could execute; no general resume/reset mode.
    assert.equal(state.counts.accounts, 3); assert.equal(state.counts.tables, 1); assert.equal(state.counts.questions, 1);
    assert.equal(state.people.length, 3);
    if (continuing) {
      assert(uuid(state.questionId) && uuid(state.plateId) && uuid(state.threadId));
      assert(state.jobs.length <= (extraPhotoRetry ? 5 : 4) && state.counts.jobs === state.jobs.length);
      if (extraPhotoRetry) assert.equal(state.run, "c2fa96ad-f591-4f8a-ae8c-ac4177932943");
      const events = (await readFile(root + "/events.jsonl", "utf8")).trim().split("\n").map(line => JSON.parse(line));
      assert.equal(events.at(-1).event, "session-finished", "Prior runner must finish before continuation");
      assert(events.some(x => x.event === "passed" && x.label.startsWith("actual 300-second")), "Expiry result must be recorded before session handoff");
    } else { assert.equal(state.jobs.length, 0); assert(!state.questionId && !state.plateId); }
  } else {
    const pointer = await open("QA_BATCH_8_RESILIENCE_RUN.json", "wx", 0o600);
    root = await mkdtemp("/private/tmp/plates-qa8-resilience-");
    state = { version: 1, run: randomUUID(), root, origin, counts: {}, people: [], jobs: [], results: [] };
    await pointer.writeFile(JSON.stringify({ version: 1, root, run: state.run }) + "\n"); await pointer.close();
  }
  const clients = new Map(); let backend = null; let plateSigned = null;
  async function record(event, data = {}) {
    await appendFile(root + "/events.jsonl", JSON.stringify({ at: new Date().toISOString(), event, ...data }) + "\n", { mode: 0o600 });
    await writeFile(root + "/manifest.json", JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  }
  async function pass(label) { state.results.push(label); await record("passed", { label }); console.log("PASS", label); }
  async function rpc(client, name, args = {}) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(`RPC ${name} refused (${error.code ?? "unknown"})`);
    return data;
  }
  async function rows(client, table, column, value, fields = "*") {
    const { data, error } = await client.from(table).select(fields).eq(column, value);
    if (error) throw new Error(`Read ${table} refused (${error.code ?? "unknown"})`);
    return data ?? [];
  }
  const clientFor = fetcher => createClient(origin, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: fetcher ? { fetch: fetcher } : undefined });
  const anon = clientFor();
  async function cloneSession(client, fetcher) {
    const { data } = await client.auth.getSession(); assert(data.session);
    const clone = clientFor(fetcher);
    const result = await clone.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    assert(!result.error); return clone;
  }
  async function privacy(client, value) {
    const current = (await rpc(client, "my_privacy"))[0]; assert(current);
    await rpc(client, "set_my_privacy", { p_private: value, p_expected_version: current.version });
  }
  async function processJobs(specs) {
    assert(specs.length && specs.every(spec => state.jobs.some(job => job.id === spec.id)));
    const runId = randomUUID();
    await rpc(admin, "photo_worker_open", { p_run_id: runId });
    backend = createPhotoBackend(admin, runId);
    await record("worker-opened", { runId, jobs: specs.map(x => x.id) });
    const readJobs = async expected => Promise.all(expected.map(async spec => {
      const table = spec.kind === "plate" ? "media_upload_intents" : spec.kind === "table" ? "table_upload_intents" : "menu_preview_jobs";
      const data = (await rows(admin, table, "id", spec.id))[0]; assert(data);
      return { kind: spec.kind, id: spec.id, data };
    }));
    const scoped = createScopedPhotoBackend({ backend, expected: specs, readJobs });
    try {
      const result = await createPhotoWorker({ backend: scoped }).tick();
      assert.equal(result.stopped, false); assert.equal((await scoped.poll()).jobs.length, 0);
      const entries = [...scoped.entries.values()];
      await record("worker-completed", { runId, completed: result.totals.completed, rejected: result.totals.rejected });
      assert.equal(await backend.close(), true); backend = null;
      await record("worker-drained", { runId }); return entries;
    } catch (error) {
      // No old-run recovery or forced release: preserve uncertain ownership for investigation.
      await record("worker-failure", { runId, note: "Preserve ownership; no automatic recovery" }); throw error;
    }
  }
  async function setup() {
    const suffix = state.run.replaceAll("-", "").slice(0, 10);
    if (continuing) {
      for (const person of state.people) {
        assert(uuid(person.authId) && uuid(person.profileId) && person.email.endsWith(`-${suffix}@example.test`));
        const actual = await admin.auth.admin.getUserById(person.authId); assert(!actual.error && actual.data.user.email === person.email);
        const link = await admin.auth.admin.generateLink({ type: "magiclink", email: person.email }); assert(!link.error);
        const client = clientFor(); const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" }); assert(!verified.error);
        const profile = await client.from("my_profile").select("id").single(); assert(!profile.error && profile.data.id === person.profileId);
        clients.set(person.label, client);
      }
      const A = clients.get("Author");
      const question = (await rows(A, "timeline_content", "id", state.questionId))[0]; assert(question?.group_id === state.groupId);
      const plate = (await rows(A, "plates", "id", state.plateId, "id,author_id"))[0]; assert(plate?.author_id === state.people[0].profileId);
      state.counts.replies = (await rows(A, "reply_content", "thread_id", state.threadId, "id")).length;
      assert(state.counts.replies <= 6);
      await record("reviewed-existing-fixture-continuation");
      console.log(JSON.stringify({ ready: true, continuing: true, root, counts: state.counts })); return;
    }
    if (!resumeRoot) {
    await record("scope-created");
    state.people = ["Author", "Reader", "Outsider"].map(label => ({ label,
      email: `qa8-${label.toLowerCase()}-${suffix}@example.test`, username: `QA8${label}_${suffix}` }));
    const statements = state.people.map(person => { assert(/^[a-z0-9@.\-]+$/.test(person.email)); return `select public.allow_signup_email('${person.email}');`; }).join("\n");
    execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker", ["exec", "-i", "supabase_db_plates", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "-"],
      { input: `begin; set local statement_timeout='15s'; select set_config('request.jwt.claim.role','authenticated',true); select set_config('request.jwt.claim.sub',(select l.auth_user_id::text from private.app_admission_settings s join private.profile_auth_links l on l.profile_id=s.owner_profile_id where s.singleton),true); set local role authenticated; ${statements}\ncommit;`, stdio: ["pipe", "ignore", "pipe"], timeout: 25000 });
    await record("exact-fixture-addresses-admitted");
    for (const person of state.people) {
      take(state.counts, "accounts"); await record("account-budget-reserved", { label: person.label });
      const created = await admin.auth.admin.createUser({ email: person.email, email_confirm: true, user_metadata: { display_name: `QA8 Resilience ${person.label}` } });
      assert(!created.error && created.data.user); person.authId = created.data.user.id;
      await record("account-created", { label: person.label, authId: person.authId });
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email: person.email }); assert(!link.error);
      const client = clientFor();
      const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" }); assert(!verified.error);
      const profile = await client.from("my_profile").select("id").single(); assert(!profile.error);
      person.profileId = profile.data.id;
      assert(uuid(person.profileId)); clients.set(person.label, client);
      await rpc(client, "choose_username", { p_username: person.username }); await record("profile-ready", { label: person.label, profileId: person.profileId });
    }
    const A = clients.get("Author"), B = clients.get("Reader"); assert(B);
    take(state.counts, "tables"); await record("table-budget-reserved");
    state.groupId = await rpc(A, "create_table_with_members", { p_name: `QA8 Resilience ${suffix}`, p_profile_ids: [state.people[1].profileId, PEER] }); await record("table-created", { groupId: state.groupId });
    take(state.counts, "questions"); await record("question-budget-reserved");
    } else {
      for (const person of state.people) {
        assert(uuid(person.authId) && uuid(person.profileId) && person.email.endsWith(`-${suffix}@example.test`));
        const actual = await admin.auth.admin.getUserById(person.authId); assert(!actual.error && actual.data.user.email === person.email);
        const link = await admin.auth.admin.generateLink({ type: "magiclink", email: person.email }); assert(!link.error);
        const client = clientFor(); const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" }); assert(!verified.error);
        const profile = await client.from("my_profile").select("id").single(); assert(!profile.error && profile.data.id === person.profileId);
        clients.set(person.label, client);
      }
      assert.equal((await rows(clients.get("Author"), "timeline_content", "group_id", state.groupId, "id")).length, 0);
      const members = await rpc(clients.get("Author"), "table_members", { p_group_id: state.groupId }); assert.equal(members.length, 3);
      await record("reviewed-pre-question-failure-resumed");
    }
    const A = clients.get("Author"), B = clients.get("Reader");
    state.questionRequestId ??= randomUUID(); await record("question-request-reserved");
    state.questionId = await rpc(A, "post_table_request", { p_group_id: state.groupId, p_client_request_id: state.questionRequestId, p_question: "QA8 Resilience — failure and notification rehearsal", p_context: "Synthetic local test content; retained after rehearsal.", p_links: [], p_attachment_ids: [] });
    state.threadId = (await rows(A, "threads", "root_entry_id", state.questionId, "id"))[0].id;
    await privacy(A, true); await record("question-created", { questionId: state.questionId });
    for (const [name, colour] of [["plate", "#a94732"], ["table", "#3267a9"]]) {
      await sharp({ create: { width: 480, height: 640, channels: 3, background: colour } }).png().toFile(`${root}/${name}.png`);
    }
    const intent = (await rpc(A, "request_plate_upload"))[0]; take(state.counts, "jobs");
    const spec = { kind: "plate", id: intent.intent_id, ownerId: state.people[0].profileId };
    state.jobs.push(spec); await record("plate-job-registered", { jobId: spec.id });
    const uploaded = await A.storage.from("staged-assets").upload(intent.staged_path, await sharp(`${root}/plate.png`).png().toBuffer(), { contentType: "application/octet-stream", upsert: false }); assert(!uploaded.error);
    await record("plate-source-uploaded");
    const [entry] = await processJobs([spec]);
    const { data: category, error } = await A.from("categories").select("id").eq("slug", "meal").single(); assert(!error);
    take(state.counts, "plates"); await record("plate-budget-reserved");
    state.plateId = await rpc(A, "publish_plate", { p_category_id: category.id, p_body: "QA8 Resilience — private synthetic photo Plate", p_links: [], p_tags: [], p_attachment_ids: [entry.asset_id] });
    await record("plate-created", { plateId: state.plateId });
    // Reader requests approval; retained pending so browser acceptance can exercise the response.
    await rpc(B, "set_follow", { p_author_id: state.people[0].profileId, p_follow: true, p_expected_version: 0 });
    await record("follow-requested");
    console.log(JSON.stringify({ ready: true, root, groupId: state.groupId, questionId: state.questionId, plateId: state.plateId, authorEmail: state.people[0].email, people: state.people.map(({ label, profileId, username }) => ({ label, profileId, username })) }));
  }
  async function core() {
    assert(!state.coreStarted, "Core run already attempted; inspect manifest before retry"); state.coreStarted = true; await record("core-started");
    const A = clients.get("Author"), B = clients.get("Reader"), C = clients.get("Outsider");
    assert.equal((await rows(C, "groups", "id", state.groupId, "id")).length, 0);
    assert.equal((await rows(C, "timeline_content", "group_id", state.groupId, "id")).length, 0);
    assert.equal((await rows(C, "reply_content", "thread_id", state.threadId, "id")).length, 0);
    for (const client of [B, C]) {
      assert.equal((await rows(client, "plates", "id", state.plateId, "id")).length, 0);
      assert.equal((await rpc(client, "plate_image_locations", { p_plate_id: state.plateId })).length, 0);
    }
    const anonymous = await anon.from("plates").select("id").eq("id", state.plateId); assert(anonymous.error || !anonymous.data?.length);
    const rawNotifications = await C.from("table_activity_receipts").select("*").limit(1); assert(rawNotifications.error || !rawNotifications.data?.length);
    await pass("real REST private Plate/media, outsider Table/replies and anonymous denial");
    const idempotency = randomUUID(), args = { p_group_id: state.groupId, p_client_request_id: idempotency, p_body: "QA8 Resilience — lost acknowledgement retry" };
    take(state.counts, "messages"); await record("message-budget-reserved");
    let dropped = false;
    const lossy = await cloneSession(A, async (url, init) => {
      if (String(url).endsWith("/rpc/post_message") && !dropped) { dropped = true; await fetch(url, init); throw new TypeError("Synthetic acknowledgement loss"); }
      return fetch(url, init);
    });
    const lost = await lossy.rpc("post_message", args); assert(lost.error && dropped);
    state.retryMessageId = await rpc(A, "post_message", args); assert(uuid(state.retryMessageId));
    assert.equal((await rows(A, "timeline_content", "id", state.retryMessageId)).length, 1);
    assert.equal(await rpc(A, "post_message", args), state.retryMessageId);
    await pass("real committed message plus simulated lost acknowledgement retries return one ID");
    const offline = await cloneSession(A, async (url, init) => {
      if (String(url).endsWith("/rpc/post_message")) throw new DOMException("Synthetic bounded timeout", "TimeoutError"); return fetch(url, init);
    });
    assert((await offline.rpc("post_message", args)).error);
    const delayed = await cloneSession(A, async (url, init) => { if (String(url).endsWith("/rpc/post_message")) await new Promise(resolve => setTimeout(resolve, 250)); return fetch(url, init); });
    assert.equal(await rpc(delayed, "post_message", args), state.retryMessageId);
    await pass("scoped API transport timeout/delay and idempotent retry (not browser network injection)");
    take(state.counts, "messages"); await record("mention-budget-reserved");
    state.mentionId = await rpc(A, "post_message", { p_group_id: state.groupId, p_client_request_id: randomUUID(), p_body: `QA8 Resilience — mention @${state.people[1].username}` });
    const activity = () => rpc(B, "my_table_activity");
    assert.equal((await activity()).find(x => x.group_id === state.groupId)?.mention_count, 1);
    const before = (await rows(A, "timeline_content", "id", state.mentionId))[0];
    await rpc(A, "edit_table_content", { p_entry_id: state.mentionId, p_expected_updated_at: before.updated_at, p_body: `QA8 Resilience — changed mention @AlphaPeer_43e8c153c175`, p_links: [], p_question: null });
    assert.equal((await activity()).find(x => x.group_id === state.groupId)?.mention_count, 0);
    const changed = (await rows(A, "timeline_content", "id", state.mentionId))[0];
    await rpc(A, "edit_table_content", { p_entry_id: state.mentionId, p_expected_updated_at: changed.updated_at, p_body: "QA8 Resilience — mention removed", p_links: [], p_question: null });
    await pass("edited mentions stop appearing as Reader mentions; changed/removed content preserved");
    await record("core-finished");
  }
  const commands = {
    status: async () => console.log(JSON.stringify({ root, counts: state.counts, jobs: state.jobs, results: state.results, people: state.people.map(({ label, profileId, username, email }) => ({ label, profileId, username, email })), groupId: state.groupId, questionId: state.questionId, plateId: state.plateId })),
    core,
    approve: async () => {
      const A = clients.get("Author"); const requests = await rpc(A, "my_social_people", { p_list: "requests" });
      const edge = requests.find(x => x.profile_id === state.people[1].profileId); assert(edge);
      await rpc(A, "respond_follow", { p_edge_id: edge.edge_id, p_accept: true, p_expected_version: edge.edge_version });
      assert((await rpc(clients.get("Reader"), "my_follow_notifications")).some(x => x.kind === "follow_accepted" && x.sender_id === state.people[0].profileId));
      await pass("real follow acceptance alert reaches only the requesting Reader");
    },
    reply: async () => {
      take(state.counts, "replies"); await record("reply-budget-reserved");
      const id = await rpc(clients.get("Author"), "reply_to_thread", { p_thread_id: state.threadId, p_client_request_id: randomUUID(), p_body: `QA8 Resilience — background receipt ${state.counts.replies}` });
      state.lastReplyId = id; await record("reply-created", { replyId: id }); console.log(JSON.stringify({ replyId: id }));
    },
    processTable: async () => {
      const intents = await rows(admin, "table_upload_intents", "uploader_id", state.people[0].profileId);
      const pending = intents.filter(x => x.group_id === state.groupId && x.state === "pending"); assert.equal(pending.length, 1);
      assert(!state.jobs.some(x => x.id === pending[0].id), "Table job already registered");
      if (extraPhotoRetry) {
        assert.equal(state.counts.jobs, 4, "Only the explicitly approved fifth job may run");
        assert.equal(state.jobs.length, 4);
        state.counts.jobs = 5;
      } else take(state.counts, "jobs");
      const spec = { kind: "table", id: pending[0].id, ownerId: state.people[0].profileId, groupId: state.groupId }; state.jobs.push(spec);
      await record("table-job-registered", { jobId: spec.id }); await processJobs([spec]); await pass("only registered delayed Table job processed and ownership drained");
    },
    inspectFinal: async () => {
      const replies = await rows(clients.get("Author"), "reply_content", "thread_id", state.threadId, "id,body");
      assert.equal(replies.length, 3);
      assert.equal(replies.filter(x => x.body === "QA8 Resilience — delayed photo recovery").length, 1);
      state.counts.replies = replies.length;
      await record("final-replies-verified", { replyIds: replies.map(x => x.id) });
      await pass("exactly three retained replies including one delayed-photo recovery reply");
    },
    media: async () => {
      assert(!state.saveId, "Media/save phase already completed; do not repeat");
      const A = clients.get("Author"), B = clients.get("Reader"), C = clients.get("Outsider");
      const locations = await rpc(B, "plate_image_locations", { p_plate_id: state.plateId }); assert.equal(locations.length, 1);
      const path = locations[0].object_path;
      const signed = await B.storage.from("plate-media").createSignedUrl(path, 300); assert(!signed.error);
      plateSigned = { url: signed.data.signedUrl, at: Date.now(), path };
      assert((await fetch(plateSigned.url)).ok);
      const foreign = await C.storage.from("plate-media").createSignedUrl(path, 300); assert(foreign.error);
      const gallery = await rpc(B, "request_menu_gallery", { p_plate_id: state.plateId, p_expected_revision: 1 }); assert.equal(gallery.length, 1);
      take(state.counts, "jobs"); const spec = { kind: "preview", id: gallery[0].job_id, ownerId: state.people[1].profileId, plateId: state.plateId, sourceAssetId: locations[0].asset_id };
      state.jobs.push(spec); await record("preview-job-registered", { jobId: spec.id }); const [entry] = await processJobs([spec]);
      take(state.counts, "saves"); await record("save-budget-reserved");
      state.saveId = await rpc(B, "save_plate", { p_plate_id: state.plateId, p_expected_revision: 1, p_source_share_id: null, p_preview_asset_id: entry.asset_id });
      take(state.counts, "comments"); await record("comment-budget-reserved");
      state.commentId = await rpc(B, "create_plate_comment", { p_plate_id: state.plateId, p_client_request_id: randomUUID(), p_body: "QA8 Resilience — private audience comment" });
      const followers = await rpc(A, "my_social_people", { p_list: "followers" }); const edge = followers.find(x => x.profile_id === state.people[1].profileId); assert(edge);
      await rpc(A, "respond_follow", { p_edge_id: edge.edge_id, p_accept: false, p_expected_version: edge.edge_version });
      assert.equal((await rows(B, "plates", "id", state.plateId, "id")).length, 0);
      assert.equal((await rpc(B, "plate_image_locations", { p_plate_id: state.plateId })).length, 0);
      assert((await B.storage.from("plate-media").createSignedUrl(path, 300)).error);
      const comments = await B.rpc("plate_comments_page", { p_plate_id: state.plateId }); assert(comments.error || !comments.data?.length);
      assert.equal((await rows(B, "menu_plate_saves", "id", state.saveId, "id")).length, 1);
      assert((await fetch(plateSigned.url)).ok, "Previously signed delivery remains valid before expiry");
      await pass("real Storage signing denies outsider/revoked follower; retained Menu copy survives revocation");
      await privacy(A, false); assert.equal((await rows(C, "plates", "id", state.plateId, "id")).length, 1);
      await privacy(A, true); assert.equal((await rows(C, "plates", "id", state.plateId, "id")).length, 0);
      const current = (await rpc(B, "social_person", { p_profile_id: state.people[0].profileId }))[0];
      await rpc(B, "set_follow", { p_author_id: state.people[0].profileId, p_follow: true, p_expected_version: current.follow_version });
      const requested = (await rpc(A, "my_social_people", { p_list: "requests" })).find(x => x.profile_id === state.people[1].profileId);
      await rpc(A, "respond_follow", { p_edge_id: requested.edge_id, p_accept: true, p_expected_version: requested.edge_version });
      await pass("open/private REST transitions and new test relationship restoration");
      await record("media-finished", { saveId: state.saveId, signedAt: plateSigned.at }); console.log("Expiry check available after five minutes; token retained only in memory.");
    },
    revoke: async () => {
      const A = clients.get("Author"), B = clients.get("Reader");
      await rpc(A, "remove_table_member", { p_group_id: state.groupId, p_profile_id: state.people[1].profileId });
      assert.equal((await rows(B, "timeline_content", "group_id", state.groupId, "id")).length, 0);
      assert.equal((await rows(B, "reply_content", "thread_id", state.threadId, "id")).length, 0);
      const members = await B.rpc("table_members", { p_group_id: state.groupId }); assert(members.error);
      await rpc(A, "add_table_members", { p_group_id: state.groupId, p_profile_ids: [state.people[1].profileId] });
      assert((await rpc(B, "table_members", { p_group_id: state.groupId })).length >= 2);
      await pass("actual member revocation denies REST/RPC then re-add restores new test Table access");
    },
    expiry: async () => {
      assert(plateSigned && Date.now() - plateSigned.at >= 305000, "Full five-minute lifetime not yet elapsed");
      assert(!(await fetch(plateSigned.url)).ok);
      const renewed = await clients.get("Reader").storage.from("plate-media").createSignedUrl(plateSigned.path, 300); assert(!renewed.error && (await fetch(renewed.data.signedUrl)).ok);
      await pass("actual 300-second signed photo URL expires; current authorised reader renews successfully");
    },
  };
  try {
    await setup();
    const input = createInterface({ input: process.stdin, terminal: false });
    for await (const line of input) {
      const command = line.trim();
      if (command === "finish") { await record("session-finished"); break; }
      if (!Object.hasOwn(commands, command)) { console.log("REFUSED unknown command"); continue; }
      try { await commands[command](); console.log("DONE", command); }
      catch (error) { await record("command-failed", { command, name: error.name, note: String(error.message).slice(0, 180) }); console.log("FAILED", command, String(error.message).slice(0, 180)); }
    }
  } catch (error) {
    await record("setup-failed", { name: error.name, detail: String(error.message).slice(0, 180), note: "Inspect retained manifest; do not repeat fixture creation" });
    console.error("QA8 setup refused/failed; retained scope", root, "category", error.name, String(error.message).slice(0, 180)); process.exitCode = 1;
  } finally { for (const client of clients.values()) client.realtime.disconnect(); if (backend) console.log("Worker ownership remains fenced; review manifest before any recovery."); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length === 3 && process.argv[2] === "--self-test") await selfTest();
  else if (process.argv.length === 3 && process.argv[2] === "--run-approved") await run();
  else if (process.argv.length === 4 && process.argv[2] === "--resume-reviewed") await run(process.argv[3]);
  else if (process.argv.length === 4 && process.argv[2] === "--continue-reviewed") await run(process.argv[3], true);
  else if (process.argv.length === 4 && process.argv[2] === "--continue-photo-retry-approved") await run(process.argv[3], true, true);
  else throw new Error("Use --self-test or the specifically approved --run-approved mode");
}
