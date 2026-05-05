# YaHala Scanner Mobile: Architecture and Technical Notes

## 1) Purpose

`apps/scanner-mobile` is the dedicated event-entry app used by scanner staff.  
Main responsibilities:

- Authenticate a scanner user for a specific client.
- Show assigned events.
- Scan invitation QR codes and mark guests attended.
- Support manual token entry as fallback.
- Support walk-in visitor intake via voice-to-text and structured fields.
- Optionally send invitation email when creating a walk-in guest.

---

## 2) Tech Stack and Libraries

Core:

- Expo SDK 53 (`expo`)
- React Native (`react-native`)
- React (`react`)
- Axios (`axios`) for API calls
- i18next + react-i18next for EN/AR localization
- `expo-secure-store` for auth token storage
- `expo-camera` for QR scanning
- `expo-av` + `expo-file-system` for voice capture + upload
- `@react-navigation/*` is installed but current flow is mostly single-screen state driven

UI/Theming:

- Custom theme tokens in `src/shared/theme/tokens.js`
- Cairo font via `@expo-google-fonts/cairo`

---

## 3) Folder Structure

`apps/scanner-mobile/src`:

- `app/App.js`
  - Root bootstrap and session flow.
- `modules/auth/`
  - `LoginScreen.js` (3-field login UI)
  - `authApi.js` (scanner login request)
  - `sessionStorage.js` (secure token persistence)
- `modules/scanner/`
  - `ScannerHomeScreen.js` (main operational screen)
  - `CameraScanCard.js` (live camera QR scan)
  - `VisitorIntakeCard.js` (voice intake + guest creation)
  - `scannerApi.js` (scanner endpoints)
- `modules/stats/`
  - `EventStatsCard.js` (event counters)
- `shared/api/client.js`
  - Axios instance; base URL from `EXPO_PUBLIC_API_URL`.
- `shared/i18n/index.js`
  - Language resources and labels.
- `shared/debug/runtimeLogger.js`
  - Lightweight runtime logging helper.
- `shared/components/BrandedSplash.js`
  - Branded loading screen.

---

## 4) Authentication Flow (3 Fields)

Login screen fields:

1. `clientIdentifier` (client email or client ID)
2. `name` (scanner user name)
3. `pin` (scanner PIN)

Flow:

1. `LoginScreen` calls `loginScanner()` in `authApi.js`.
2. Access token saved via `saveAccessToken()` (`expo-secure-store`).
3. `App.js` sets `Authorization: Bearer <token>` in axios default header.
4. App fetches profile (`/scanner/me`) and events (`/scanner/events`).

---

## 5) Main Scanner Screen Flow

`ScannerHomeScreen.js` responsibilities:

- Event selection chip list.
- Camera scan section.
- Event realtime stats section.
- Visitor intake section.
- Manual scan section.
- Latest result + recent scans.

Core scan method:

- `doScan(token, mode)`:
  - Validates active event + token.
  - POST `/scanner/scan` with `{ token, eventId, mode }`.
  - Refreshes stats after success.
  - Stores latest status + recent scan history.

Modes:

- `camera`
- `manual`

---

## 6) Camera Scanner Details

File: `src/modules/scanner/CameraScanCard.js`

### Runtime behavior

- Uses `CameraView` from `expo-camera`.
- QR only:
  - `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`
- Scanning callback:
  - `onBarcodeScanned={enabled ? handleBarcodeScanned : undefined}`
- Camera lifecycle diagnostics:
  - `onCameraReady`
  - `onMountError`

### Token extraction

`extractTokenFromScan(rawValue)` handles:

- Plain token QR content (returns value directly).
- URL forms:
  - `/invite/:token`
  - `/i/:token`
  - query params `?token=` or `?invite=`

### De-dup / throttle

- Uses `lastScanAtRef` to ignore scans within ~1.4s.

### UI statuses

- `Camera initializing...`
- `Camera ready`
- `Scanning QR...`
- `Scan sent successfully`
- `Scan failed`

---

## 7) Camera Debug Panel

A debug panel exists inside `CameraScanCard` and is shown when:

- `EXPO_PUBLIC_SCANNER_DEBUG=true`

Debug panel shows:

- `enabled`
- `busy`
- request state (`idle/sending/success/failed`)
- `lastScanAt`
- raw QR value
- extracted token

### Why it might not appear

For EAS cloud builds, `.env` in local machine is not enough unless env is injected in build profile.  
`apps/scanner-mobile/eas.json` now includes `EXPO_PUBLIC_SCANNER_DEBUG: "true"` for:

- `development`
- `preview`

So rebuild using one of these profiles to see debug panel.

---

## 8) Visitor Intake (Voice + Form)

File: `src/modules/scanner/VisitorIntakeCard.js`

Capabilities:

- Record voice (`expo-av`).
- Convert recording to base64 (`expo-file-system`).
- Send to backend STT endpoint.
- Extract structured fields from transcript.
- Allow manual correction of fields.
- Approve guest with action:
  - `add_only`
  - `add_and_check_in`

Fields:

- Name
- Position
- Organization
- Email
- Mobile Number

Invitation control:

- `Send invitation` toggle added.
- Enabled only when email exists.
- Payload sends `sendInvitation: true/false`.

---

## 9) API Endpoints Used by Mobile

From `scannerApi.js`:

- `GET /scanner/me`
- `GET /scanner/events`
- `GET /scanner/events/:eventId/stats`
- `POST /scanner/scan`
- `POST /scanner/visitor-intake/voice-extract`
- `POST /scanner/visitor-intake/voice-transcribe`
- `POST /scanner/visitor-intake/approve`

Base URL:

- `EXPO_PUBLIC_API_URL`
- Default fallback in code: `http://localhost:3001/api`

---

## 10) App Config Notes

File: `apps/scanner-mobile/app.json`

Important plugin config:

- `expo-camera` plugin configured with:
  - camera permission text
  - microphone permission text
  - `recordAudioAndroid: true`
  - `barcodeScannerEnabled: true`

Because this is native config, camera-related changes require a new binary build.

---

## 11) Operational Checklist for Camera Issues

1. Confirm active event is selected.
2. Confirm app has camera permission.
3. Confirm build includes latest `app.json` and `eas.json`.
4. Build with `preview` or `development` profile.
5. Verify debug panel appears (`EXPO_PUBLIC_SCANNER_DEBUG=true`).
6. Scan QR and inspect:
   - raw value
   - extracted token
   - request status
7. If request fails, inspect backend response message and `/scanner/scan` logs.

---

## 12) Known Current UX/Behavior

- Login requires 3 fields (client identifier, scanner name, PIN).
- Voice transcription and extraction are backend-dependent.
- Invitation sending depends on email + toggle + backend delivery service.
- Camera scan is event-scoped and throttled to avoid accidental duplicates.
