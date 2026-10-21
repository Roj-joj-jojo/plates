import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";

const magic = Buffer.from("PLATESB1");
export const MAX_PART_BYTES = 512 * 1024 * 1024;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function check(ok, reason) { if (!ok) throw new Error(reason); }
export function encryptPart(bytes, key, context) {
  check(Buffer.isBuffer(key) && key.length === 32 && Buffer.isBuffer(bytes)
    && bytes.length <= MAX_PART_BYTES, "Invalid key/part size");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([magic, nonce, cipher.getAuthTag(), encrypted]);
}
export function decryptPart(bytes, key, context) {
  check(Buffer.isBuffer(key) && key.length === 32 && Buffer.isBuffer(bytes)
    && bytes.length >= 36 && bytes.length <= MAX_PART_BYTES + 36
    && bytes.subarray(0, 8).equals(magic), "Invalid encrypted part");
  const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(8, 20));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(bytes.subarray(20, 36));
  // Return nothing until authentication succeeds; never feed unverified SQL to a restore.
  return Buffer.concat([cipher.update(bytes.subarray(36)), cipher.final()]);
}
export async function privateDirectory(path) {
  const info = await lstat(path);
  check(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid()
    && (info.mode & 0o077) === 0, "Use an owner-only directory, without symlinks");
  return realpath(path);
}
export async function readPrivateFile(path, maxBytes = MAX_PART_BYTES + 36) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    check(info.isFile() && info.uid === process.getuid() && (info.mode & 0o077) === 0
      && info.size <= maxBytes, "Use an owner-only regular file within the size limit");
    const bytes = await file.readFile();
    check(bytes.length <= maxBytes, "File grew beyond the size limit");
    return bytes;
  } finally { await file.close(); }
}
async function writePrivateFile(path, bytes) {
  const file = await open(path, "wx", 0o600);
  try { await file.writeFile(bytes); await file.sync(); }
  finally { await file.close(); }
}
export async function createKey(path) {
  await privateDirectory(dirname(path));
  await writePrivateFile(path, randomBytes(32));
  const folder = await open(dirname(path), "r");
  try { await folder.sync(); } finally { await folder.close(); }
}
export async function outsideProject(path, project) {
  const actual = await realpath(path);
  const projectPath = await realpath(project);
  check(actual !== projectPath && !actual.startsWith(projectPath + sep), "Keep backup/key files outside the project");
  return actual;
}
export async function createBundle(parent, key, entries, metadata) {
  const base = await privateDirectory(parent);
  const backupId = `plates-backup-${randomUUID()}`;
  const directory = resolve(base, backupId);
  await mkdir(directory, { mode: 0o700 });
  const manifest = { version: 1, backupId, createdAt: new Date().toISOString(), metadata, entries: [] };
  for await (const entry of entries) {
    check(manifest.entries.length < 100000, "Too many backup parts");
    const filename = `part-${String(manifest.entries.length).padStart(6, "0")}.enc`;
    const { data, ...description } = entry;
    await writePrivateFile(resolve(directory, filename), encryptPart(data, key, `${backupId}/${filename}`));
    manifest.entries.push({ filename, description, size: data.length, sha256: hash(data) });
  }
  await writePrivateFile(resolve(directory, "manifest.enc"), encryptPart(Buffer.from(JSON.stringify(manifest)),
    key, `${backupId}/manifest.enc`));
  const folder = await open(directory, "r");
  try { await folder.sync(); } finally { await folder.close(); }
  const parentFolder = await open(base, "r");
  try { await parentFolder.sync(); } finally { await parentFolder.close(); }
  return directory;
}
export async function readManifest(directory, key) {
  const actual = await privateDirectory(directory);
  const backupId = basename(actual);
  check(/^plates-backup-[0-9a-f-]{36}$/.test(backupId), "Unexpected bundle name");
  const manifest = JSON.parse(decryptPart(await readPrivateFile(resolve(actual, "manifest.enc")), key,
    `${backupId}/manifest.enc`).toString("utf8"));
  check(manifest.version === 1 && manifest.backupId === backupId && Array.isArray(manifest.entries)
    && manifest.entries.length <= 100000, "Invalid manifest");
  const seen = new Set();
  for (const entry of manifest.entries) {
    check(/^part-[0-9]{6}\.enc$/.test(entry.filename) && !seen.has(entry.filename)
      && Number.isSafeInteger(entry.size) && entry.size >= 0 && entry.size <= MAX_PART_BYTES
      && typeof entry.sha256 === "string" && /^[0-9a-f]{64}$/.test(entry.sha256)
      && entry.description && typeof entry.description.kind === "string", "Invalid manifest entry");
    seen.add(entry.filename);
  }
  return { directory: actual, manifest };
}
export async function readEntry(directory, manifest, entry, key) {
  const bytes = decryptPart(await readPrivateFile(resolve(directory, entry.filename)), key,
    `${manifest.backupId}/${entry.filename}`);
  check(bytes.length === entry.size && hash(bytes) === entry.sha256, "Backup part checksum mismatch");
  return bytes;
}
export async function verifyBundle(directory, key) {
  const bundle = await readManifest(directory, key);
  const counts = {};
  for (const entry of bundle.manifest.entries) {
    await readEntry(bundle.directory, bundle.manifest, entry, key);
    counts[entry.description.kind] = (counts[entry.description.kind] ?? 0) + 1;
  }
  return { verifiedParts: bundle.manifest.entries.length, counts };
}
