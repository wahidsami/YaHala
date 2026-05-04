# System Knowledge

## 1) Repository Snapshot
- Project name in repo files: `Rawaj` / `YaHala` (same platform naming context).
- Monorepo with npm workspaces.
- Main apps:
- `apps/api`: Express + PostgreSQL backend.
- `apps/admin`: React admin dashboard + public invitation route rendering.
- `apps/scanner`: React scanner app for door check-in.
- Supporting docs:
- Deployment: `docs/Coolify_Deployment.md`.
- Product planning: `Planning/` (phase/module markdown files).

## 2) Root Tooling and Scripts
- Root `package.json` workspace scripts:
- `dev:api`, `dev:admin`, `dev:scanner`
- `dev:raw` runs api + admin + scanner concurrently.
- `dev` runs `scripts/start-dev.ps1`.
- `worker:delivery` runs API delivery worker in workspace.
- `migrate`, `seed` proxy to API workspace scripts.
- `scripts/start-dev.ps1`:
- Kills processes listening on ports `3001`, `5173`, `5174`, `5175`, `5176`.
- Starts `npm run dev:raw`.
- `start-all.ps1`:
- Opens separate PowerShell windows for `dev`, `dev:scanner`, and `worker:delivery`.

## 3) Backend (`apps/api`) Overview

### 3.1 Runtime Stack
- Node.js ESM (`"type": "module"`).
- Express, `pg`, JWT, `bcryptjs`, CORS, cookie parser.
- Entry point: `apps/api/src/index.js`.

### 3.2 Boot Sequence / Middleware
- Loads env via `dotenv/config`.
- Configures CORS from `CORS_ORIGIN` (comma separated).
- In non-production, allows any localhost origin pattern.
- Parses JSON/urlencoded payloads up to 15mb.
- Serves static files at `/storage` from `apps/api/storage`.
- Health endpoint: `GET /api/health`.
- Uses centralized error middleware (`errorHandler`).

### 3.3 Route Mount Map
- `/api/admin/auth` -> admin auth (login/refresh/logout/me).
- `/api/admin/dashboard` -> dashboard summary.
- `/api/admin/clients` -> clients + client guest management.
- `/api/admin/guests` -> cross-client guest listing/search.
- `/api/admin/events` -> event CRUD, stats, setup, submissions, memory book.
- `/api/admin/invitation-projects` -> invitation project builder + recipients + sending.
- `/api/admin/templates` -> template CRUD, clone, preview.
- `/api/admin/polls` -> poll addon CRUD + reporting/export.
- `/api/admin/logs` -> activity logs.
- `/api/admin/reports` -> reporting overviews.
- `/api/admin/delivery` -> delivery provider/settings endpoints.
- `/api/public/invitations` -> public invitation/token interaction endpoints.
- `/api/scanner` -> scanner auth, event scope, scan + visitor intake.

### 3.4 Auth and Authorization
- Admin auth:
- Access token in `Authorization: Bearer ...`.
- Refresh workflow uses `/admin/auth/refresh` and refresh token persistence table.
- `authenticate` middleware loads user + role + permissions from DB.
- `requirePermission('...')` enforces RBAC.
- Scanner auth:
- Separate JWT secret fallback chain: `SCANNER_JWT_SECRET || JWT_ACCESS_SECRET`.
- Scanner token carries scanner user + client scope.
- Scanner routes use `authenticateScanner`.

### 3.5 Delivery Queue Worker
- Worker entry: `apps/api/src/workers/deliveryWorker.js`.
- Poll loop interval from `DELIVERY_POLL_INTERVAL_MS` (default 15000ms).
- Calls `processEmailDeliveryQueue()` from `services/delivery.js`.
- Queue model supports:
- claiming due jobs with `FOR UPDATE SKIP LOCKED`.
- attempts tracking table.
- exponential retry (`DELIVERY_RETRY_BASE_DELAY_MS`, `DELIVERY_MAX_RETRIES`).
- recipient status updates + invitation events logging.

## 4) Database Layer

### 4.1 Connection
- `apps/api/src/db/connection.js` uses `pg.Pool`.
- Defaults:
- host `localhost`
- port `5432`
- db `rawaj_db`
- user `postgres`
- password empty string

### 4.2 Migrations Behavior
- Migration runner (`db/migrate.js`) executes every `.sql` file in order on each run.
- No migrations history tracking table.
- Practical implication: idempotency relies on SQL scripts being safe/re-runnable.

### 4.3 Core Schema from Migrations
- Security/admin:
- `roles`, `role_permissions`, `dashboard_users`, `refresh_tokens`.
- Tenant/domain:
- `clients`, `events`, `scanner_users`, `activity_logs`.
- Template system:
- `templates`, `template_versions`.
- Guest/event engagement:
- `guests`, `guest_submissions`, `guest_responses`, `memory_books`.
- Client-wide guests:
- `client_guests` (+ org/position/mobile fields via later migrations).
- Poll addon:
- `polls`, `poll_options`, `poll_votes` (+ media columns + vote count trigger).
- Invitation evolution migrations include:
- `011_invitation_recipients_client_guest.sql` (FK/index changes)
- `013_invitation_snapshot.sql` (snapshot/hash/time columns)
- Walk-ins:
- `event_walk_ins` in migration `014_event_walk_ins.sql`.

