// Durable local operator log; no database, network, erasure or automatic replay.
import { open, readdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { MemoryDeletionIndex, verifyIndex } from "./deletion-index-prototype.mjs";
import { privateDirectory, readPrivateFile } from "./encrypted-backup.mjs";

const zero = "0".repeat(64);
function check(ok, reason) { if (!ok) throw new Error(reason); }
async function syncFolder(path) {
  const folder = await open(path, "r");
  try { await folder.sync(); } finally { await folder.close(); }
}
async function immutable(path, value) {
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  let file;
  let created = false;
  try { file = await open(path, "wx", 0o600); created = true; }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    check((await readPrivateFile(path, 1024 * 1024)).equals(bytes), "Concurrent/conflicting or incomplete record; preserve for review");
    file = await open(path, "r");
  }
  try { if (created) await file.writeFile(bytes); await file.sync(); }
  finally { await file.close(); }
}

// Shared immutable-write path for records and independent receipts.
async function persist(path, value) {
  await immutable(path, value);
}
const name = (prefix, sequence) => `${prefix}-${String(sequence).padStart(8, "0")}.json`;
async function json(path) { return JSON.parse((await readPrivateFile(path, 1024 * 1024)).toString()); }

export class LocalDeletionRecords {
  constructor({ recordsFolder, checkpointsFolder, namespace, keys, afterRecordSync }) {
    this.recordsFolder = recordsFolder;
    this.checkpointsFolder = checkpointsFolder;
    this.namespace = namespace;
    this.keys = keys;
    this.afterRecordSync = afterRecordSync; // Fault injection used by synthetic tests only.
  }
  async paths() {
    const records = await privateDirectory(this.recordsFolder);
    const checkpoints = await privateDirectory(this.checkpointsFolder);
    check(records !== checkpoints && !records.startsWith(checkpoints + sep)
      && !checkpoints.startsWith(records + sep), "Keep checkpoints separate from history");
    return { records, checkpoints };
  }
  async initialise() {
    const { records, checkpoints } = await this.paths();
    check((await readdir(records)).length === 0 && (await readdir(checkpoints)).length === 0,
      "Initialisation requires empty, explicitly selected private folders");
    check(typeof this.namespace === "string" && this.namespace.length > 0 && this.keys.size > 0, "Namespace/keys required");
    await persist(resolve(records, "store.json"), { version: 1, namespace: this.namespace });
    await syncFolder(records);
    await persist(resolve(checkpoints, name("checkpoint", 0)), { namespace: this.namespace, sequence: 0, head: zero });
    await syncFolder(checkpoints);
  }
  async load({ allowPending = false } = {}) {
    const paths = await this.paths();
    const config = await json(resolve(paths.records, "store.json"));
    check(config.version === 1 && config.namespace === this.namespace, "Wrong store namespace/version");
    const names = (await readdir(paths.records)).filter((item) => item !== "store.json").sort();
    const receiptNames = (await readdir(paths.checkpoints)).sort();
    check(names.length <= 100000 && receiptNames.length > 0 && receiptNames.length <= 100001,
      "Missing checkpoint or oversized store");
    const records = [];
    for (const [index, filename] of names.entries()) {
      check(filename === name("record", index + 1), "History is missing/unexpected");
      records.push(await json(resolve(paths.records, filename)));
    }
    let checkpoint;
    for (const [index, filename] of receiptNames.entries()) {
      check(filename === name("checkpoint", index), "Checkpoint history is missing/unexpected");
      checkpoint = await json(resolve(paths.checkpoints, filename));
      check(checkpoint.namespace === this.namespace && checkpoint.sequence === index
        && checkpoint.head === (records[index - 1]?.mac ?? zero), "History rolled back or checkpoint conflicts");
    }
    const head = { namespace: this.namespace, sequence: records.length, head: records.at(-1)?.mac ?? zero };
    verifyIndex(records, head, this.keys, this.namespace);
    check(records.length === checkpoint.sequence || (allowPending && records.length === checkpoint.sequence + 1),
      "Unacknowledged history; retry the same operation before erasure");
    return { recordsFolder: paths.records, checkpointsFolder: paths.checkpoints,
      records, checkpoint, head, pending: records.length !== checkpoint.sequence };
  }
  async append(event, input) {
    const state = await this.load({ allowPending: true });
    const model = new MemoryDeletionIndex(this.namespace, this.keys, { records: state.records, checkpoint: state.head });
    const record = event === "intent" ? model.intent(input) : model.complete(input);
    if (state.pending) check(record.sequence === state.head.sequence && record.event === event,
      "Retry must acknowledge the exact pending operation first");
    if (record.sequence > state.checkpoint.sequence) {
      await persist(resolve(state.recordsFolder, name("record", record.sequence)), record);
      await syncFolder(state.recordsFolder);
      await this.afterRecordSync?.();
      // Re-read before receipt creation: a competing operation must never gain an acknowledgement.
      const current = await this.load({ allowPending: true });
      check(current.records[record.sequence - 1]?.mac === record.mac, "Competing record changed");
      await persist(resolve(state.checkpointsFolder, name("checkpoint", record.sequence)),
        { namespace: this.namespace, sequence: record.sequence, head: record.mac });
      await syncFolder(state.checkpointsFolder);
    }
    const acknowledged = await this.load();
    check(acknowledged.checkpoint.sequence >= record.sequence, "Durable acknowledgement unavailable");
    return record;
  }
  intent(input) { return this.append("intent", input); }
  complete(operationId) { return this.append("complete", operationId); }
}
