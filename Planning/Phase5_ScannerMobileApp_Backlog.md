# Scanner Mobile App Implementation Backlog

## Document Control
- Project: YaHala / Rawaj Scanner Mobile
- Owner: Product + Engineering
- Last updated: 2026-05-05
- Status: Active execution plan
- Target app stack: React Native with Expo

## 1. Goals and Success Criteria
- Deliver a production-grade mobile scanner app connected to existing YaHala backend.
- Support secure scanner login and event-scoped QR check-in.
- Support voice-to-data intake for walk-in guests in Arabic and English.
- Enable one-tap guest add + invitation email send.
- Show real-time event stats aligned with admin dashboard behavior.
- Full Arabic/English support, with Cairo font for Arabic UI.

### Success Metrics
- QR scan to check-in response time: under 2 seconds median.
- Voice intake to prefilled form completion: under 10 seconds median.
- Invitation dispatch confirmation shown in app for 95% of valid email submissions.
- App crash-free sessions: 99%+ during pilot.

## 2. Scope

### In Scope (MVP)
- Mobile app (Expo) for scanner users.
- Auth + assigned events selection.
- QR scanning and manual token input fallback.
- Voice recording + speech-to-text + field extraction.
- Guest review/edit form and one-button submit.
- Guest creation + event association + invitation send.
- Real-time event stats cards.
- Arabic and English localization with RTL/LTR and Cairo font for Arabic.

### Out of Scope (Post-MVP)
- Full offline mode with conflict reconciliation.
- WhatsApp/SMS invitation delivery from mobile.
- In-app analytics dashboards beyond core event cards.

## 3. Architecture Decision
- Frontend: React Native + Expo (`apps/scanner-mobile`)
- API: existing `apps/api` scanner/admin routes + new mobile-specific routes
- Auth: scanner JWT (existing scanner auth model)
- Storage: secure token storage (`expo-secure-store`)
- Realtime: polling first (optional websocket later)
- i18n: `i18next` + `react-i18next`
- Arabic font: Cairo loaded via Expo font loader

## 4. Delivery Phases

## Phase 0 - Backend Stabilization (Blocking)
Goal: Make scanner backend reliable before mobile coding deepens.

### Epic P0.1: Scanner API Reliability
- [x] `P0.1-01` Validate `/api/scanner/auth/login` behavior and input variants (`clientIdentifier`, `clientId`).
- [x] `P0.1-02` Validate `/api/scanner/me` token verification and error codes.
- [x] `P0.1-03` Validate `/api/scanner/events` scope filtering by scanner's client.
- [x] `P0.1-04` Validate `/api/scanner/scan` for all statuses (success, already checked-in, invalid token, wrong event).
- [x] `P0.1-05` Add standardized error payload contract for scanner routes.
- [x] `P0.1-06` Add structured logs for scanner actions and failures.

### Epic P0.2: Observability and Test Harness
- [ ] `P0.2-01` Add Postman/Insomnia collection for scanner full flow.
- [ ] `P0.2-02` Add minimal integration tests for scanner routes.
- [ ] `P0.2-03` Add operational checklist for pilot-day troubleshooting.

Acceptance Criteria:
- Scanner API full flow test passes end-to-end from API tooling.
- Error messages are actionable and consistent.

## Phase 1 - Mobile App Foundation
Goal: Deliver app shell, auth, events, language baseline.

### Epic P1.1: App Bootstrap and Standards
- [x] `P1.1-01` Initialize Expo app at `apps/scanner-mobile`.
- [x] `P1.1-02` Set up folder structure:
  - `src/modules/auth`
  - `src/modules/scanner`
  - `src/modules/visitor-intake`
  - `src/modules/stats`
  - `src/shared/api`
  - `src/shared/i18n`
  - `src/shared/theme`
- [ ] `P1.1-03` Configure linting, env config, and build profiles.

### Epic P1.2: Auth and Session
- [x] `P1.2-01` Build login screen (client identifier, scanner name, PIN).
- [x] `P1.2-02` Integrate `/api/scanner/auth/login`.
- [x] `P1.2-03` Store token securely via `expo-secure-store`.
- [x] `P1.2-04` Implement bootstrap session restore and logout.

### Epic P1.3: Language and Typography
- [x] `P1.3-01` Add English/Arabic resources.
- [x] `P1.3-02` Enable RTL layout switching for Arabic.
- [x] `P1.3-03` Load Cairo font and apply to Arabic text styles.
- [x] `P1.3-04` Add settings toggle for language.

