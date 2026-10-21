// Restore the exact backup into new isolated copies; never contact original APIs.
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { readEntry, readManifest, readPrivateFile, verifyBundle } from "./encrypted-backup.mjs";

const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
const project = resolve(import.meta.dirname, "..");
const db = "plates_restore_check_42a10f01";
const storage = "plates_storage_restore_42a10f01";
const directory = "/Users/roryjohnson/Plates Backups/plates-backup-1365e643-0d3e-4514-a4f4-2a664c1344b2";
const keyPath = "/Users/roryjohnson/Plates Backup Keys/backup.key";
const created = [];
let dbStarted = false;
let stage = "approval";
function check(ok) { if (!ok) throw new Error("Restore check refused"); }
function run(args, input) {
  return execFileSync(docker, args, { input, encoding: "utf8", maxBuffer: 1024 * 1024,
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] }).trim();
}
function sql(query) {
  return run(["exec", "-i", "--user", "postgres", db, "psql", "-X", "-qAt", "-h", "/tmp",
    "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "-"], query);
}
const requestCode = `import { createHash } from 'node:crypto';
let input=''; for await(const part of process.stdin) input+=part;
const p=JSON.parse(input); const r=await fetch('http://127.0.0.1:5000'+p.path,
{method:p.method??'GET',headers:p.headers,body:p.bytes?Buffer.from(p.bytes,'base64'):p.json?JSON.stringify(p.json):undefined,signal:AbortSignal.timeout(10000)});
const b=Buffer.from(await r.arrayBuffer());
console.log(JSON.stringify({status:r.status,size:b.length,hash:createHash('sha256').update(b).digest('hex'),json:p.expectJson?JSON.parse(b.toString()):undefined}));`;
function request(input) {
  return JSON.parse(run(["exec", "-i", storage, "node", "--input-type=module", "-e", requestCode], JSON.stringify(input)));
}
function token(secret, role, sub) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const text = encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ role, sub, exp: Math.floor(Date.now() / 1000) + 3600 });
  return text + "." + createHmac("sha256", secret).update(text).digest("base64url");
}
try {
  check(process.argv.slice(2).join(" ") === "--approved-exact-photo-clone");
  stage = "backup validation";
  const key = await readPrivateFile(keyPath, 32);
  await verifyBundle(directory, key);
  const bundle = await readManifest(directory, key);
  const photos = bundle.manifest.entries.filter((entry) => entry.description.kind === "storage-object");
  check(photos.length === 32 && new Set(photos.map((entry) => JSON.stringify([entry.description.bucket, entry.description.path]))).size === 32);
  stage = "fresh isolated database restore";
  // Child checker refuses any existing name and always stops its own created copy.
  execFileSync(process.execPath, [resolve(project, "scripts/local-backup-restore-check.mjs"), directory, keyPath,
    db, "--approved-new-container"], { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  stage = "scratch database private-loopback configuration";
  const isolation = JSON.parse(run(["inspect", "--format", "{{json .HostConfig}}", db]));
  check(isolation.NetworkMode === "none" && !Object.keys(isolation.PortBindings ?? {}).length
    && !(isolation.Binds ?? []).length && !(isolation.Mounts ?? []).length);
  run(["start", db]); dbStarted = true;
  run(["exec", "-i", "--user", "postgres", db, "sh", "-c", "cat > /tmp/plates_storage_restore_hba"],
    "local all all trust\nhost postgres supabase_storage_admin 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n");
  run(["exec", "-d", "--user", "postgres", db, "postgres", "-D", "/tmp/plates_restore_check", "-k", "/tmp",
    "-c", "listen_addresses=127.0.0.1", "-c", "shared_preload_libraries=",
    "-c", "hba_file=/tmp/plates_storage_restore_hba"]);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { sql("select 1;"); ready = true; break; } catch { await new Promise((done) => setTimeout(done, 500)); }
  }
  check(ready);
  const password = randomBytes(32).toString("hex");
  sql(`alter role supabase_storage_admin login password '${password}';`);
  const metadata = JSON.parse(sql("select coalesce(json_agg(json_build_object('bucket',bucket_id,'path',name,'mime',metadata->>'mimetype')),'[]') from storage.objects;"));
  check(metadata.length === photos.length && sql("select count(*) from storage.buckets where public;") === "0");
  stage = "new isolated Storage service";
  const image = run(["inspect", "--format", "{{.Image}}", "supabase_storage_plates"]);
  check(/^sha256:[0-9a-f]{64}$/.test(image));
  const secret = randomBytes(32).toString("hex");
  const env = { DATABASE_URL: `postgresql://supabase_storage_admin:${password}@127.0.0.1:5432/postgres`,
    PGRST_JWT_SECRET: secret, AUTH_JWT_SECRET: secret, ANON_KEY: token(secret, "anon"),
    SERVICE_KEY: token(secret, "service_role"), STORAGE_BACKEND: "file", FILE_STORAGE_BACKEND_PATH: "/mnt",
    STORAGE_FILE_BACKEND_PATH: "/mnt", TENANT_ID: "stub", GLOBAL_S3_BUCKET: "stub", REGION: "local",
    FILE_SIZE_LIMIT: "536870912", UPLOAD_FILE_SIZE_LIMIT: "536870912", SERVER_PORT: "5000", DB_INSTALL_ROLES: "false",
    ENABLE_IMAGE_TRANSFORMATION: "false", IMAGE_TRANSFORMATION_ENABLED: "false", PG_QUEUE_ENABLE: "false",
    LOGFLARE_ENABLED: "false", LOG_LEVEL: "fatal" };
  // Fresh scratch-only secrets are passed to Docker, never printed or reused from the app.
  run(["create", "--pull=never", "--network", `container:${db}`, "--name", storage,
    ...Object.entries(env).flatMap(([name, value]) => ["--env", `${name}=${value}`]), image]);
  created.push(storage);
  const storageConfig = JSON.parse(run(["inspect", "--format", "{{json .HostConfig}}", storage]));
  check(storageConfig.NetworkMode.startsWith("container:") && !Object.keys(storageConfig.PortBindings ?? {}).length
    && !(storageConfig.Binds ?? []).length && !(storageConfig.Mounts ?? []).length);
  run(["start", storage]);
  ready = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    try { if (request({ path: "/status" }).status === 200) { ready = true; break; } }
    catch { /* Never expose raw service diagnostics or tokens. */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  check(ready);
  const admin = { Authorization: `Bearer ${env.SERVICE_KEY}` };
  const outsider = { Authorization: `Bearer ${token(secret, "authenticated", randomUUID())}` };
  stage = "exact 32 cloned photo imports and delivery checks";
  for (const entry of photos) {
    const { bucket, path } = entry.description;
    const original = metadata.find((object) => object.bucket === bucket && object.path === path);
    check(original);
    const route = "/object/" + encodeURIComponent(bucket) + "/" + path.split("/").map(encodeURIComponent).join("/");
    const bytes = await readEntry(bundle.directory, bundle.manifest, entry, key);
    const imported = request({ method: "POST", path: route,
      headers: { ...admin, "Content-Type": original.mime || "application/octet-stream", "x-upsert": "true" }, bytes: bytes.toString("base64") });
    check(imported.status >= 200 && imported.status < 300);
    const delivered = request({ path: route, headers: admin });
    check(delivered.status === 200 && delivered.size === entry.size && delivered.hash === entry.sha256);
    check(request({ path: route }).status >= 400);
    check(request({ path: route, headers: outsider }).status >= 400);
    check(request({ path: route.replace("/object/", "/object/public/") }).status >= 400);
    const signed = request({ method: "POST", path: route.replace("/object/", "/object/sign/"),
      headers: { ...admin, "Content-Type": "application/json" }, json: { expiresIn: 60 }, expectJson: true });
    check(signed.status === 200 && typeof signed.json.signedURL === "string"
      && signed.json.signedURL.startsWith("/object/sign/"));
    const signedBytes = request({ path: signed.json.signedURL });
    check(signedBytes.status === 200 && signedBytes.hash === entry.sha256);
  }
  check(sql("select count(*) from storage.objects;") === "32");
  console.log(JSON.stringify({ restoredPhotos: 32, exactBytesMatch: true, signedDeliveryPassed: true,
    anonymousAndOutsiderDenied: true, noPublicPortsOrExternalNetwork: true,
    retainedContainers: [db, storage], deletionReplayTested: false }, null, 2));
} catch {
  console.error(`Photo restore check failed/refused at ${stage}. Original database/Storage were not targeted. Preserve scratch copies for review.`);
  process.exitCode = 1;
} finally {
  for (const name of created.reverse()) {
    try { run(["stop", name]); }
    catch { console.error("Scratch Storage stop could not be confirmed."); process.exitCode = 1; }
  }
  if (dbStarted) {
    try { run(["stop", db]); }
    catch { console.error("Scratch database stop could not be confirmed."); process.exitCode = 1; }
  }
}
