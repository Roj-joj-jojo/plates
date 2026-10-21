// In-memory design prototype only: no durable store, app integration or network gate.
import { createHmac, timingSafeEqual } from "node:crypto";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;
const surfaces = ["app", "auth", "rest", "realtime", "storage", "worker"];
function requireValue(ok, message) { if (!ok) throw new Error(message); }
function keyFor(keys, version) {
  const key = keys.get(version);
  requireValue(Buffer.isBuffer(key) && key.length >= 32, "Required index key is unavailable");
  return key;
}
function mac(key, value) { return createHmac("sha256", key).update(JSON.stringify(value)).digest("hex"); }
function equalHash(a, b) {
  return typeof a === "string" && digest.test(a) && typeof b === "string" && digest.test(b)
    && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
function token(namespace, type, id, key) {
  requireValue(typeof id === "string" && uuid.test(id), "Expected stable UUID");
  return mac(key, ["plates-deletion-match-v1", namespace, type, id.toLowerCase()]);
}
function payload(record) {
  return { sequence: record.sequence, previous: record.previous, keyVersion: record.keyVersion,
    event: record.event, operationId: record.operationId,
    profileToken: record.profileToken, authToken: record.authToken };
}

export function verifyIndex(records, checkpoint, keys, namespace) {
  requireValue(typeof namespace === "string" && namespace.length > 0 && Array.isArray(records)
    && checkpoint?.namespace === namespace && checkpoint.sequence === records.length,
  "Index or independent checkpoint is missing/stale");
  let head = "0".repeat(64);
  const intents = new Map();
  for (const [index, record] of records.entries()) {
    requireValue(record && Object.keys(record).sort().join(",")
      === "authToken,event,keyVersion,mac,operationId,previous,profileToken,sequence"
      && record.sequence === index + 1 && record.previous === head
      && typeof record.keyVersion === "string" && typeof record.operationId === "string"
      && uuid.test(record.operationId) && digest.test(record.profileToken) && digest.test(record.authToken),
    "Index record schema/order is invalid");
    const key = keyFor(keys, record.keyVersion);
    requireValue(equalHash(record.mac, mac(key, ["plates-deletion-record-v1", namespace, payload(record)])),
      "Index integrity check failed");
    if (record.event === "intent") {
      requireValue(!intents.has(record.operationId), "Duplicate index intent");
      intents.set(record.operationId, record);
    } else {
      const intent = intents.get(record.operationId);
      requireValue(record.event === "complete" && intent && intent.keyVersion === record.keyVersion
        && intent.profileToken === record.profileToken && intent.authToken === record.authToken,
      "Completion does not match a durable intent");
    }
    head = record.mac;
  }
  requireValue(equalHash(checkpoint.head, head), "Index checkpoint does not match history");
  // Completed and incomplete intents both require replay on an older restore.
  return [...intents.values()];
}

export class MemoryDeletionIndex {
  #records = [];
  constructor(namespace, keys, persisted = null) {
    requireValue(typeof namespace === "string" && namespace.length > 0, "Namespace required");
    this.namespace = namespace;
    this.keys = keys;
    if (persisted) {
      verifyIndex(persisted.records, persisted.checkpoint, keys, namespace);
      this.#records = structuredClone(persisted.records).map(Object.freeze);
    }
  }
  snapshot() { return structuredClone(this.#records); }
  checkpoint() {
    return { namespace: this.namespace, sequence: this.#records.length,
      head: this.#records.at(-1)?.mac ?? "0".repeat(64) };
  }
  intent({ operationId, profileId, authId, keyVersion }) {
    requireValue(typeof operationId === "string" && uuid.test(operationId), "Operation UUID required");
    const prior = this.#records.find((record) => record.operationId === operationId && record.event === "intent");
    if (prior) {
      const key = keyFor(this.keys, prior.keyVersion);
      requireValue(prior.profileToken === token(this.namespace, "profile", profileId, key)
        && prior.authToken === token(this.namespace, "auth", authId, key), "Operation ID reused for another identity");
      return structuredClone(prior);
    }
    const key = keyFor(this.keys, keyVersion);
    return this.#append({ event: "intent", operationId, keyVersion,
      profileToken: token(this.namespace, "profile", profileId, key),
      authToken: token(this.namespace, "auth", authId, key) });
  }
  complete(operationId) {
    const prior = this.#records.find((record) => record.operationId === operationId && record.event === "intent");
    requireValue(prior, "Completion requires an acknowledged intent");
    const complete = this.#records.find((record) => record.operationId === operationId && record.event === "complete");
    if (complete) return structuredClone(complete);
    return this.#append({ event: "complete", operationId, keyVersion: prior.keyVersion,
      profileToken: prior.profileToken, authToken: prior.authToken });
  }
  #append(event) {
    const record = { sequence: this.#records.length + 1, previous: this.checkpoint().head, ...event };
    record.mac = mac(keyFor(this.keys, record.keyVersion), ["plates-deletion-record-v1", this.namespace, payload(record)]);
    this.#records.push(Object.freeze(record));
    return structuredClone(record);
  }
}

export class SimulatedRestoreGate {
  #open = false;
  #verified = null;
  constructor(namespace, keys) { this.namespace = namespace; this.keys = keys; }
  allows(surface) { return surfaces.includes(surface) && this.#open; }
  async sweep({ records, checkpoint, restoredProfiles, restoredAuthIds, apply, verify }) {
    this.#open = false;
    this.#verified = null;
    const intents = verifyIndex(records, checkpoint, this.keys, this.namespace);
    requireValue(Array.isArray(restoredProfiles) && Array.isArray(restoredAuthIds), "Restored inventory required");
    const profiles = new Set();
    const authIds = new Set();
    for (const intent of intents) {
      const key = keyFor(this.keys, intent.keyVersion);
      for (const profile of restoredProfiles) {
        const profileMatch = token(this.namespace, "profile", profile.profileId, key) === intent.profileToken;
        const authMatch = profile.authId != null && token(this.namespace, "auth", profile.authId, key) === intent.authToken;
        if (profileMatch || authMatch) profiles.add(profile.profileId);
      }
      for (const authId of restoredAuthIds) {
        if (token(this.namespace, "auth", authId, key) === intent.authToken) authIds.add(authId);
      }
    }
    const plan = { profiles: [...profiles], authIds: [...authIds] };
    await apply(structuredClone(plan));
    requireValue(await verify(structuredClone(plan)) === true, "Restore cleanup verification failed");
    this.#verified = structuredClone(checkpoint);
    return plan;
  }
  open(latestIndependentCheckpoint, ownerApproved) {
    // A failed opening attempt must also close any earlier opening.
    this.#open = false;
    requireValue(ownerApproved === true && this.#verified
      && latestIndependentCheckpoint?.namespace === this.namespace
      && latestIndependentCheckpoint.sequence === this.#verified.sequence
      && equalHash(latestIndependentCheckpoint.head, this.#verified.head),
    "Restore access remains closed: approval/verification/fresh checkpoint required");
    this.#open = true;
  }
}
