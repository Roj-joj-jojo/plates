// Read only installed-image/runtime settings needed to build an isolated restore.
import { execFileSync } from "node:child_process";
const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
try {
  const info = JSON.parse(execFileSync(docker, ["inspect", "supabase_storage_plates"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }))[0];
  const permitted = ["STORAGE_BACKEND", "FILE_STORAGE_BACKEND_PATH", "STORAGE_FILE_BACKEND_PATH",
    "TENANT_ID", "REGION", "GLOBAL_S3_BUCKET", "SERVER_PORT", "DB_INSTALL_ROLES"];
  const settings = Object.fromEntries((info.Config.Env ?? []).filter((value) => permitted.includes(value.split("=")[0]))
    .map((value) => [value.slice(0, value.indexOf("=")), value.slice(value.indexOf("=") + 1)]));
  console.log(JSON.stringify({ installedImage: info.Image, settings }, null, 2));
} catch {
  console.error("Could not inspect local Storage runtime; no settings were printed or changed.");
  process.exitCode = 1;
}
