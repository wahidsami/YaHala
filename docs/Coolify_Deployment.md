# Coolify Deployment Guide for YaHala / Rawaj

Last reviewed: 2026-05-01

## 1. What this project actually is

This repository is a Node/React monorepo with npm workspaces.

- Root workspace file: `package.json`
- Lockfile: `package-lock.json`
- API: `apps/api`
- Admin frontend: `apps/admin`
- Scanner frontend: `apps/scanner`

Important findings from the codebase:

- The current code uses PostgreSQL, not MySQL.
- `apps/admin` is the main dashboard and also serves public invitation routes like `/invite/:token`.
- `apps/scanner` is a separate frontend for event scanning.
- The API stores uploaded/generated files on disk under `apps/api/storage`.
- There is a separate background worker at `apps/api/src/workers/deliveryWorker.js` for queued email delivery.

Local checks completed on this repo:

- `npm install` succeeded from the repo root.
- `npm run build --workspace=apps/admin` succeeded.
- `npm run build --workspace=apps/scanner` succeeded.
- API runtime was not fully tested because no production PostgreSQL credentials were available locally.

## 2. Recommended Coolify layout

I recommend creating these resources in Coolify:

1. PostgreSQL database service
2. API application
3. Admin application
4. Scanner application

Optional later:

5. Dedicated delivery worker for queued email sending

Why this layout:

- This repo keeps the lockfile at the root, so using root-level workspace commands is safer than deploying each subfolder independently.
- `admin` and `scanner` are static Vite apps.
- `api` is the only HTTP backend.

## 3. Domain plan

Main domain:

- `https://testproject.cloud/`

Domains for this project:

- API: `https://yapi.testproject.cloud/`
- Admin: `https://yadmin.testproject.cloud/`
- Public invitations: `https://yinvite.testproject.cloud/`
- Scanner: `https://yscanner.testproject.cloud/`

You can also put both admin and invite traffic on the same Coolify admin resource by adding both domains to that resource.

## 4. Deploy order

1. Create PostgreSQL in Coolify
2. Deploy API
3. Import the existing database dump
4. Deploy Admin
5. Deploy Scanner
6. Test login, invite page, scanner, uploads
7. Use migrations/seed only if you are not importing the dump
8. Add email worker only if you need queued invitation delivery

## 5. PostgreSQL setup

Create a PostgreSQL service from Coolify's database/service options.

Use these values in the API app:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Keep backups enabled if available in your Coolify setup.

This repo already includes a database dump at:

- [rawaj_db.sql](D:/Projects/waheed/yahala/YaHala/rawaj_db.sql)

Important:

- Even though the file name ends with `.sql`, it is a PostgreSQL custom dump, not a plain SQL text file.
- So initial import should use `pg_restore`, not `psql`.

Recommended database name:

- `rawaj_db`

## 6. Import the existing database dump

Recommended approach for first deployment:

1. Create the PostgreSQL service in Coolify
2. Create or confirm the database name is `rawaj_db`
3. Enable required PostgreSQL extension(s)
4. Import `rawaj_db.sql` into that database
4. Do not run `migrate` and `seed` immediately after import unless you know the dump is incomplete

Before restore, connect to `rawaj_db` and run:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Why this is required:

- This project schema uses `uuid_generate_v4()` in many tables.
- That function comes from the `uuid-ossp` extension.
- The repo migrations also create it in `apps/api/src/db/migrations/001_initial_schema.sql`.

Example import command from your own machine after PostgreSQL client tools are installed:

```bash
pg_restore --no-owner --no-privileges --clean --if-exists -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d rawaj_db rawaj_db.sql
```

PowerShell example with password set temporarily:

```powershell
$env:PGPASSWORD="YOUR_DB_PASSWORD"
pg_restore --no-owner --no-privileges --clean --if-exists -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d rawaj_db .\rawaj_db.sql
Remove-Item Env:PGPASSWORD
```

If `pg_restore` is not installed on your local machine, install PostgreSQL client tools first.

After import, verify:

- admin users exist
- clients/events data exists
- app login works before running any seed script

### pgAdmin restore notes

This dump contains database-level metadata for `rawaj_db`.

If you are restoring into an already-created `rawaj_db` database from pgAdmin, use these settings:

- Right click `rawaj_db` -> `Restore`
- Format: `Custom or tar`
- Filename: your local `rawaj_db.sql`
- Clean before restore: `On`
- Single transaction: `Off`
- No owner: `On`
- No privileges: `On`
- Create database: `Off`

Important:

- Do not paste the dump into Query Tool.
- Do not use the `Post Connection SQL` box for `DATABASE_URL=...`; keep that field empty.
- If `Create database` is turned on while restoring into the already-open `rawaj_db`, restore can fail because the dump already contains database-level create/drop metadata.
- If restore log shows `function public.uuid_generate_v4() does not exist`, create `uuid-ossp` first and run restore again.