Acceptance Criteria:
- User logs in/out successfully.
- Assigned events load after login.
- Arabic mode uses Cairo + proper RTL rendering.

## Phase 2 - QR Scan Workflow
Goal: High-reliability event check-in workflow.

### Epic P2.1: Camera Scanning
- [ ] `P2.1-01` Implement camera permissions flow.
- [ ] `P2.1-02` Add QR detection loop with scan debounce.
- [ ] `P2.1-03` Add fallback manual token/link entry.
- [ ] `P2.1-04` Parse raw token from full URLs safely.

### Epic P2.2: Check-in UX and Validation
- [ ] `P2.2-01` Call `/api/scanner/scan` with selected `eventId`.
- [ ] `P2.2-02` Build result states (success/failed/already attended).
- [ ] `P2.2-03` Show recent scan list with timestamps.
- [ ] `P2.2-04` Add guarded retry for transient network errors.

Acceptance Criteria:
- Staff can scan printed or phone QR quickly and repeatedly.
- Wrong-event and invalid QR cases are clearly handled.

## Phase 3 - Voice-to-Data Walk-In Flow
Goal: Capture walk-in guest data fast and accurately.

### Epic P3.1: Voice Capture + Transcription
- [ ] `P3.1-01` Implement audio record UI with permission handling.
- [ ] `P3.1-02` Integrate bilingual STT provider (Arabic + English).
- [ ] `P3.1-03` Provide transcript preview and manual edit.

### Epic P3.2: Entity Extraction + Form Autofill
- [ ] `P3.2-01` Define extraction schema:
  - `name`
  - `email`
  - `mobileNumber`
  - `organization`
  - `position`
- [ ] `P3.2-02` Build extraction service (rule-based + optional LLM fallback).
- [ ] `P3.2-03` Add validation and confidence hints by field.
- [ ] `P3.2-04` Prefill mobile form and allow quick correction.

### Epic P3.3: One-Tap Approve and Invite
- [ ] `P3.3-01` Implement one button action: add guest + attach to event + send invitation email.
- [ ] `P3.3-02` Show final outcome state:
  - guest created
  - invitation queued/sent
  - invitation failed with reason
- [ ] `P3.3-03` Handle duplicate detection by email/mobile gracefully.

Acceptance Criteria:
- Staff records voice, sees auto-filled fields, confirms once, and invitation is sent.
- End-to-end flow completes without needing admin dashboard intervention.

## Phase 4 - Realtime Event Stats
Goal: Give staff live visibility during the event.

### Epic P4.1: Stats Data and UI
- [ ] `P4.1-01` Add scanner/mobile stats endpoint(s).
- [ ] `P4.1-02` Show cards for:
  - total invited
  - checked in
  - pending
  - walk-ins added
- [ ] `P4.1-03` Add pull-to-refresh.
- [ ] `P4.1-04` Add optional auto-refresh every 15-30 seconds.

Acceptance Criteria:
- Stats screen mirrors core event progress seen in admin realtime context.

## Phase 5 - Hardening and Release
Goal: Pilot-ready and production-ready release.

### Epic P5.1: Quality and Security
- [ ] `P5.1-01` QA matrix for Android/iOS, Arabic/English, camera edge cases.
- [ ] `P5.1-02` Verify token expiry, unauthorized access rejection, secure storage.
- [ ] `P5.1-03` Validate role/event scope boundaries.

### Epic P5.2: Performance and Reliability
- [ ] `P5.2-01` Measure scan latency and optimize.
- [ ] `P5.2-02` Improve retry/backoff strategy for unstable network.
- [ ] `P5.2-03` Add crash/error tracking integration.

### Epic P5.3: Delivery Pipeline
- [ ] `P5.3-01` Configure EAS build profiles.
- [ ] `P5.3-02` Produce Android internal test build.
- [ ] `P5.3-03` Produce iOS TestFlight build.
- [ ] `P5.3-04` Create rollout and rollback runbook.

Acceptance Criteria:
- Pilot users can operate full event check-in flow on production infra.

## 5. Required API Contracts (Proposed)

### Existing Endpoints to Reuse
- `POST /api/scanner/auth/login`
- `GET /api/scanner/me`
- `GET /api/scanner/events`
- `POST /api/scanner/scan`
- `POST /api/scanner/visitor-intake/approve`

### New / Extended Endpoints
- [ ] `GET /api/scanner/events/:eventId/stats`
  - Returns: invited, checkedIn, pending, walkIns, lastUpdatedAt
