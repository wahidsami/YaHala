# Event-First Refactor Plan

- Date: 2026-05-07
- Project: YaHala (Admin + API + Scanner Mobile alignment)
- Owner: Engineering + Product
- Status: Draft for approval
- Objective: Simplify invitation operations into an event-centric workflow while preserving existing data model and backward compatibility.

## 1) Problem Statement

Current operator workflow is fragmented:
- Event setup is done in Event Dashboard.
- Core invitation actions (sync/send/delivery management) are done in Invitation Project pages.
- This causes context switching, confusion, and more runtime failure surface on high-touch routes.

Desired workflow:
1. Add client
2. Add event under client
3. Setup event (template, guests, addons)
4. Send invitations from event context
5. Monitor event-level dashboard:
   - invitations sent/failed
   - attended guests
   - addon tabs if enabled

## 2) Design Principles

1. Event-first UX for 90% of users.
2. Invitation project remains as internal/advanced layer (not removed initially).
3. Zero data loss; additive migration path.
4. Backward compatibility for existing project APIs/UI links.
5. Operational safety: no connection-closing failures on invitation actions.

## 3) Target Architecture (High Level)

## 3.1 Primary Model
- Event becomes the orchestration root.
- Each event has one "primary invitation project" used by event-level actions.
- Existing additional projects remain possible for advanced use-cases.

## 3.2 Event-Level Action Surface
- Event dashboard owns:
  - sync template
  - send invitations
  - delivery summary
  - addon visibility
  - attendance + check-in metrics

## 3.3 Project Layer
- Project APIs continue to exist.
- Event APIs wrap/forward to project services when needed.
- Advanced project UI is moved behind “Advanced” entry point.

## 4) Implementation Scope

## In Scope
- New event-level API endpoints for invitation operations.
- Event dashboard enhancements.
- Primary-project resolution logic.
- Robust error handling and structured logging.
- QA matrix + rollout gates.

## Out of Scope (Phase 1)
- Removing invitation project DB tables.
- Major redesign of template builder internals.
- Multi-channel orchestration rewrite (SMS/WhatsApp) beyond current behavior.

## 5) Detailed Phases

## Phase A - Discovery and Contracts
- Status: `done`

### A.1 Current Flow Mapping
- Map these backend routes and dependencies:
  - `POST /admin/invitation-projects/:id/sync-template`
  - `POST /admin/invitation-projects/:id/send-email`
  - `POST /admin/invitation-projects/:id/send-email/trace`
  - project context load helpers (`fetchProjectWithContext`, snapshot builders, delivery queue)
- Map event setup dependency:
  - `PATCH /admin/events/:id/invitation-setup`
  - how `invitation_setup.tabs` and template selection are persisted.

### A.2 Data Contract Definition
- Define event-level response contract:
  - invitation summary (`queued`, `sent`, `failed`, `delivered`, `opened`, `responded`)
  - attendance summary (`invited`, `checked_in`, `pending`, walk-ins)
  - addons summary (enabled addon IDs + bound tabs)
- Freeze error contract:
  - `VALIDATION_ERROR`, `NOT_FOUND`, `PERMISSION_DENIED`, `EVENT_SCOPE_VIOLATION`, `DELIVERY_PROVIDER_ERROR`.

### A.3 Acceptance
- Approved OpenAPI-style contract draft for new event-level endpoints.
- [x] Completed and documented in Sections 6 and 7 of this file.

## Phase B - Data and Primary Project Strategy
- Status: `in_progress`

### B.1 Primary Project Selection Rule
- Add deterministic rule:
  1. explicit `events.primary_invitation_project_id` if present
  2. else latest project for event with status in (`active`, `draft`, `paused`)
  3. else auto-create a project from event setup

### B.2 Optional Schema Additions (Recommended)
- Migration 016 (proposed):
  - add `primary_invitation_project_id` to `events` (nullable FK to `invitation_projects.id`)
  - add index on `events(primary_invitation_project_id)`
