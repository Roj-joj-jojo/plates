import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createBundle, createKey, decryptPart, encryptPart, outsideProject,
  readEntry, readManifest, readPrivateFile, verifyBundle } from "./encrypted-backup.mjs";

const key = randomBytes(32);
const data = Buffer.from("Synthetic database row and photo bytes, no real account data");
const encrypted = encryptPart(data, key, "synthetic/context");
assert(!encrypted.includes(data));
assert.deepEqual(decryptPart(encrypted, key, "synthetic/context"), data);
assert.throws(() => decryptPart(encrypted, randomBytes(32), "synthetic/context"));
assert.throws(() => decryptPart(encrypted, key, "wrong-context"));
assert.throws(() => decryptPart(encrypted.subarray(0, 25), key, "synthetic/context"));
const changed = Buffer.from(encrypted); changed[changed.length - 1] ^= 1;
assert.throws(() => decryptPart(changed, key, "synthetic/context"));
const temp = await mkdtemp("/private/tmp/plates-backup-test-");
const folder = resolve(temp, "bundles");
const keys = resolve(temp, "keys");
await mkdir(folder, { mode: 0o700 }); await mkdir(keys, { mode: 0o700 });
const keyPath = resolve(keys, "test.key");
await createKey(keyPath);
assert.equal((await readPrivateFile(keyPath, 32)).length, 32);
await assert.rejects(createKey(keyPath)); // Never replace an existing key.
await assert.rejects(outsideProject(folder, temp));
const entries = [{ kind: "postgres-custom", data },
  { kind: "storage-object", bucket: "synthetic", path: "private/photo.webp", data: randomBytes(2048) }];
const directory = await createBundle(folder, key, entries, { synthetic: true });
assert.deepEqual(await verifyBundle(directory, key), { verifiedParts: 2,
  counts: { "postgres-custom": 1, "storage-object": 1 } });
const bundle = await readManifest(directory, key);
assert.deepEqual(await readEntry(directory, bundle.manifest, bundle.manifest.entries[0], key), data);
assert(!String(await readFile(resolve(directory, "manifest.enc"))).includes("private/photo.webp"));
await assert.rejects(verifyBundle(directory, randomBytes(32)));
const first = resolve(directory, bundle.manifest.entries[0].filename);
const damaged = await readFile(first); damaged[damaged.length - 1] ^= 1;
await writeFile(first, damaged); // Exact synthetic test file, intentionally corrupt for verification.
await assert.rejects(verifyBundle(directory, key));
async function* failedSource() { yield entries[0]; throw new Error("Synthetic source failure"); }
await assert.rejects(createBundle(folder, key, failedSource(), { synthetic: true }));
console.log("PASS encrypted backup: authenticated round-trip, wrong-key/context/tamper/truncation refusal, private key creation, no overwrite, manifest privacy and partial-source failure; synthetic temporary files retained");