- [ ] `POST /api/scanner/visitor-intake/voice-extract`
  - Input: transcript text (+ language)
  - Output: extracted fields + confidence map + validation warnings
- [ ] `POST /api/scanner/visitor-intake/approve-and-invite`
  - Input: eventId, normalized guest fields, action (`add_only` | `add_and_check_in`), sendInvitation boolean
  - Output: guest object, attendance state, invitation delivery status

## 6. Database Changes (Proposed)

### Option A (Preferred): Reuse Existing Structures
- Reuse `client_guests`, `event_walk_ins`, invitation recipient and delivery tables.
- Ensure APIs write consistent records and log scanner actions in `activity_logs`.

### Option B: Add Supporting Columns/Tables if Needed
- [ ] Add `source` metadata (`scanner_mobile`, `scanner_web`) on walk-in entries.
- [ ] Add invitation dispatch reference fields on walk-in records.
- [ ] Add STT audit metadata table for debugging extraction quality (optional, privacy reviewed).

## 7. Technical Risks and Mitigations
- STT accuracy in noisy venues:
  - Mitigation: transcript review/edit step before submit.
- Arabic name/email parsing quality:
  - Mitigation: validation + confidence warnings + required manual confirmation.
- Network instability at venues:
  - Mitigation: robust retries + user-visible sync status.
- Duplicate guest creation:
  - Mitigation: backend duplicate checks + merge/attach logic.

## 8. Security and Compliance Checklist
- [ ] Store tokens only in secure storage.
- [ ] No secrets in app bundle.
- [ ] API TLS-only in production.
- [ ] Enforce scanner event/client scope server-side.
- [ ] Redact PII from non-essential logs.
- [ ] Explicit microphone permission text and consent UX.

## 9. QA Plan
- Functional tests:
- auth, scan, voice intake, add+invite, stats refresh.
- Localization tests:
- Arabic RTL layouts, Cairo rendering, mixed-language input.
- Field validation tests:
- invalid email/mobile, partial transcripts, duplicate users.
- Device tests:
- low-end Android, newer iPhone, camera permission edge cases.

## 10. Sprint Breakdown (Suggested)
- Sprint 1:
- Phase 0 + Phase 1
- Sprint 2:
- Phase 2
- Sprint 3:
- Phase 3
- Sprint 4:
- Phase 4 + Phase 5 hardening start
- Sprint 5:
- Release prep and pilot support

## 11. Definition of Done (MVP)
- Scanner user logs in on mobile and sees assigned events.
- QR scan check-in works reliably for active events.
- Walk-in voice flow pre-fills form in Arabic/English.
- One-tap approve creates guest and triggers invitation email.
- Event stats shown in mobile and refresh correctly.
- Arabic UI uses Cairo and proper RTL.
- Pilot build shipped to internal testers.

## 12. Tracking Section (Execution Log)
Use this section during implementation updates.

### Current Phase
- Phase: `Not started`
- Owner: `TBD`
- Start date: `TBD`
- Target date: `TBD`

### Update Log
- 2026-05-05: Backlog created.
- 2026-05-05: Phase 0 scanner API hardening shipped (response envelope normalization, scan mode guard, event stats endpoint).
- 2026-05-05: `apps/scanner-mobile` scaffolded with login-only flow, secure token storage, i18n (EN/AR), Cairo font loading, and branded splash.

### Blockers
- None yet.

### Decisions Log
- 2026-05-05: Chosen approach is React Native + Expo for delivery speed and mobile hardware APIs.
- 2026-05-05: Kept scanner login as system-provisioned credentials only (no mobile registration flow).

- 2026-05-05: Mobile Phase 1 advanced with assigned-events home screen, manual scan flow, recent scans feed, and stats integration from /api/scanner/events/:eventId/stats.

- 2026-05-05: Implemented transcript extraction endpoint (/api/scanner/visitor-intake/voice-extract) and mobile walk-in intake card with extract + editable autofill + approve actions.

- 2026-05-05: Added mobile microphone recording (Expo AV) and backend STT transcription endpoint (/api/scanner/visitor-intake/voice-transcribe) with OpenAI provider integration path.

- 2026-05-05: Extended visitor approval flow with optional invitation queueing (sendInvitation) and mobile result feedback for invitation queued/skipped states.

- 2026-05-05: Added pilot QA runbook and quick checklist docs covering auth, scan, voice intake, invitation queue, stats, localization, and recovery tests.