- Keep fallback logic for old records.
- [x] Migration `016_events_primary_invitation_project.sql` added.

### B.3 Backfill Script
- One-time script:
  - sets `primary_invitation_project_id` for events with exactly one project.
  - logs unresolved events (zero or multiple projects).
- [x] Added migration `017_backfill_events_primary_invitation_project.sql` to auto-select best candidate per event.

### B.4 Acceptance
- Every active event resolves a primary project at runtime.

## Phase C - Event-Level Backend Endpoints
- Status: `in_progress`

### C.1 New Endpoints
- `POST /api/admin/events/:id/sync-invitation-template`
  - resolves primary project
  - performs sync logic currently in project route
  - returns lightweight payload `{ eventId, projectId, synced, coverTemplateHash }`
- [x] Implemented in `apps/api/src/routes/events.js`.

- `POST /api/admin/events/:id/send-invitations`
  - request: `{ scheduledFor?: string | null, recipientIds?: string[] }`
  - resolves primary project
  - forwards to invitation send service
  - returns summary + batch metadata

- `GET /api/admin/events/:id/invitation-summary`
  - returns aggregated delivery states + response funnel

- `GET /api/admin/events/:id/attendance-summary`
  - invitation attendance + walk-ins + scanner duplicate scans

- `GET /api/admin/events/:id/addons-summary`
  - source from `event.settings.addIns` + `invitation_setup.tabs`

### C.2 Internal Refactor
- Extract services from `invitationProjects.js`:
  - `syncInvitationTemplate(projectId)`
  - `executeInvitationEmailSend(...)`
  - `buildInvitationEmailSendContext(...)`
- Reuse from both project route and new event routes.

### C.3 Hardening Requirements
- All new routes:
  - transaction boundaries
  - rollback safety
  - structured `console.error` context with `eventId`, `projectId`, `route`, `error.message`
  - never return connection-closed due to uncaught exceptions

### C.4 Acceptance
- Event-level APIs pass functional tests for valid/invalid event/project states.

## Phase D - Admin UX Refactor (Event Command Center)
- Status: `pending`

### D.1 Event Dashboard Tabs
- Add/upgrade tabs in event dashboard:
  - Overview
  - Invitation Operations (new)
  - Addons
  - Polls
  - Submissions
  - Memory Book

### D.2 Invitation Operations Tab
- Controls:
  - Sync Template (event-level endpoint)
  - Send Invitations (immediate/scheduled)
  - Debug/Trace drawer (optional for admins)
- Panels:
  - delivery funnel cards
  - last send attempts
  - failed recipient reasons (grouped)

### D.3 Addons Tab Behavior
- Show addon cards only when enabled in event settings.
- For poll addon:
  - show attached poll tabs summary
  - quick link to poll management

### D.4 De-Emphasize Project Pages
- Keep invitation-project pages accessible via “Advanced”.
- Remove project-first CTAs from default event flow.

### D.5 Acceptance
- Normal operator can complete setup/send/observe entirely from event dashboard.

## Phase E - Scanner and Reporting Alignment
- Status: `pending`

### E.1 Scanner
- Ensure scanner stats endpoints remain event-scoped and consistent with new event dashboard metrics.
- Confirm no behavior regression in scanner flows (already event-scoped by session).

### E.2 Reporting
- Align event report definitions:
  - sent vs delivered semantics
  - attended from invitation vs walk-in
  - duplicate scans

### E.3 Acceptance
- Admin event dashboard and scanner reports display coherent metric totals.

## Phase F - QA, Rollout, and Observability
- Status: `pending`

### F.1 Test Matrix
- Auth states: valid token, expired token, missing permission.
- Event states: no project, one project, multiple projects.
- Delivery states: provider configured/not configured, queued/sent/failed.
- Addons states: none/poll-enabled/poll-with-tabs.
- High-load smoke: repeated sync/send clicks.