### Coolify Import Backup screen

For the Coolify `Import Backup` UI, use a simple custom import command:

```bash
pg_restore --verbose --clean --if-exists --no-owner --no-privileges -U $POSTGRES_USER -d $POSTGRES_DB
```

Important:

- Keep `Backup includes all databases` unchecked for this project unless you know your dump is a full cluster backup.
- Upload `rawaj_db.sql` in the file picker below that command.
- Do not use `psql` for this file, because this dump is in PostgreSQL custom format.
- If you restore into an empty database, prefer `--if-exists` together with `--clean` to reduce harmless drop errors.

If you used a command like this:

```bash
pg_restore -U $POSTGRES_USER -d ${POSTGRES_DB:${POSTGRES_USER:-postgres}}
```

that syntax is invalid. The fallback expression is malformed.

If you really want a fallback expression, the valid version is:

```bash
pg_restore -U $POSTGRES_USER -d ${POSTGRES_DB:-${POSTGRES_USER:-postgres}}
```

But in Coolify, the simpler form is better:

```bash
pg_restore --verbose --clean --if-exists --no-owner --no-privileges -U $POSTGRES_USER -d $POSTGRES_DB
```

### Restore troubleshooting

If you see many lines like:

- `relation "... " does not exist`
- `index "... " does not exist`
- `constraint "... " does not exist`

at the beginning of restore, that usually comes from `--clean` on an empty database. Those lines are noisy, but they are not the real blocker by themselves.

The real blocking error in this project is:

```text
ERROR: function public.uuid_generate_v4() does not exist
```

Fix:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Then rerun the restore.

If `uuid-ossp` already exists and restore log ends with only these kinds of messages:

```text
ERROR: cannot drop schema public because other objects depend on it
ERROR: schema "public" already exists
warning: errors ignored on restore: 2
```

that usually means:

- `pg_restore --clean` tried to drop `public`
- `uuid-ossp` depends on `public`, so PostgreSQL refused the drop
- restore still continued and recreated tables/data successfully
- pgAdmin may still mark the whole job as `Failed` because `pg_restore` exited with code `1`

In that case, verify the restored data before retrying again.

Useful verification queries:

```sql
SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp';
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public';

SELECT COUNT(*) AS dashboard_users_count FROM public.dashboard_users;
SELECT COUNT(*) AS clients_count FROM public.clients;
SELECT COUNT(*) AS events_count FROM public.events;
SELECT COUNT(*) AS templates_count FROM public.templates;
```

## 7. API application setup

Create a new Application from your public Git repository.

Recommended settings:

- Build Pack: `Nixpacks`
- Base Directory: `/`
- Port Exposes: `3001`
- Install Command: `npm ci`
- Build Command: leave empty
- Start Command: `npm run start --workspace=apps/api`
- Domain: `https://yapi.testproject.cloud`
- Health check path: `/api/health`

Persistent storage:

- Add a persistent volume for uploads/generated files
- Mount target: `/app/apps/api/storage`

Environment variables for the API:

```env
NODE_ENV=production
PORT=3001

DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=rawaj_db
DB_USER=your-postgres-user
DB_PASSWORD=your-postgres-password

JWT_ACCESS_SECRET=change-this-to-a-long-random-secret
JWT_REFRESH_SECRET=change-this-to-a-different-long-random-secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
SCANNER_JWT_SECRET=optional-separate-secret-for-scanner

CORS_ORIGIN=https://yadmin.testproject.cloud,https://yinvite.testproject.cloud,https://yscanner.testproject.cloud
PUBLIC_INVITATION_BASE_URL=https://yinvite.testproject.cloud

RESEND_API_KEY=add-your-existing-resend-key-in-coolify-secret
RESEND_FROM_EMAIL=YaHala <noreply@unifinitylab.com>

DELIVERY_POLL_INTERVAL_MS=15000
DELIVERY_MAX_RETRIES=3
DELIVERY_RETRY_BASE_DELAY_MS=60000
```

Notes:

- `CORS_ORIGIN` must include every frontend origin that calls the API.
- `PUBLIC_INVITATION_BASE_URL` should point to the public invite domain, not the API domain.
- `RESEND_API_KEY` should be stored in Coolify as a secret, not hardcoded in Git-tracked files.
- API variables are runtime variables.
- Your old local file used `NODE_ENV=development`; in Coolify use `NODE_ENV=production`.

## 8. Database initialization fallback

Use this only if you are not importing `rawaj_db.sql`.

After the API container is up, open the Coolify terminal for that app and run:

```bash
npm run migrate --workspace=apps/api
npm run seed --workspace=apps/api
```

