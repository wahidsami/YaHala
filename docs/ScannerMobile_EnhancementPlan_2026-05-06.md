# Scanner Mobile Enhancement Plan

- Date: 2026-05-06
- Scope: `apps/scanner-mobile` (with required API/admin touchpoints)
- Baseline lock: branch `release/scanner-mobile-baseline-2026-05-06`, tag `scanner-mobile-baseline-2026-05-06`
- Status: Active

## Objectives

1. Add/verify logout in mobile UX.
2. Split scan vs voice-intake into separate sections.
3. Fix scan button behavior (primary scan action must work without debug path).
4. Make scanner session event-specific from login selection.
5. Add event report section with practical operational metrics.
6. Prepare mobile for event addons.
7. Upgrade UI design and add top header welcome.
8. After mobile completion: template builder editor review.
9. After mobile completion: system sections layout review.

## Phase Plan

## Phase 0 - Stability Gate
- Status: `pending`
- [ ] Validate current crash/logging fixes on latest code (`d0fe712+` line).
- [ ] Confirm API DB schema baseline on target envs (`scanner_users.event_id`).
- [ ] Define smoke test list before each enhancement merge.

Acceptance:
- No regression on login, event load, scan API, and visitor intake API before enhancement work starts.

## Phase 1 - Auth and Event-Scoped Session
- Status: `pending`
- [ ] Add explicit event selection in login flow.
- [ ] Update scanner auth/session contract to bind scanner to a selected event for the session.
- [ ] Persist selected event in session state and enforce event scope across scan/stats/intake.
- [ ] Keep logout action visible and consistent in header and account area.

Acceptance:
- User cannot proceed without selecting event.
- All operations run only in selected event context.
- Logout works from all intended entry points.

## Phase 2 - Scan and Intake UX Split + Scan Button Fix
- Status: `pending`
- [ ] Separate "Scan" and "Add Guest (Voice/Text)" into distinct sections/screens in scanner flow.
- [ ] Fix primary scan button/camera trigger so it works without debug controls.
- [ ] Keep debug panel optional (`EXPO_PUBLIC_SCANNER_DEBUG`) and non-blocking.
- [ ] Add clearer scan states: ready, sending, success, duplicate, error.

Acceptance:
- Normal user path can scan successfully without opening debug tools.
- Voice intake is accessible in its own section and does not interfere with scan flow.

## Phase 3 - Event Reports Section
- Status: `pending`
- [ ] Add "Reports" tab/section in mobile.
- [ ] Define and show event-level KPIs:
  - total invites
  - checked-in invites
  - pending invites
  - walk-ins added
  - walk-ins checked-in
  - duplicate scans
  - latest scan activity snapshot
- [ ] Add manual refresh and optional timed refresh.
- [ ] Confirm KPI parity with API/admin definitions.

Acceptance:
- Reports screen is event-scoped and loads reliably.
- Metrics are understandable by scanner operators during event operations.

## Phase 4 - Addons Readiness
- Status: `pending`
- [ ] Audit current addons in system (polls, memory-book related flows, invitation tabs metadata).
- [ ] Define mobile-facing addon container architecture (feature flags + event capability map).
- [ ] Implement placeholder/addon registry section in app shell.
- [ ] Wire at least one addon-ready rendering path (read-only if needed in first pass).

Acceptance:
- Mobile app can discover event addon availability and render prepared sections safely.
- No impact on core scan performance.

## Phase 5 - UI/Design Upgrade
- Status: `pending`
- [ ] Add top header with welcome text and scanner name.
- [ ] Improve information hierarchy (event context, active mode, quick actions).
- [ ] Refine spacing, typography, and cards for less plain layout while keeping performance.
- [ ] Validate Arabic/English visuals and RTL behavior.

Acceptance:
- UI feels production-grade and cohesive across dashboard/scan/reports/account/about.
- Header and navigation are consistent on common phone sizes.

## Phase 6 - QA, Build, and Release Prep
- Status: `pending`
- [ ] Run functional regression on auth/scan/intake/reports/logout.
- [ ] Validate scanner debug log coverage for launch-critical paths.
- [ ] Prepare release checklist and build notes for Expo/EAS.
- [ ] Ship candidate build.

Acceptance:
- Candidate build passes smoke + regression checklist.

## Post-Mobile Workstream (Planned Next)

## Phase 7 - Template Builder Editor Audit & Enhancements
- Status: `pending`
- [ ] Review template builder UX/performance/edge cases.
- [ ] Prioritize fixes and enhancement backlog.

## Phase 8 - System Sections Layout Audit
- Status: `pending`
- [ ] Audit section layout consistency across admin/system pages.
- [ ] Define and apply layout standardization plan.

## Tracking Log

- [ ] Phase 0 - pending
- [ ] Phase 1 - pending
- [ ] Phase 2 - pending
- [ ] Phase 3 - pending
- [ ] Phase 4 - pending
- [ ] Phase 5 - pending
- [ ] Phase 6 - pending
- [ ] Phase 7 - pending
- [ ] Phase 8 - pending

## Update Rule

When a phase is completed:
1. Change that phase `Status` from `pending` to `done`.
2. Mark its tracking checkbox as checked.
3. Add one dated line under this file with what was shipped and commit hash.