### F.2 Monitoring
- Add route-level logs:
  - request id, event id, project id, duration, result code.
- Alert conditions:
  - 5xx spike on event invitation routes.
  - repeated `DELIVERY_PROVIDER_ERROR`.

### F.3 Rollout Steps
1. Deploy API with new event routes + service extraction.
2. Run migrations/backfill.
3. Deploy admin event dashboard UI.
4. Soft launch to internal admins.
5. Hide project-first flows behind advanced mode.
6. Gradually move docs/runbooks to event-first only.

### F.4 Rollback Plan
- Keep old project endpoints active.
- Feature flag event-level invitation controls.
- Re-enable legacy navigation instantly if severe regressions.

## 6) Endpoint Proposal (Concrete)

## POST `/api/admin/events/:id/sync-invitation-template`
Response:
```json
{
  "data": {
    "eventId": "uuid",
    "projectId": "uuid",
    "synced": true,
    "coverTemplateHash": "sha256..."
  }
}
```

## POST `/api/admin/events/:id/send-invitations`
Request:
```json
{
  "scheduledFor": null,
  "recipientIds": []
}
```
Response:
```json
{
  "data": {
    "eventId": "uuid",
    "projectId": "uuid",
    "summary": {
      "queued": 120,
      "sent": 0,
      "failed": 0
    }
  }
}
```

## GET `/api/admin/events/:id/invitation-summary`
Response:
```json
{
  "data": {
    "totals": {
      "recipients": 350,
      "queued": 120,
      "sent": 300,
      "delivered": 270,
      "opened": 180,
      "responded": 90,
      "failed": 12
    },
    "lastUpdatedAt": "ISO-8601"
  }
}
```

## 7) UI Change List (Concrete)

1. `apps/admin/src/pages/events/EventDashboardPage.jsx`
- add Invitation Operations tab and wire to event-level endpoints.
- move Send Invitations CTA from passive button to working flow.

2. New component:
- `apps/admin/src/pages/events/components/EventInvitationOpsTab.jsx`
- handles sync/send/summary/error states.

3. Keep existing:
- `EventInvitationSetupTab.jsx` for setup (template + poll tabs).
- invitation-project detail page as Advanced mode only.

## 8) Risks and Mitigations

1. Duplicate logic between event and project routes
- Mitigation: extract shared services before wiring new routes.

2. Events with no project
- Mitigation: runtime auto-provision + explicit admin warning banner.

3. Metric discrepancies across dashboards
- Mitigation: single aggregation service consumed by both event dashboard and reports.

4. Operator confusion during transition
- Mitigation: phased rollout + in-app “Advanced” label for legacy project screens.

## 9) Delivery Timeline (Suggested)

- Week 1:
  - Phase A + B contracts and migration.
- Week 2:
  - Phase C backend routes + hardening.
- Week 3:
  - Phase D admin UI command center.
- Week 4:
  - Phase E/F QA, observability, rollout.

## 10) Definition of Done

System is done when:
1. Operator can complete full invitation lifecycle from event dashboard only.
2. Invitation project pages are optional/advanced, not required.
3. Event dashboard shows send/failed, attendance, and addon tabs as requested.
4. No `ERR_CONNECTION_CLOSED` on sync/send operations in normal usage.
5. KPI values are consistent between event dashboard and reports.

## 11) Execution Tracking

- [x] Phase A done
- [ ] Phase B done
- [ ] Phase C done
- [ ] Phase D done
- [ ] Phase E done
- [ ] Phase F done

## Change Log
- 2026-05-07: Initial detailed plan created for review.
- 2026-05-07: Phase A completed (current-state mapping + endpoint contract draft + UI target mapping).
- 2026-05-07: Phase B started with schema migration `016` for event primary invitation project pointer.
- 2026-05-07: Added migration `017` to backfill `events.primary_invitation_project_id` for existing events.
- 2026-05-07: Phase C started with event-level endpoint `POST /api/admin/events/:id/sync-invitation-template`.
