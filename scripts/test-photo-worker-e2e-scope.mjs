import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createScopedPhotoBackend, validateE2ePlan, validateE2eResume } from "./photo-worker-e2e-scope.mjs";

const plan = validateE2ePlan(JSON.parse(await readFile("PHOTO_WORKER_E2E_PLAN.json", "utf8")));
assert.throws(() => validateE2ePlan({ ...plan, authUserId: "not-a-uuid" }));
assert.throws(() => validateE2ePlan({ ...plan, invalidUploadId: plan.plateUploadId }));
assert.throws(() => validateE2ePlan({ ...plan, unexpected: true }));
const ownerId = "11111111-1111-4111-8111-111111111111";
const groupId = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
const earlyFailure = [{ event: "started", plan }, { event: "fixtures_created", ownerId, groupId }, { event: "failed" }];
assert.deepEqual(validateE2eResume(plan, earlyFailure), { ownerId, groupId });
assert.throws(() => validateE2eResume(plan, [...earlyFailure, { event: "sources_uploaded" }]));
assert.throws(() => validateE2eResume(plan, [earlyFailure[0], earlyFailure[1], { event: "failed", stage: "source_upload" }]));
assert.throws(() => validateE2eResume(plan, [{ event: "started", plan: { ...plan, authUserId: otherId } }, ...earlyFailure.slice(1)]));
assert.throws(() => validateE2eResume(plan, [earlyFailure[0], { event: "fixtures_created", ownerId: "invalid", groupId }, earlyFailure[2]]));
console.log("PASS: manual fixture resume requires unchanged plan and exact pre-upload failure report");
const specs = [
  { kind: "plate", id: plan.plateUploadId, ownerId },
  { kind: "table", id: plan.tableUploadId, ownerId, groupId },
  { kind: "preview", id: plan.previewJobId, ownerId, plateId: otherId, sourceAssetId: assetId },
];
const jobs = specs.map(spec => ({ kind: spec.kind, id: spec.id, data: { id: spec.id, state: "pending",
  uploader_id: ownerId, saver_id: ownerId, staged_path: `${ownerId}/${spec.id}`, group_id: groupId,
  plate_id: otherId, source_asset_id: assetId } }));
let calls = 0, rows = jobs;
const backend = {
  poll: async () => { throw new Error("Global poll must never run"); },
  claim: async job => {
    calls++;
    const spec = specs.find(value => value.id === job.id);
    const prefix = job.kind === "plate" ? "" : `${job.kind === "table" ? groupId : ownerId}/`;
    return { kind: job.kind, job_id: job.id, asset_id: assetId, bucket: job.kind === "plate" ? "plate-media"
      : job.kind === "table" ? "table-media" : "menu-previews", object_path: `${prefix}${assetId}.webp`, phase: "claimed", spec };
  },
  source: async () => { calls++; return Buffer.from("fixture source"); },
  prepare: async (job, meta) => ({ ...await backend.claim(job), ...meta, phase: "prepared" }),
  complete: async () => { calls++; }, reject: async () => { calls++; }, block: async () => { calls++; },
  output: async () => { calls++; return Buffer.from("fixture output"); }, upload: async () => { calls++; },
};
const scoped = createScopedPhotoBackend({ backend, expected: specs, readJobs: async () => rows });
assert.equal((await scoped.poll()).jobs.length, 3);
const outsider = { ...jobs[0], id: otherId, data: { ...jobs[0].data, id: otherId } };
for (const operation of ["claim", "source", "prepare", "complete", "reject", "block"]) {
  const before = calls;
  await assert.rejects(scoped[operation](outsider, {}), /outside fixture scope/);
  assert.equal(calls, before);
}
for (const changed of [{ uploader_id: otherId }, { staged_path: `${ownerId}/${otherId}` }, { state: "unknown" }]) {
  await assert.rejects(scoped.source({ ...jobs[0], data: { ...jobs[0].data, ...changed } }));
}
await assert.rejects(scoped.claim({ ...jobs[1], data: { ...jobs[1].data, group_id: otherId } }));
await assert.rejects(scoped.source({ ...jobs[2], data: { ...jobs[2].data, source_asset_id: otherId } }));
await assert.rejects(scoped.source({ ...jobs[2], data: { ...jobs[2].data, saver_id: otherId } }));
await assert.rejects(scoped.source({ ...jobs[2], data: { ...jobs[2].data, plate_id: groupId } }));
console.log("PASS: all mutation/source methods refuse unrelated jobs, owners, groups, sources and paths before backend calls");

for (const job of jobs) {
  const entry = await scoped.claim(job);
  await scoped.output(entry);
  const prepared = await scoped.prepare(job, { sha256: "a".repeat(64), byte_count: 20 });
  await scoped.upload(prepared, Buffer.from("fixture"));
  for (const changed of [{ asset_id: otherId }, { bucket: "staged-assets" }, { object_path: `${otherId}.webp` },
    { job_id: otherId }, { sha256: "b".repeat(64) }, { byte_count: 21 }]) {
    const before = calls;
    await assert.rejects(scoped.upload({ ...prepared, ...changed }, Buffer.from("fixture")), /fixture output/);
    await assert.rejects(scoped.output({ ...prepared, ...changed }), /fixture output/);
    assert.equal(calls, before);
  }
}
console.log("PASS: acknowledged output paths/identity/hash checked for every upload and download");

rows = jobs.slice(0, 2); await assert.rejects(scoped.poll(), /incomplete/);
rows = [jobs[0], jobs[0], jobs[2]]; await assert.rejects(scoped.poll(), /incomplete/);
rows = [...jobs, outsider]; await assert.rejects(scoped.poll(), /incomplete/);
rows = jobs.map(job => ({ ...job, data: { ...job.data, state: "ready" } }));
assert.equal((await scoped.poll()).jobs.length, 0);
assert.throws(() => createScopedPhotoBackend({ backend, expected: [specs[0], specs[0]], readJobs: async () => [] }));
const badBackend = { ...backend, claim: async job => ({ ...await backend.claim(job), object_path: `${otherId}.webp` }) };
await assert.rejects(createScopedPhotoBackend({ backend: badBackend, expected: specs, readJobs: async () => jobs }).claim(jobs[1]), /outside fixture scope/);
console.log("PASS photo worker E2E scope: offline only; no database, credentials, Storage or live worker");
