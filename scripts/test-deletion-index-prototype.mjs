import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { MemoryDeletionIndex, SimulatedRestoreGate, verifyIndex } from "./deletion-index-prototype.mjs";

const namespace = "plates/local-synthetic";
const keys = new Map([["v1", randomBytes(32)], ["v2", randomBytes(32)]]);
const index = new MemoryDeletionIndex(namespace, keys);
const author = { profileId: randomUUID(), authId: randomUUID() };
const peer = { profileId: randomUUID(), authId: randomUUID() };
const operation = { operationId: randomUUID(), ...author, keyVersion: "v1" };
const first = index.intent(operation);
assert.deepEqual(index.intent({ ...operation, keyVersion: "v2" }), first);
assert.equal(index.snapshot().length, 1);
assert.throws(() => index.intent({ ...operation, ...peer }));
assert.throws(() => index.complete(randomUUID()));
assert(!JSON.stringify(index.snapshot()).includes(author.profileId));
assert(!JSON.stringify(index.snapshot()).includes(author.authId));
const initialCheckpoint = index.checkpoint(); // Models independently trusted storage.
assert.equal(verifyIndex(index.snapshot(), initialCheckpoint, keys, namespace).length, 1);
assert.throws(() => verifyIndex([], initialCheckpoint, keys, namespace));
assert.throws(() => verifyIndex(index.snapshot(), null, keys, namespace));
assert.throws(() => verifyIndex(index.snapshot(), initialCheckpoint, keys, "another-environment"));
assert.throws(() => verifyIndex(index.snapshot(), initialCheckpoint, new Map(), namespace));
const tampered = index.snapshot();
tampered[0].authToken = "f".repeat(64);
assert.throws(() => verifyIndex(tampered, initialCheckpoint, keys, namespace));
const extraField = index.snapshot();
extraField[0].email = "synthetic@example.test";
assert.throws(() => verifyIndex(extraField, initialCheckpoint, keys, namespace));
index.complete(operation.operationId);
index.complete(operation.operationId);
assert.equal(index.snapshot().length, 2);
assert.equal(verifyIndex(index.snapshot(), index.checkpoint(), keys, namespace).length, 1);
const second = { profileId: randomUUID(), authId: randomUUID() };
index.intent({ operationId: randomUUID(), ...second, keyVersion: "v2" }); // Incomplete must still replay.
assert.equal(verifyIndex(index.snapshot(), index.checkpoint(), keys, namespace).length, 2);
assert.throws(() => verifyIndex(index.snapshot(), index.checkpoint(), new Map([["v2", keys.get("v2")]]), namespace));
const gate = new SimulatedRestoreGate(namespace, keys);
const surfaces = ["app", "auth", "rest", "realtime", "storage", "worker"];
function closed() { for (const surface of surfaces) assert.equal(gate.allows(surface), false); }
closed();
assert.throws(() => gate.open(index.checkpoint(), true));
// Synthetic backup resurrects originals, a peer-owned copy and Auth state.
const restoredProfiles = [author, peer];
let content = [{ author: author.profileId, body: "synthetic original" },
  { author: author.profileId, saver: peer.profileId, body: "synthetic copied reminder" },
  { author: peer.profileId, body: "synthetic peer original" }];
let authIds = [author.authId, peer.authId, second.authId]; // second profile mapping missing in old snapshot.
let media = [{ author: author.profileId, present: true }, { author: peer.profileId, present: true }];
const snapshot = index.snapshot();
const checkpoint = index.checkpoint();
const apply = async (plan) => {
  content = content.map((row) => plan.profiles.includes(row.author) ? { ...row, body: "" } : row);
  media = media.map((row) => plan.profiles.includes(row.author) ? { ...row, present: false } : row);
  authIds = authIds.filter((id) => !plan.authIds.includes(id));
};
const verify = async (plan) => content.every((row) => !plan.profiles.includes(row.author) || row.body === "")
  && media.every((row) => !plan.profiles.includes(row.author) || row.present === false)
  && plan.authIds.every((id) => !authIds.includes(id));
const sweep = () => gate.sweep({ records: snapshot, checkpoint, restoredProfiles,
  restoredAuthIds: [author.authId, peer.authId, second.authId], apply, verify });
await assert.rejects(gate.sweep({ records: snapshot, checkpoint: null }));
closed();
await assert.rejects(gate.sweep({ records: snapshot, checkpoint, restoredProfiles, restoredAuthIds: [],
  apply: async () => { throw new Error("Crash before cleanup"); }, verify }));
closed();
await assert.rejects(gate.sweep({ records: snapshot, checkpoint, restoredProfiles, restoredAuthIds: [],
  apply, verify: async () => false }));
closed();
const plan = await sweep();
assert.deepEqual(plan.profiles, [author.profileId]);
assert(plan.authIds.includes(author.authId) && plan.authIds.includes(second.authId));
assert.equal(content[1].body, "");
assert.equal(content[2].body, "synthetic peer original");
assert.equal(media[1].present, true);
assert(authIds.includes(peer.authId));
assert.throws(() => gate.open(checkpoint, false));
closed();
gate.open(checkpoint, true);
for (const surface of surfaces) assert.equal(gate.allows(surface), true);
index.intent({ operationId: randomUUID(), profileId: randomUUID(), authId: randomUUID(), keyVersion: "v2" });
assert.throws(() => gate.open(index.checkpoint(), true));
closed();
await sweep(); // Retry is idempotent, but old checkpoint cannot open against current index.
assert.throws(() => gate.open(index.checkpoint(), true));
const restarted = new SimulatedRestoreGate(namespace, keys);
for (const surface of surfaces) assert.equal(restarted.allows(surface), false);
const emptyIndex = new MemoryDeletionIndex(namespace, keys);
assert.deepEqual(verifyIndex([], emptyIndex.checkpoint(), keys, namespace), []);
console.log("PASS local index/restore simulation: keyed matching, retries, incomplete intent, rotation, tamper/truncation, cleanup failure, copied content, orphan Auth, peer preservation and closed access on stale checkpoint/restart");
