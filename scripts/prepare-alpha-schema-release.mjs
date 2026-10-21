import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Offline packaging only: no child process, environment/credential loading,
// network connection, database command, deletion or active-migration edit.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(projectRoot, "supabase/releases");
const manifestPath = join(releaseRoot, "dinnerfolk-alpha-20261021.json");
const candidates = [
  "20261014000100_photo_worker.sql",
  "20261015000100_follow_notifications.sql",
  "20261015000200_menu_photo_gallery.sql",
  "20261015000300_menu_removal.sql",
  "20261015000400_plate_interactions.sql",
  "20261015000500_introduction.sql",
  "20261017000100_activity_notifications.sql",
];

async function verifySources() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.format !== 1 || manifest.release !== "dinnerfolk-alpha-20261021"
    || manifest.status !== "prepared-not-sql-verified"
    || manifest.target !== "fresh-supabase-project-only" || !Array.isArray(manifest.files)) {
    throw new Error("Unexpected release manifest; review before packaging");
  }
  const baseNames = (await readdir(join(projectRoot, "supabase/migrations")))
    .filter(name => name.endsWith(".sql")).sort();
  if (baseNames.length !== 26) throw new Error("Base migration inventory changed; review the manifest");
  const expected = [
    ...baseNames.map(name => `supabase/migrations/${name}`),
    ...candidates.map(name => `supabase/candidates/${name}`),
  ];
  if (manifest.files.length !== expected.length) throw new Error("Release must contain all 26 base and 7 later updates");
  let previousVersion = "";
  const verified = [];
  for (const [index, file] of manifest.files.entries()) {
    if (file.source !== expected[index] || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error(`Unexpected source or fingerprint at release position ${index + 1}`);
    }
    const name = file.source.split("/").at(-1);
    const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(name);
    if (!match || match[1] !== file.version || file.version <= previousVersion) {
      throw new Error("Migration versions must be unique and strictly ordered");
    }
    const bytes = await readFile(join(projectRoot, file.source));
    const fingerprint = createHash("sha256").update(bytes).digest("hex");
    if (fingerprint !== file.sha256) throw new Error(`Release source changed: ${file.source}`);
    verified.push({ name, bytes });
    previousVersion = file.version;
  }
  return { manifest, verified };
}

try {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--check", "--prepare"].includes(args[0])) {
    throw new Error("Use --check for read-only validation or --prepare for a new local package");
  }
  const { manifest, verified } = await verifySources();
  console.log("PASS source inventory: 26 base migrations + all 7 later updates; order, unique versions and SHA-256 verified");
  if (args[0] === "--prepare") {
    // A fresh unique directory means earlier packages and owner files are kept.
    const folder = await mkdtemp(join(releaseRoot, "prepared-dinnerfolk-alpha-"));
    const migrationsFolder = join(folder, "migrations");
    await mkdir(migrationsFolder);
    for (const file of verified) {
      await writeFile(join(migrationsFolder, file.name), file.bytes, { flag: "wx", mode: 0o600 });
    }
    await writeFile(join(folder, "RELEASE_MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: "wx", mode: 0o600 });
    await writeFile(join(folder, "README.md"), [
      "# Prepared Dinnerfolk alpha schema",
      "",
      "Status: SOURCE PACKAGED ONLY; SQL installation/acceptance not verified.",
      "33 byte-identical source migrations, ordered by timestamp, including 7 later updates.",
      "No seed.sql, test fixtures, accounts, photos, credentials or local state are included.",
      "",
      "Do not apply this package to the existing local app database: all 7 updates are already installed there.",
      "Do not run a reset, migration repair, hosted link/push or SQL installation without exact owner approval.",
      "Next: prepare and approve an isolated fresh Supabase rehearsal; verify schema equivalence and acceptance.",
      "The first migration requires empty Auth users and an absent private schema.",
      "Supabase vendor Auth/Storage schemas and roles must already exist; this is not a plain-PostgreSQL bootstrap.",
      "No automatic execution or deployment is configured by this directory.",
      "",
    ].join("\n"), { flag: "wx", mode: 0o600 });
    console.log(`Prepared new local package: ${folder}`);
  }
  console.log("No database, worker, network or Git operation performed. Fresh SQL rehearsal remains pending.");
} catch (error) {
  console.error(`Alpha schema preparation refused: ${error.message}`);
  process.exitCode = 1;
}
