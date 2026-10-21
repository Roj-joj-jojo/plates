import assert from "node:assert/strict";
import { recoverySql, runRecovery, validateScope } from "./recover-abandoned-upload.mjs";

const scope = { profileId: "11111111-1111-4111-8111-111111111111", bucket: "plate-media", objectPath: "fixture.webp" };
function simulate(args, inspection = { eligible: true, other_cleaning_job: false }, failApply = false) {
  const calls = [];
  const run = () => runRecovery(args, {
    readScope: () => JSON.stringify(scope),
    execute: (sql) => {
      calls.push(sql);
      if (calls.length === 1) return JSON.stringify(inspection);
      if (failApply) throw new Error("Database failure");
      return "";
    },
  });
  return { calls, run };
}
const inspection = simulate(["scope.json"]);
assert.equal(inspection.run().eligible, true);
assert.equal(inspection.calls.length, 1);
assert.match(inspection.calls[0], /^begin read only;/);
assert.doesNotMatch(inspection.calls[0], /finish_media_object_attempt/);
for (const flags of [["--apply"], ["--apply", "--scope-approved"], ["--writer-stopped"],
  ["--apply", "--scope-approved", "--writer-stopped", "--writer-stopped"]]) {
  const attempt = simulate(["scope.json", ...flags]);
  assert.throws(attempt.run);
  assert.equal(attempt.calls.length, 0);
}
const approved = ["scope.json", "--apply", "--scope-approved", "--writer-stopped"];
for (const state of [{ eligible: false, other_cleaning_job: false }, { eligible: true, other_cleaning_job: true }]) {
  const refused = simulate(approved, state);
  assert.throws(refused.run);
  assert.equal(refused.calls.length, 1);
}
const applied = simulate(approved);
assert.deepEqual(applied.run(), { recovered: true, cleanupRequired: true });
assert.equal(applied.calls.length, 2);
assert.match(applied.calls[1], /for update;[\s\S]*finish_media_object_attempt/);
assert.match(applied.calls[1], /Recovery recheck failed/);
assert.throws(simulate(approved, undefined, true).run);
for (const objectPath of ["a'; select 1;--", "../fixture.webp", "a//b", "", "a\nb"]) {
  assert.throws(() => validateScope({ ...scope, objectPath }));
}
assert.throws(() => recoverySql({ ...scope, bucket: "staged-assets" }));
assert.throws(() => validateScope({ ...scope, approval: true }));
console.log("PASS recovery scope, read-only default, confirmation guards, shared-job refusal and failure handling (simulated runner only)");
