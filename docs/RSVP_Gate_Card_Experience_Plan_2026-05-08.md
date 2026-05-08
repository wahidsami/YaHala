# RSVP Gate & Card Reveal Plan

- Date: 2026-05-08
- Project: YaHala Public Invitation Experience
- Owner: Product + Engineering
- Status: Draft for approval
- Objective: Introduce a first-open RSVP gate popup that controls whether the invitation card is revealed, and add a configurable design editor for this popup per event/client identity.

## 1) Desired Behavior (Confirmed)

1. On first open of invitation card, user sees RSVP popup with:
   - `Yes`
   - `No`
   - `Maybe`
2. If user selects `Yes` or `Maybe`:
   - save response
   - show thank-you message with `OK` button
   - after `OK`, reveal invitation card
   - this popup should not appear again for same guest/session
3. If user selects `No`:
   - optionally ask for reason in text field
   - save response (+ optional reason)
   - show farewell/thank-you message
   - do **not** reveal invitation card content
4. Need an editor to configure popup look/feel (colors/icons/texts/variants) to match client identity.

## 2) Product Rules

## 2.1 Display Rules
- Gate applies to `first open` only for a guest invitation token/session.
- Persistence keys:
  - `sessionToken` + backend recipient state (`overall_status` / RSVP status)
  - optional local cache for smoother UX only (not source of truth)

## 2.2 Access Rules
- `Yes/Maybe`: invitation content unlocked.
- `No`: content remains locked (cover + tabs hidden), only final message shown.

## 2.3 Localization
- All popup labels/messages support EN/AR.
- If custom text missing in current language, fallback to default language text.

## 3) UX Architecture

## 3.1 Public Invitation Runtime (`PublicInvitationPage`)
- Replace current optional RSVP modal with a **blocking gate modal** rendered before card content.
- Modal states:
  1. `choose_attendance`
  2. `optional_reason` (only for `No`)
  3. `thank_you_positive` (Yes/Maybe)
  4. `farewell_negative` (No)
- Card render logic:
  - show content only when `gateResult in [attending, maybe]`.
  - keep locked shell when `gateResult = not_attending`.

## 3.2 Admin Config Surface
- New section in Event dashboard (recommended under Invitation Setup or Add-ons):
  - `RSVP Gate Popup Design`
- Controls:
  - Enable/disable gate
  - Popup variant (minimal/card/brand)
  - Primary/secondary colors
  - Icon set or custom icon URL
  - Copy fields:
    - title/body for initial question
    - positive thank-you title/body/button label
    - negative farewell title/body/button label
    - optional reason prompt/placeholder
  - Behavior toggles:
    - show reason field on `No`
    - require reason (optional, default false)

## 4) Data Model & Storage

No new SQL table required for V1.

- Store gate config inside existing event settings JSON:
  - `events.settings.rsvp_gate`
- Suggested structure:
```json
{
  "enabled": true,
  "style": {
    "variant": "brand",
    "primaryColor": "#946FA7",
    "secondaryColor": "#FF9D00",
    "icon": "sparkles"
  },
  "copy": {
    "en": {
      "attendanceTitle": "Will you attend?",
      "attendanceBody": "Please confirm your attendance first.",
      "reasonLabel": "Reason (optional)",
      "reasonPlaceholder": "Share your reason...",
      "positiveTitle": "Thanks for confirming",
      "positiveBody": "Your response has been saved.",
      "positiveButton": "Open invitation",
      "negativeTitle": "Thank you for your response",
      "negativeBody": "We wish to see you in another event.",
      "negativeButton": "OK"
    },
    "ar": {}
  },
  "behavior": {
    "showReasonOnNo": true,
    "requireReasonOnNo": false
  }
}
```

## 5) API Changes

## 5.1 Existing RSVP Submit Endpoint
- Reuse current:
  - `POST /api/public/invitations/:token/rsvp`
- Ensure it accepts/keeps:
  - `attendance` (`attending`, `maybe`, `not_attending`)
  - `notes` (used as optional reason when `No`)

## 5.2 Public Invitation Payload
- Extend:
  - `GET /api/public/invitations/:token`
- Include sanitized `rsvp_gate` config in response.

## 5.3 Admin Update Endpoint
- Reuse event invitation setup patch or add focused endpoint:
  - `PATCH /api/admin/events/:id/rsvp-gate`
- Validate color formats, text lengths, allowed icon ids.

## 6) Detailed Phases

## Phase A - Contract & UX Spec
- Status: `done`
- [x] Finalize gate state machine and copy contract
- [x] Finalize JSON schema for `settings.rsvp_gate`
- [x] Confirm fallback behavior when gate disabled

## Phase B - Public Runtime Gate
- Status: `done`
- [x] Implement blocking RSVP gate modal flow in `PublicInvitationPage`
- [x] Enforce reveal lock/unlock behavior by attendance result
- [x] Persist one-time behavior based on session + backend state

## Phase C - Admin Gate Design Editor
- Status: `done`
- [x] Add RSVP Gate editor UI in event admin
- [x] Add live mini preview (EN/AR, Yes/No/Maybe outcomes)
- [x] Save config to `events.settings.rsvp_gate`

## Phase D - API Validation & Security
- Status: `pending`
- [ ] Add backend validation for gate config payload
- [ ] Ensure public payload only includes safe config fields
- [ ] Keep attendance/no-content lock server-authoritative

## Phase E - QA & Rollout
- Status: `pending`
- [ ] E2E scenarios:
  - yes first-open unlock
  - maybe first-open unlock
  - no first-open lock
  - refresh/reopen no popup repeat for positive responses
  - language fallback behavior
- [ ] Mobile web responsiveness
- [ ] Production rollout checklist + monitoring notes

## 7) Acceptance Criteria

1. First open always asks attendance when gate enabled.
2. `Yes/Maybe` reveals card only after thank-you confirmation.
3. `No` never reveals card content, shows farewell only.
4. Optional reason for `No` is captured when provided.
5. Admin can fully style and localize popup per event.
6. Behavior is stable across refresh/reopen for same guest/session.

## 8) Risks & Mitigations

1. Risk: Client-side bypass of lock.
- Mitigation: enforce lock state based on RSVP result in public response contract.

2. Risk: Copy/style over-customization causes broken UI.
- Mitigation: strict schema + defaults + preview + clamp text lengths.

3. Risk: Backward compatibility with existing invitations.
- Mitigation: gate disabled by default unless config exists/enabled.

## 9) SQL / Migration Requirement

- V1 plan: **No SQL migration required**.
- Uses existing RSVP storage and event settings JSON.
- If future analytics needs structured reason taxonomy or AI scoring tables, add dedicated migration in later phase.

## Implementation Log

- 2026-05-08: Phase A + B implemented.
  - API now returns sanitized `project.event.rsvp_gate` in public invitation payload.
  - API now returns latest RSVP attendance (`recipient.rsvp_attendance`) for authoritative gate state.
  - Public page now enforces blocking RSVP gate:
    - first open requires decision when gate is enabled
    - `attending`/`maybe` unlock after thank-you confirm
    - `not_attending` keeps card locked and shows farewell state.
- 2026-05-08: Phase C implemented.
  - Invitation Setup now includes full RSVP Gate editor (content + appearance + behavior).
  - Added live preview and proper toggle dependency (`Require reason` disabled when `Ask reason` is off).
