# Scanner Mobile Pilot QA Runbook

## Purpose
Validate the full scanner-mobile event-door flow in a controlled way before pilot launch.

## Scope
- Login (scanner credentials provisioned from admin system)
- Event loading and selection
- QR scan flow (camera + manual)
- Voice intake flow (record, transcribe, extract, edit, approve)
- Invitation queue handoff
- Realtime event stats
- Arabic/English language behavior

## Preconditions
- API running and reachable from mobile app (`EXPO_PUBLIC_API_URL`).
- Scanner user exists and status is `active`.
- Event exists under scanner's client.
- At least one invitation project exists for event (for invite queue test).
- `OPENAI_API_KEY` configured on API for STT.
- Delivery env keys configured where email queue should operate.

## Environment Variables Checklist
- API:
- `JWT_ACCESS_SECRET`
- `SCANNER_JWT_SECRET` (optional distinct)
- `STT_PROVIDER=openai`
- `OPENAI_API_KEY=<key>`
- `OPENAI_STT_MODEL=gpt-4o-mini-transcribe`
- `PUBLIC_INVITATION_BASE_URL=<invite-domain>`

- Mobile (Expo):
- `EXPO_PUBLIC_API_URL=https://<api-domain>/api`

## Test Accounts and Data
- Scanner account:
- Client identifier: `<client email or UUID>`
- Scanner name: `<scanner_user.name>`
- PIN: `<known test pin>`

- Test event:
- `event_id`: `<uuid>`

- Test invite token:
- Valid recipient token for same event
- Invalid/random token

## Test Matrix

### A) Authentication and Session
1. Login with valid scanner credentials.
Expected:
- User enters scanner home.
- Assigned events load.

2. Login with invalid PIN.
Expected:
- Error message shown.
- No session created.

3. Reopen app after login.
Expected:
- Session restore works (if token valid).
- User remains in scanner flow.

4. Logout.
Expected:
- Secure token removed.
- Returned to login screen.

### B) Event Scope and Security
1. Verify only events for scanner client are visible.
Expected:
- No cross-client events.

2. Scan valid token from another client (if available).
Expected:
- Backend rejects with client mismatch.

### C) QR Scan Path
1. Camera scan valid token.
Expected:
- Status `attended` or `duplicate`.
- Recent scans updated.
- Stats refresh reflects check-in.

2. Camera scan same token twice.
Expected:
- Second response marked duplicate.

3. Manual scan with valid token URL.
Expected:
- Token extraction works.
- Same behavior as camera flow.

4. Scan invalid token.
Expected:
- Failure state shown with clear message.

### D) Voice Intake Path
1. Record voice in English, then transcribe.
Expected:
- Transcript populated.

2. Extract fields from transcript.
Expected:
- Name/email/mobile/optional fields auto-filled.
- Confidence chips visible.
- Warning panel visible when data missing/invalid.

3. Edit incorrect field manually.
Expected:
- Edited value retained on submit.

4. Approve & Add (without check-in).
Expected:
- Guest created.
- Result status `added`.

5. Approve & Check In.
Expected:
- Guest created/updated and checked in.
- Result status `attended`.

6. Approve with email present.
Expected:
- `sendInvitation` path triggered.
- Response shows invitation `queued` or `skipped` with reason.

### E) Realtime Stats
1. Open stats on selected event.
Expected:
- Invited, checked in, pending, walk-ins shown.

2. Perform scan / walk-in and refresh.
Expected:
- Stats move accordingly.

### F) Localization and Typography
1. Switch to Arabic.
Expected:
- Cairo font used.
- Arabic labels readable.
- Layout still usable.

2. Voice intake in Arabic.
Expected:
- Transcript and extraction function.

### G) Failure and Recovery
1. Disable network mid-flow.
Expected:
- Action fails gracefully.
- No app crash.

2. Re-enable network and retry.
Expected:
- Flow resumes.

## Defect Logging Template
- ID:
- Scenario:
- Steps to Reproduce:
- Expected:
- Actual:
- Severity: (`blocker` / `high` / `medium` / `low`)
- Device + OS:
- Language mode:
- Screenshot/Video:

## Pilot Exit Criteria
- No blocker issues in A/B/C/D flows.
- No high severity security/scope defects.
- Crash-free through full checklist on at least:
- 1 Android physical device
- 1 iOS physical device
- STT and invitation queue verified at least once end-to-end.
