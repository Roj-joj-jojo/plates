// Fixed scratch targets only; credentials and object paths never leave local processes.
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";

const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
export function check(ok) { if (!ok) throw new Error("Isolated replay refused"); }
export function run(args, input, binary = docker) {
  return execFileSync(binary, args, { input, encoding: "utf8", maxBuffer: 512 * 1024 * 1024,
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] }).trim();
}
export function dump(db, roles = false) {
  return execFileSync(docker, ["exec", "--user", "postgres", db, roles ? "pg_dumpall" : "pg_dump",
    "-h", "/tmp", "-U", "supabase_admin", ...(roles ? ["--roles-only", "--no-role-passwords"] : ["-d", "postgres", "--format=custom"])],
  { maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}
const fetchCode = `import {createHash} from 'node:crypto'; let s='';for await(const c of process.stdin)s+=c;
const p=JSON.parse(s);const r=await fetch('http://127.0.0.1:5000'+p.path,{method:p.method??'GET',headers:p.headers,body:p.bytes?Buffer.from(p.bytes,'base64'):p.json?JSON.stringify(p.json):undefined,signal:AbortSignal.timeout(10000)});
const b=Buffer.from(await r.arrayBuffer());console.log(JSON.stringify({status:r.status,hash:createHash('sha256').update(b).digest('hex'),bytes:p.returnBytes?b.toString('base64'):undefined,json:p.expectJson?JSON.parse(b.toString()):undefined}));`;
function token(secret, role) {
  const enc = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const text = enc({ alg: "HS256", typ: "JWT" }) + "." + enc({ role, exp: Math.floor(Date.now() / 1000) + 3600 });
  return text + "." + createHmac("sha256", secret).update(text).digest("base64url");
}
export class IsolatedReplayRuntime {
  constructor(suffix) {
    check(["42a10f01", "42a10f02"].includes(suffix));
    this.db = `plates_restore_check_${suffix}`;
    this.storage = `plates_storage_restore_${suffix}`;
    this.dbStarted = false; this.storageStarted = false;
  }
  sql(query) {
    return run(["exec", "-i", "--user", "postgres", this.db, "psql", "-X", "-qAt", "-h", "/tmp",
      "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "-"], query);
  }
  claims(role, sub, statement) {
    check(["service_role", "authenticated"].includes(role));
    if (sub) check(/^[0-9a-f-]{36}$/.test(sub));
    return this.sql(`begin; set local request.jwt.claim.role='${role}';
      ${sub ? `set local request.jwt.claim.sub='${sub}';` : ""}
      set local role ${role}; ${statement} commit;`);
  }
  async start(existing) {
    const host = JSON.parse(run(["inspect", "--format", "{{json .HostConfig}}", this.db]));
    check(host.NetworkMode === "none" && !Object.keys(host.PortBindings ?? {}).length
      && !(host.Binds ?? []).length && !(host.Mounts ?? []).length
      && run(["inspect", "--format", "{{.State.Running}}", this.db]) === "false");
    run(["start", this.db]); this.dbStarted = true;
    run(["exec", "-i", "--user", "postgres", this.db, "sh", "-c", "cat > /tmp/plates_storage_restore_hba"],
      "local all all trust\nhost postgres supabase_storage_admin 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n");
    run(["exec", "-d", "--user", "postgres", this.db, "postgres", "-D", "/tmp/plates_restore_check", "-k", "/tmp",
      "-c", "listen_addresses=127.0.0.1", "-c", "shared_preload_libraries=", "-c", "hba_file=/tmp/plates_storage_restore_hba"]);
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try { this.sql("select 1;"); ready = true; break; } catch { await new Promise((done) => setTimeout(done, 500)); }
    }
    check(ready);
    if (!existing) {
      const password = randomBytes(32).toString("hex"), secret = randomBytes(32).toString("hex");
      this.sql(`alter role supabase_storage_admin login password '${password}';`);
      const env = { DATABASE_URL: `postgresql://supabase_storage_admin:${password}@127.0.0.1:5432/postgres`,
        PGRST_JWT_SECRET: secret, AUTH_JWT_SECRET: secret, ANON_KEY: token(secret, "anon"), SERVICE_KEY: token(secret, "service_role"),
        STORAGE_BACKEND: "file", FILE_STORAGE_BACKEND_PATH: "/mnt", STORAGE_FILE_BACKEND_PATH: "/mnt",
        TENANT_ID: "stub", GLOBAL_S3_BUCKET: "stub", REGION: "local", FILE_SIZE_LIMIT: "536870912",
        SERVER_PORT: "5000", DB_INSTALL_ROLES: "false", ENABLE_IMAGE_TRANSFORMATION: "false",
        IMAGE_TRANSFORMATION_ENABLED: "false", PG_QUEUE_ENABLE: "false", LOGFLARE_ENABLED: "false", LOG_LEVEL: "fatal" };
      const image = run(["inspect", "--format", "{{.Image}}", "supabase_storage_plates"]);
      check(/^sha256:[0-9a-f]{64}$/.test(image));
      run(["create", "--pull=never", "--network", `container:${this.db}`, "--name", this.storage,
        ...Object.entries(env).flatMap(([key, value]) => ["--env", `${key}=${value}`]), image]);
    }
    const config = JSON.parse(run(["inspect", "--format", "{{json .HostConfig}}", this.storage]));
    const dbId = run(["inspect", "--format", "{{.Id}}", this.db]);
    check([`container:${this.db}`, `container:${dbId}`].includes(config.NetworkMode)
      && !Object.keys(config.PortBindings ?? {}).length && !(config.Binds ?? []).length && !(config.Mounts ?? []).length
      && run(["inspect", "--format", "{{.State.Running}}", this.storage]) === "false");
    const env = JSON.parse(run(["inspect", "--format", "{{json .Config.Env}}", this.storage]));
    this.serviceKey = env.find((value) => value.startsWith("SERVICE_KEY="))?.slice("SERVICE_KEY=".length);
    check(this.serviceKey);
    run(["start", this.storage]); this.storageStarted = true;
    ready = false;
    for (let i = 0; i < 45; i++) {
      try { if (this.request({ path: "/status" }).status === 200) { ready = true; break; } } catch { /* Fail closed. */ }
      await new Promise((done) => setTimeout(done, 500));
    }
    check(ready);
  }
  request(input) {
    return JSON.parse(run(["exec", "-i", this.storage, "node", "--input-type=module", "-e", fetchCode], JSON.stringify(input)));
  }
  route(bucket, path) { return "/object/" + encodeURIComponent(bucket) + "/" + path.split("/").map(encodeURIComponent).join("/"); }
  headers(extra = {}) { return { Authorization: `Bearer ${this.serviceKey}`, ...extra }; }
  upload(bucket, path, bytes, mime = "image/webp", upsert = false) {
    const result = this.request({ method: "POST", path: this.route(bucket, path), headers: this.headers({
      "Content-Type": mime, "x-upsert": String(upsert) }), bytes: bytes.toString("base64") });
    check(result.status >= 200 && result.status < 300);
  }
  download(bucket, path) {
    const result = this.request({ path: this.route(bucket, path), headers: this.headers(), returnBytes: true });
    check(result.status === 200); return Buffer.from(result.bytes, "base64");
  }
  stop() {
    let failed = false;
    if (this.storageStarted) { try { run(["stop", this.storage]); } catch { failed = true; } this.storageStarted = false; }
    if (this.dbStarted) { try { run(["stop", this.db]); } catch { failed = true; } this.dbStarted = false; }
    check(!failed);
  }
}