Seed script creates the default admin:

- Email: `admin@rawaj.com`
- Password: `Admin@123`

Important note:

- The current migration runner does not keep a migrations history table.
- It simply reruns every SQL file in `apps/api/src/db/migrations`.
- The current scripts appear mostly idempotent, but for future schema changes you should keep this in mind.
- If you already restored `rawaj_db.sql`, skip this section unless you intentionally want a fresh empty database instead.

## 9. Admin application setup

Create another Application from the same public Git repository.

Recommended settings:

- Build Pack: `Nixpacks`
- Base Directory: `/`
- Is it a static site?: `Yes`
- Install Command: `npm ci`
- Build Command: `npm run build --workspace=apps/admin`
- Publish Directory: `apps/admin/dist`
- Domain: `https://yadmin.testproject.cloud,https://yinvite.testproject.cloud`

Environment variables:

```env
VITE_API_URL=https://yapi.testproject.cloud/api
```

Important:

- `VITE_API_URL` is a build-time variable for Vite.
- In Coolify, keep it available during build.

Routing note:

- This frontend uses React Router for `/login`, `/dashboard`, `/invite/:token`, and more.
- If direct refresh on these routes returns 404, update the generated Nginx config to fall back to `index.html`.

## 10. Scanner application setup

Create a third Application from the same public Git repository.

Recommended settings:

- Build Pack: `Nixpacks`
- Base Directory: `/`
- Is it a static site?: `Yes`
- Install Command: `npm ci`
- Build Command: `npm run build --workspace=apps/scanner`
- Publish Directory: `apps/scanner/dist`
- Domain: `https://yscanner.testproject.cloud`

Environment variables:

```env
VITE_API_URL=https://yapi.testproject.cloud/api
```

Important:

- Scanner camera access works best over HTTPS.
- In production, do not test the scanner on plain HTTP.

## 11. Optional delivery worker

This repo includes a long-running worker:

- Command: `npm run worker:delivery --workspace=apps/api`

Use it if you depend on queued invitation email delivery.

Important limitation:

- Coolify application resources are mainly designed for processes that expose a port.
- This worker does not expose HTTP.

Practical recommendation:

- Deploy core app first without a dedicated worker if email queue features are not critical on day one.
- If queued email delivery is required, add a separate worker deployment path next.
- The clean production solution is to add a small Dockerfile or Docker Compose setup for the worker so it can run as its own managed container.

## 12. Production checklist

- PostgreSQL service running
- API reachable at `/api/health`
- Admin login works
- Public invite page opens
- Scanner login works
- File uploads survive redeploys
- `CORS_ORIGIN` includes all real domains
- HTTPS is enabled for admin, invite, scanner, and api
- Resend keys added if email sending is needed

## 13. Production values summary

Use these final values in Coolify:

```env
# API
NODE_ENV=production
PORT=3001
DB_NAME=rawaj_db
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=https://yadmin.testproject.cloud,https://yinvite.testproject.cloud,https://yscanner.testproject.cloud
PUBLIC_INVITATION_BASE_URL=https://yinvite.testproject.cloud
RESEND_FROM_EMAIL=YaHala <noreply@unifinitylab.com>
DELIVERY_POLL_INTERVAL_MS=15000
DELIVERY_MAX_RETRIES=3
DELIVERY_RETRY_BASE_DELAY_MS=60000

# Admin
VITE_API_URL=https://yapi.testproject.cloud/api

# Scanner
VITE_API_URL=https://yapi.testproject.cloud/api
```

Keep these in Coolify secrets:

- `DB_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `SCANNER_JWT_SECRET` if you use a separate one
- `RESEND_API_KEY`

## 14. Known repo issues to keep in mind

- `README.md` still mentions MySQL, but the live code is PostgreSQL.
- No committed `.env.example` files were found for API/admin/scanner.
- The delivery worker is separate from the web API and still needs a production deployment strategy.
- Admin production bundle is quite large, so later code-splitting may be worth doing, but it is not a deployment blocker.

## 15. Official Coolify docs used for this guide

- Coolify applications overview: `https://coolify.io/docs/applications/`
- Coolify Vite docs: `https://coolify.io/docs/applications/vite`
- Coolify Nixpacks docs: `https://coolify.io/docs/builds/packs/nixpacks`
- Coolify Git deployment docs: `https://coolify.io/docs/applications/ci-cd/introduction`
- Coolify environment variables docs: `https://coolify.io/docs/knowledge-base/environment-variables`
- Coolify domains docs: `https://coolify.io/docs/knowledge-base/domains`
- Coolify health checks docs: `https://coolify.io/docs/knowledge-base/health-checks`
- Coolify firewall docs: `https://coolify.io/docs/knowledge-base/server/firewall`
