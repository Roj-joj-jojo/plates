import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { photoWorkerConfig } from "./photo-worker-config.mjs";

export function localPhotoWorkerEnvironment(appUrl, status, args = []) {
  const environment = {
    PHOTO_WORKER_ENABLED: "true",
    PHOTO_WORKER_ENVIRONMENT: "local",
    PHOTO_WORKER_SUPABASE_URL: status.API_URL,
    PHOTO_WORKER_EXPECTED_ORIGIN: appUrl,
    PHOTO_WORKER_SERVICE_KEY: status.SERVICE_ROLE_KEY,
  };
  photoWorkerConfig(environment, args);
  return environment;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const appUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Validate local destination and recovery arguments before credential discovery.
    localPhotoWorkerEnvironment(appUrl, {
      API_URL: appUrl, SERVICE_ROLE_KEY: "PLACEHOLDER_PREFLIGHT_ONLY",
    }, args);
    const status = JSON.parse(execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000,
    }));
    Object.assign(process.env, localPhotoWorkerEnvironment(appUrl, status, args));
    // Import in the same process so Ctrl+C reaches the existing drain handler.
    // Run this .mjs file normally; --input-type breaks file-based decoder threads.
    await import("./photo-worker.mjs");
  } catch {
    console.error("Local photo worker startup refused. Check local Supabase, app URL and recovery arguments; credentials were not displayed.");
    process.exitCode = 1;
  }
}
