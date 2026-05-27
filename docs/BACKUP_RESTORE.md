# Backup And Restore

## PostgreSQL backup

Create a timestamped custom-format dump:

```bash
cd /opt/trawberry-ai-commerce
./infra/scripts/backup-postgres.sh
```

Default output directory:

- `backups/postgres`

## PostgreSQL restore

Restore from an existing dump:

```bash
cd /opt/trawberry-ai-commerce
./infra/scripts/restore-postgres.sh backups/postgres/postgres-YYYYMMDD-HHMMSS.dump
```

Safety rules:

- the script requires an explicit `RESTORE` confirmation
- run during a maintenance window
- expect application write downtime during restore

## MinIO backup

MinIO persists data in the `minio_data` Docker volume.

Recommended options:

- volume snapshot at the VPS layer
- filesystem backup of the Docker volume path
- object replication to external S3-compatible storage if introduced later

## Recommended schedule

- PostgreSQL dump: daily
- MinIO volume snapshot: daily
- offsite copy: at least daily for production

## Validation

- periodically restore a backup into a staging environment
- verify Prisma-backed application startup against the restored database
- verify a sample product image URL after restoring MinIO data
