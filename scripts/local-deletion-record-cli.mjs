// Local-only durable record management. Never erases an account or starts a worker.
import { mkdir } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { LocalDeletionRecords } from "./local-deletion-records.mjs";
import { createKey, outsideProject, privateDirectory, readPrivateFile } from "./encrypted-backup.mjs";

const project = resolve(import.meta.dirname, "..");
const namespace = "plates/local/erasure-policy-20261010";
let stage = "argument validation";
function check(ok, reason) { if (!ok) throw new Error(reason); }
try {
  const [mode, recordsPath, checkpointsPath, keyPath, scopeOrApproval, ...extra] = process.argv.slice(2);
  check(["init", "verify", "intent", "complete"].includes(mode)
    && recordsPath && checkpointsPath && keyPath && extra.length === 0, "Supply mode, three paths, and scope/approval when needed");
  if (mode === "init") {
    check(scopeOrApproval === "--approved-new-local-store", "Explicit new-store approval required");
    stage = "private directory setup";
    for (const directory of [recordsPath, checkpointsPath, dirname(keyPath)]) {
      await mkdir(resolve(directory), { mode: 0o700, recursive: true });
    }
  }
  stage = "private path validation";
  const recordsFolder = await outsideProject(await privateDirectory(recordsPath), project);
  const checkpointsFolder = await outsideProject(await privateDirectory(checkpointsPath), project);
  const keyFolder = await outsideProject(await privateDirectory(dirname(keyPath)), project);
  for (const folder of [recordsFolder, checkpointsFolder]) check(folder !== keyFolder
    && !keyFolder.startsWith(folder + sep) && !folder.startsWith(keyFolder + sep), "Keep index keys separately");
  if (mode === "init") { stage = "new key creation"; await createKey(resolve(keyPath)); }
  const key = await readPrivateFile(keyPath, 32);
  check(key.length === 32, "Expected index key size");
  const store = new LocalDeletionRecords({ recordsFolder, checkpointsFolder, namespace, keys: new Map([["v1", key]]) });
  stage = mode;
  if (mode === "init") await store.initialise();
  else if (mode === "verify") check(!scopeOrApproval, "Unexpected scope");
  else {
    check(scopeOrApproval, "Exact private scope required");
    const scope = JSON.parse((await readPrivateFile(resolve(scopeOrApproval), 4096)).toString());
    const expected = mode === "intent" ? "authId,operationId,profileId" : "operationId,verifiedActiveCleanup";
    check(Object.keys(scope).sort().join(",") === expected, "Unexpected scope fields");
    if (mode === "intent") await store.intent({ ...scope, keyVersion: "v1" });
    else {
      check(scope.verifiedActiveCleanup === true, "Completion requires separately verified active cleanup");
      await store.complete(scope.operationId);
    }
  }
  const state = await store.load();
  console.log(JSON.stringify({ durableVerified: true, namespace, sequence: state.checkpoint.sequence,
    intents: state.records.filter((record) => record.event === "intent").length,
    completions: state.records.filter((record) => record.event === "complete").length,
    accountErasureExecuted: false, restoreReplayExecuted: false }, null, 2));
} catch {
  console.error(`Local deletion record refused/failed at ${stage}; no account erasure ran. Preserve files and retry the same scope after review; never reset the history.`);
  process.exitCode = 1;
}
