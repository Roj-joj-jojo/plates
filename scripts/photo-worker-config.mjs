export function photoWorkerConfig(env, args = []) {
  if (env.PHOTO_WORKER_ENABLED !== "true") throw new Error("Photo worker disabled");
  const environment = env.PHOTO_WORKER_ENVIRONMENT;
  const key = env.PHOTO_WORKER_SERVICE_KEY;
  let url, expected;
  try { url = new URL(env.PHOTO_WORKER_SUPABASE_URL); expected = new URL(env.PHOTO_WORKER_EXPECTED_ORIGIN); }
  catch { throw new Error("Photo worker backend must be explicitly configured"); }
  if (!key || url.origin !== expected.origin || url.pathname !== "/" || expected.pathname !== "/"
    || url.username || url.password || url.search || url.hash || expected.username || expected.password || expected.search || expected.hash) {
    throw new Error("Photo worker configuration invalid");
  }
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (environment === "local" ? !local || !["http:", "https:"].includes(url.protocol)
    : environment !== "hosted" || url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) {
    throw new Error("Photo worker environment mismatch");
  }
  let previousRun = null;
  if (args.length) {
    if (args.length !== 4 || args[0] !== "--recover-stopped-run" || args[2] !== "--writer-stopped"
      || args[3] !== "--requests-drained" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args[1])) {
      throw new Error("Use an exact stopped-run identifier and both operator confirmations");
    }
    previousRun = args[1];
  }
  return { environment, url: url.origin, key, previousRun };
}
