# Managed profile-image storage maintenance

This procedure concerns generated account profile images only. It does not authorize deletion of workshop documents, backups or unknown files. No historical cleanup runs automatically.

## Bounds enforced by the application

- Input image: at most 2 MiB; PNG/JPEG, decoded and re-encoded as PNG, at most 2048 × 2048 pixels, one frame.
- Normalized output: at most 16 MiB.
- Managed generated images: 256 MiB. A replacement excludes the account's previous, correctly owned generated file from the quota calculation. Until that old file is removed, replacement can temporarily use up to another 16 MiB.
- Accounting examines at most 1024 top-level `profile_*` files. Exceeding this count, encountering a generated-name reparse point, or exhausting the byte budget prevents another upload. The API returns 507 for a quota rejection.
- Upload execution is limited to one in-flight request per application process, with no waiting queue; each account is limited to ten attempts per minute. Busy/rate rejection returns 429.

On successful replacement, the application attempts to delete only the previous generated basename owned by that account. After successful account deletion, it attempts the same narrowly scoped cleanup. Cleanup failure does not reverse a successful database operation; a leftover generated image still counts against later quota checks. Failed saves attempt to remove the newly written file.

These are single-process safeguards. They are not a distributed filesystem quota, a limit on total workshop database size, or protection against unrelated processes filling the disk. Unknown filenames are preserved; files outside the managed naming convention are not included in the managed byte total.

## Operator review of historical orphans

1. Arrange a maintenance window and stop application writes, including uploads and account deletion. Establish the actual absolute directory from `Uploads:Path` (or the application's `uploads` default). Do not infer the path from a browser URL.
2. Back up the database and that exact upload directory consistently, including SQLite sidecars where required by the chosen backup method. Verify that the backup can be restored. Preserve file names and account-to-image references.
3. Review only ordinary files directly inside the resolved directory. Do not follow directory links/reparse points or recurse. Generated names match `^profile_(\d+)_[a-zA-Z0-9]+\.(png|jpg|jpeg)$`. The captured number is the owner ID; both legacy timestamp and current GUID suffixes are covered.
4. Compare each candidate with `Users.Id` and `Users.ProfilePicturePath`. Keep every file currently referenced by its matching owner. A missing owner, or a different current reference, makes a file a *candidate* orphan, not permission for automatic deletion. Investigate unexpected paths, duplicate references, links, unknown files and inconsistent records separately. Never delete a file just because it is old.
5. After explicit review, quarantine only individually identified orphan basenames to an operator-selected backup directory outside the served upload root. Verify both resolved paths and ownership before moving anything. Keep a list of exact names and a reversible backup. Do not use a recursive wildcard delete, and do not change business records to make cleanup easier.
6. Restart the application and verify existing profile images and a test account's replacement behavior. Retain the quarantine until the operator is satisfied that no valid reference was missed. Restore individual files from backup if necessary.

The application does not perform this maintenance procedure, scan real workshop storage for deletion, or remove historical orphans during startup. This stage's automated tests use disposable directories only.