### 4.4 Important Schema Reality
- Active route/services code heavily uses invitation tables not introduced in visible early migrations, including:
- `invitation_projects`
- `invitation_pages`
- `invitation_modules`
- `invitation_module_fields`
- `invitation_recipients`
- `invitation_events`
- `invitation_delivery_jobs`
- `invitation_delivery_attempts`
- This indicates production/real DB state is ahead of or broader than the currently tracked migration set.
- Existing DB dump/import path is therefore important for parity.

## 5) Admin Frontend (`apps/admin`) Overview

### 5.1 Runtime
- React 18 + React Router v6 + `react-i18next`.
- Axios API client with automatic access-token attachment.
- Response interceptor handles 401 refresh queue and retries.

### 5.2 Route Structure
- Public:
- `/login`
- `/invite/:token` and short alias `/i/:token`
- Protected (inside `ProtectedRoute` + `AppShell`):
- `/dashboard`
- `/clients`, `/clients/new`, `/clients/:id`, `/clients/:id/edit`
- `/events`, `/events/new`, `/events/:id`, `/events/:id/edit`
- `/templates`, `/templates/new`, `/templates/:id`, `/templates/:id/preview`
- `/addons`, poll builder routes
- `/invitation-projects` list/create/detail/edit
- `/guests`, `/reports`, `/logs`, `/settings`

### 5.3 Major Feature Areas in Code
- Client and event lifecycle management.
- Invitation project management (pages, recipients, send flows).
- Template builder + preview simulator + configurable widgets.
- Advanced visual background effects catalog/components.
- Poll addon management + reporting integration.
- Public invitation experience page.
- Delivery settings and operational logs/reports pages.

## 6) Scanner Frontend (`apps/scanner`) Overview
- Standalone React app for event entrance operations.
- Login by client identifier + scanner name + PIN.
- Stores scanner token in localStorage key: `rawaj-scanner-access-token`.
- Retrieves scoped scanner profile via `/scanner/me`.
- Loads allowed/scoped events via `/scanner/events`.
- Camera scanning:
- Uses native `BarcodeDetector` when available.
- Falls back to `jsQR` on video canvas.
- Manual token/link entry supported.
- Visitor intake workflow:
- Manual or speech-assisted capture (Web Speech API when supported).
- Normalizes Arabic/English digits and basic field extraction.
- Approve visitor via `/scanner/visitor-intake/approve`.
- Optional immediate check-in path (`add_and_check_in`).

## 7) Public Invitation + Engagement Flows (System Behavior)
- Invitation recipients have tokenized public links.
- Public routes support:
- open tracking (`/:token/open`)
- RSVP submission (`/:token/rsvp`)
- page-level poll voting (`/:token/pages/:pageKey/vote`)
- Invitation sending supports queued delivery jobs and delivery attempts audit.
- Snapshot/hash logic exists for invitation/template payload consistency.

## 8) Deployment / Hosting Knowledge (from repo docs)
- Repo includes detailed Coolify deployment guidance.
- Recommended deployment split:
- PostgreSQL service
- API app
- Admin static app
- Scanner static app
- Optional separate delivery worker runtime.
- API persistent storage expected for file artifacts under `/app/apps/api/storage`.
- Important envs:
- DB connection vars
- JWT secrets
- `CORS_ORIGIN`
- `PUBLIC_INVITATION_BASE_URL`
- Resend integration vars
- delivery retry/interval vars.

## 9) Known Inconsistencies / Risks
- Root `README.md` still references MySQL, but codebase uses PostgreSQL (`pg`, postgres migrations).
- Migration set appears incomplete relative to invitation subsystem tables referenced in routes/services.
- Migration runner has no schema version table, so re-runs depend on idempotent SQL.
- Delivery worker is separate from API HTTP process and must be planned in production orchestration.

## 10) Practical Mental Model for Future Enhancements
- This is a multi-tenant event invitation platform with three operational surfaces:
- Admin control plane (`apps/admin`)
- Public invitation interaction layer (served by admin frontend + API public routes)
- On-site scanner operations (`apps/scanner` + scanner API routes)
- Core backend centers around:
- RBAC admin auth
- client/event hierarchy
- invitation project/page/module/recipient orchestration
- engagement addons (polls, submissions, memory book)
- delivery queueing + provider dispatch + audit logs

## 11) Files I Relied On Most (for reorientation)
- `README.md`
- `package.json`
- `apps/api/src/index.js`
- `apps/api/src/db/*`
- `apps/api/src/routes/*`
- `apps/api/src/services/delivery.js`
- `apps/api/src/workers/deliveryWorker.js`
- `apps/admin/src/App.jsx`
- `apps/admin/src/contexts/AuthContext.jsx`
- `apps/admin/src/services/api.js`
- `apps/scanner/src/App.jsx`
- `apps/scanner/src/services/api.js`
- `docs/Coolify_Deployment.md`

---
This document is intended as a living technical memory. When we add or refactor modules, update this file so architecture decisions and operational assumptions stay synchronized with the real code.
