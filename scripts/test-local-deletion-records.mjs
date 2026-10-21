import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { LocalDeletionRecords } from "./local-deletion-records.mjs";
import { SimulatedRestoreGate } from "./deletion-index-prototype.mjs";

const root = await mkdtemp("/private/tmp/plates-deletion-record-test-");
const keys = new Map([["v1", randomBytes(32)]]);
const namespace = "plates/synthetic/erasure-policy-20261010";
async function store(label, options = {}) {
  const recordsFolder = resolve(root, label + "-records");
  const checkpointsFolder = resolve(root, label + "-checkpoints");
  await mkdir(recordsFolder, { mode: 0o700 }); await mkdir(checkpointsFolder, { mode: 0o700 });
  const result = new LocalDeletionRecords({ recordsFolder, checkpointsFolder, keys, namespace, ...options });
  await result.initialise();
  return result;
}
const input = { operationId: randomUUID(), profileId: randomUUID(), authId: randomUUID(), keyVersion: "v1" };
const first = await store("roundtrip");
const intent = await first.intent(input);
const reopened = new LocalDeletionRecords(first);
assert.deepEqual((await reopened.load()).records, [intent]);
assert.deepEqual(await reopened.intent(input), intent);
await assert.rejects(reopened.intent({ ...input, authId: randomUUID() }));
await reopened.complete(input.operationId);
await reopened.complete(input.operationId);
assert.equal((await reopened.load()).records.length, 2);
const bytes = await readFile(resolve(first.recordsFolder, "record-00000001.json"), "utf8");
assert(!bytes.includes(input.profileId) && !bytes.includes(input.authId));
const lostKeys = new LocalDeletionRecords({ ...first, keys: new Map() });
await assert.rejects(lostKeys.load());

let fault = true;
const crashed = await store("interrupted", { afterRecordSync: () => { if (fault) throw new Error("Synthetic interruption"); } });
await assert.rejects(crashed.intent(input));
await assert.rejects(crashed.load());
await assert.rejects(crashed.intent({ ...input, operationId: randomUUID() }));
fault = false;
assert.deepEqual(await crashed.intent(input), (await crashed.load()).records[0]);

const concurrent = await store("concurrent");
const competing = new LocalDeletionRecords(concurrent);
const raced = await Promise.allSettled([concurrent.intent(input), competing.intent({ ...input, operationId: randomUUID() })]);
assert(raced.some((result) => result.status === "fulfilled"));
const survived = await concurrent.load();
assert(survived.records.length >= 1 && survived.records.length <= 2);

const replay = new SimulatedRestoreGate(namespace, keys);
const state = await reopened.load();
const peer = { profileId: randomUUID(), authId: randomUUID() };
const plan = await replay.sweep({ records: state.records, checkpoint: state.checkpoint,
  restoredProfiles: [{ profileId: input.profileId, authId: input.authId }, peer],
  restoredAuthIds: [input.authId, peer.authId], apply: async () => {}, verify: async () => true });
assert.deepEqual(plan, { profiles: [input.profileId], authIds: [input.authId] });
assert.equal(replay.allows("storage"), false);
await reopened.intent({ operationId: randomUUID(), profileId: randomUUID(), authId: randomUUID(), keyVersion: "v1" });
const latest = await reopened.load();
assert.throws(() => replay.open(latest.checkpoint, true));

// Corrupt only this labelled synthetic file, never a real index.
const changed = JSON.parse(bytes); changed.authToken = "1".repeat(64);
await writeFile(resolve(first.recordsFolder, "record-00000001.json"), JSON.stringify(changed));
await assert.rejects(first.load());
const missing = await store("rolled-back");
await missing.intent(input);
const emptyHistory = resolve(root, "old-history"); await mkdir(emptyHistory, { mode: 0o700 });
await writeFile(resolve(emptyHistory, "store.json"), JSON.stringify({ version: 1, namespace }), { mode: 0o600 });
await assert.rejects(new LocalDeletionRecords({ ...missing, recordsFolder: emptyHistory }).load());
console.log("PASS local deletion records: durable reopen/idempotency, identity privacy, missing keys, interrupted acknowledgement retry, concurrent appends, disk-backed matching, stale gate refusal, tamper and rolled-back history refusal; synthetic files retained");
