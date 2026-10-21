# Proposed local photo-service restore check

Prepared 2026-10-10; not executed by preparing this document. Exact command, from `/Users/roryjohnson/dev/plates`:

```sh
node scripts/local-photo-restore-check.mjs --approved-exact-photo-clone
```

## Exact targets and effects

- Source bundle: `/Users/roryjohnson/Plates Backups/plates-backup-1365e643-0d3e-4514-a4f4-2a664c1344b2`, authenticated using its separately selected backup key. The only imported object targets are its 32 authenticated `storage-object` manifest entries, with their exact bucket/path mappings. Bytes and mappings remain private; the script never prints them.
- Create only `plates_restore_check_42a10f01` and `plates_storage_restore_42a10f01` from the already installed local database/Storage images. Existing names cause refusal; no image is downloaded and no container is removed.
- Restore the complete copied database into the new database container using the already tested bootstrap correction. Then start it with loopback-only TCP within its network-none namespace. Create a fresh scratch-only password for its copied Storage role and a restricted scratch authentication file.
- Start the Storage service sharing only that isolated container network namespace. No host ports, host-directory mounts, original volumes or external network access. No Auth/REST/app/media worker starts. Storage uses its own new file backend and new scratch-only signing credentials; original app credentials are not reused.
- Upload/upsert only the 32 backed-up paths in the new copy. This may replace cloned Storage metadata/versions and any bytes at those exact paths in that new backend. No original object path is contacted or altered. Storage's startup may check its restored migration catalog; its image is the same installed version as the source service.
- Compare served hashes/sizes with the authenticated backup. Test administrative download and signed-URL delivery; require anonymous, public-route and unrelated-authenticated-user denial. Check the cloned object count remains 32.
- Stop only those two scratch containers, retaining their decrypted data for review. No automatic deletion, cleanup worker, migration of the original database, external upload or publication.

## Limits

This exercises the real installed Storage server with copied database metadata and restored bytes. It does not run the full app or Auth service, preserve old production signing keys, test image transformation/CDN/browser caching, replay deletion records or reopen access. The test has deliberately fresh credentials and zero public access. Retained decrypted copies remain confidential. Do not restart/connect/publish/remove them without exact owner approval.

## Approved execution — 2026-10-10

The owner approved this exact scope and the tool-level local Docker/private-file access. The command exited zero: 32 restored files matched the authenticated bytes, administrative and signed-URL delivery passed, and anonymous/public-route/unrelated authenticated access was denied. Both scratch containers stopped without removal. No original database/Storage mutation or external access occurred. Syntax and lint passed. Replay testing is a separately reviewed follow-up in these isolated copies; this result alone does not enable account erasure.
