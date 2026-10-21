# Local encrypted backups

Prepared 2026-10-10. This workflow currently targets the local Supabase project only. It does not deploy the app or access a hosted account.

## Current result

- A real backup exists at `/Users/roryjohnson/Plates Backups/plates-backup-1365e643-0d3e-4514-a4f4-2a664c1344b2`.
- Its 34 encrypted parts passed authentication and checksum verification: one complete PostgreSQL archive, one role export without role passwords, and 32 Storage objects. The encrypted manifest includes bucket/path mappings and verification metadata.
- The encryption key is `/Users/roryjohnson/Plates Backup Keys/backup.key`. Do not print it, commit it or put it inside a backup bundle. Losing it makes the encrypted backups unreadable.
- The full database archive was restored successfully into the network-isolated `plates_restore_check_1365e643` container. All five recorded counts matched and the profile RLS flag was preserved. The container has stopped and retains the decrypted test copy; the original database was not changed. This is a database restore check, not full app/privacy acceptance.
- The earlier interrupted bundle `plates-backup-4989f9a9-c181-4e90-b674-a5a39d89bb09` is incomplete and must not be used. It remains in the backup folder; no cleanup is authorised.

## Taking another backup

Run from `/Users/roryjohnson/dev/plates`, only after nobody is editing the app and all media/cleanup writers have stopped:

```sh
node --env-file=.env.local scripts/local-backup.mjs backup '/Users/roryjohnson/Plates Backups' '/Users/roryjohnson/Plates Backup Keys/backup.key' --writers-stopped
```

`--writers-stopped` records your confirmation; it does not stop or detect writers. The tool checks that Storage metadata is unchanged across the copy. Each run creates a new private folder without overwriting earlier backups. A failed run leaves its partial files for review. No database or photo deletion occurs. The currently installed local Supabase and Docker tools must be available.

Verify a completed bundle by replacing `BACKUP_FOLDER_NAME` with its actual folder name:

```sh
node scripts/local-backup.mjs verify '/Users/roryjohnson/Plates Backups/BACKUP_FOLDER_NAME' '/Users/roryjohnson/Plates Backup Keys/backup.key'
```

Verification decrypts each part in memory and checks integrity. It does not restore anything. Keep the original folder name and every encrypted file when copying a bundle; encryption binds each part to its bundle name. The folders/files must stay private to your user (folders mode 700, files mode 600).

## Coverage and limits

The database archive contains application tables, Auth records, private erasure queues, Storage metadata, schema, ownership and grants. Photo bytes are separately encrypted. Source exports are held in memory, without intermediate plaintext dump files. Each individual part, including the database archive, is limited to 512 MiB; larger projects need a reviewed streaming approach.

This does not capture app code, `.env.local`, deployment settings, service credentials, database-role passwords or an independently current deletion index. Restoring secrets protected by external keys (including any Vault encryption key) needs separate key custody and verification. Database counts and one RLS flag are basic restore checks, not complete application or privacy acceptance tests. With separate exact owner approval, all 32 photo bytes were subsequently restored into the installed Storage service in fresh isolated copies; byte hashes, signed delivery and anonymous/outsider denial passed. See `PHOTO_RESTORE_TEST_SCOPE.md`. Hosted delivery, transforms and CDN/browser caches remain untested.

Keep a second protected copy of the encrypted bundle on another device, and a separately protected copy of the key. Two folders on the same Mac protect against neither loss nor failure of that Mac. No external copy or automatic schedule has been created. There is no automatic expiry or deletion of backups; choose a retention period before real-user use and obtain exact approval for cleanup.

## Restore safety

Never restore directly over the working database. The local restore checker creates a new container from the already installed source image, with no network and no published ports. It restores through an internal socket, checks counts and the profile RLS flag, and stops the container. It neither starts Supabase HTTP services nor deletes the retained test copy. A retained restore copy contains decrypted confidential database data and must remain private.

Every new restore-container name and lifecycle requires owner review. The existing test name cannot be reused for a fresh restore: creation refuses an existing container. Do not remove it to bypass that guard. Diagnosis/retry procedures are separate from a completed restore.

The initial attempt failed at PostgreSQL 17 role-grant restoration because a fresh administrator had a different bootstrap identity. An approved retry preserved bootstrap OID 10 as `supabase_admin`, using a scratch-only helper session so that PostgreSQL permits renaming the original operator. The source role script is adapted only in memory for that existing bootstrap identity; the encrypted archive stays unchanged. All other source role/grant statements ran successfully, followed by the full database archive restore. The helper role remains in the stopped copy and must never be used as a hosted/app account. See [PostgreSQL 17 role grantor rules](https://www.postgresql.org/docs/17/sql-grant.html).

`scripts/local-backup-restore-check.mjs` applies this bootstrap adaptation for future new-container checks too. Its existing-container retry flag is restricted to the diagnosed container and an untouched bootstrap-only database; it refuses the now-restored copy. Do not rerun that retry. Subsequent approved photo/replay drills passed this corrected path in two fresh database containers. The checker currently obtains the installed image from `supabase_db_plates`; recovery on another Mac needs a matching database image and a reviewed procedure. The backup does not contain that image.

## Deletion protection and hosting remain separate

A backup can contain an account that was later erased. Before opening any restored app or direct API, check the independently current deletion record, reapply those erasures, and verify cleanup while access remains closed. The durable local record workflow passed filesystem tests, and a separately approved old-snapshot/independent-intent drill passed real cleanup in isolated database/Storage copies. See `LOCAL_DELETION_RECORDS.md`. The local app now requires durable intent acknowledgement through a trusted server and private database mirror; candidate/applied-schema checks and an exactly approved disposable HTTP/Storage/Auth acceptance run passed. Hosted replay/access fencing remain unimplemented. General account erasure remains disabled. Keep the latest deletion histories/checkpoints and their key separately from this older backup; never restore the older backup's copy as the current deletion history.

The agreed initial hosting direction is Vercel for the website and Supabase for database/Auth/photos, with manual backups initially. No hosted project or deployment was created. This local command does not back up a future hosted project; prepare its explicit authorised export, photo-copy, retention and isolation procedure before relying on it.
