# Atlas backup and restore

## What is backed up

The workflow `.github/workflows/supabase-backup.yml` creates an encrypted archive containing:

- a custom-format PostgreSQL dump (`atlas.dump`);
- a schema-only SQL export (`schema.sql`);
- all objects from every Supabase Storage bucket;
- a Storage manifest;
- SHA-256 checksums;
- the Git commit and UTC timestamp.

The workflow runs every day at 01:30 UTC and can also be started manually from GitHub Actions.

## Required GitHub Actions secrets

Add these under **Repository Settings → Secrets and variables → Actions**:

- `SUPABASE_DB_URL` - the Supabase direct database connection string intended for `pg_dump`;
- `SUPABASE_URL` - for example `https://<project-ref>.supabase.co`;
- `SUPABASE_SERVICE_ROLE_KEY` - the server-side service-role key;
- `BACKUP_ENCRYPTION_PASSWORD` - a long random password stored outside GitHub as well.

Never use the public anon key instead of the service-role key. Never commit any secret to the repository.

## Manual verification

After adding the secrets:

1. Open **GitHub → Actions → Supabase encrypted backup**.
2. Select **Run workflow** on the backup branch.
3. Wait for the job to finish successfully.
4. Download the generated artifact.
5. Verify its checksum:

```bash
sha256sum -c atlas-supabase-*.tar.gz.enc.sha256
```

6. Decrypt it:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 \
  -in atlas-supabase-YYYY-MM-DDTHH-MM-SSZ.tar.gz.enc \
  -out atlas-supabase.tar.gz \
  -pass env:BACKUP_ENCRYPTION_PASSWORD
```

7. Extract it:

```bash
tar -xzf atlas-supabase.tar.gz
```

8. Verify internal checksums:

```bash
cd backup
sha256sum -c SHA256SUMS.txt
```

## Database restore

Restore first into a separate recovery project, never directly over Production without verification.

```bash
pg_restore \
  --dbname="$RECOVERY_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  backup/database/atlas.dump
```

After restoration, verify at minimum:

- event count and published events;
- organizers and permissions;
- orders, payment transactions and tickets;
- ticket categories, venues and seat maps;
- HYP transaction identifiers;
- QR and Wallet ticket generation.

## Storage restore

The Storage export preserves the bucket directory layout and includes `_storage-manifest.json`.

Restore objects through the Supabase Storage API or its S3-compatible endpoint. Do not write directly to the `storage.objects` database table.

## Security and retention

- The repository is public, so plaintext backups must never be uploaded as workflow artifacts.
- Artifacts are encrypted before upload.
- GitHub keeps each artifact for 30 days.
- The encryption password must also be kept in a password manager outside GitHub.
- Test decryption and recovery at least once per month.

## Recommended next layer

GitHub Actions artifacts are the first off-site backup layer. A second independent destination such as Cloudflare R2, Backblaze B2, AWS S3 or Google Cloud Storage should be added later for longer retention and protection from GitHub account loss.
