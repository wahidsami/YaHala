# Scanner Mobile Phase 6 QA + Release Checklist

- Date: 2026-05-07
- Scope: scanner-mobile enhancements through commit `83920b6`
- Purpose: final gate before production mobile rebuild

## 1) Automated Gates (Completed)

- [x] API syntax checks:
  - `apps/api/src/index.js`
  - `apps/api/src/routes/scanner.js`
- [x] Mobile syntax checks:
  - `apps/scanner-mobile/src/app/App.js`
  - `apps/scanner-mobile/src/modules/auth/LoginScreen.js`
  - `apps/scanner-mobile/src/modules/scanner/ScanScreen.js`
  - `apps/scanner-mobile/src/modules/scanner/GuestsScreen.js`
  - `apps/scanner-mobile/src/modules/scanner/ReportsScreen.js`
  - `apps/scanner-mobile/src/modules/scanner/AddonsScreen.js`
  - `apps/scanner-mobile/src/modules/scanner/CameraScanCard.js`
- [x] Expo Android bundle smoke:
  - `npx expo export --platform android`

## 2) Deployment Order (Required)

1. Redeploy API from latest `main` on Coolify.
2. Run/verify API migrations on VPS DB (if not already current).
3. Confirm API health endpoint.
4. Rebuild scanner-mobile app.

## 3) Manual Smoke (Required Before Wide Rollout)

- [ ] Login flow:
  - enter client + scanner + pin
  - verify event selection appears
  - select event and complete login
- [ ] Header UX:
  - welcome user name shown
  - selected event shown in header
  - logout works from header and account tab
- [ ] Scan tab:
  - camera QR scan works without using debug panel
  - manual token scan works
  - wrong-event token blocked with clear error
- [ ] Guests tab:
  - voice recording + transcribe path works
  - extract fields works
  - approve add-only works
  - approve + check-in works
- [ ] Reports tab:
  - event KPIs load
  - duplicate scan count appears
  - recent scan activity appears
  - pull-to-refresh works
- [ ] Addons tab:
  - section loads and is event-scoped
  - no crash/navigation issues

## 4) Release Decision

- Rebuild for pilot/internal testing: `YES` after API redeploy is complete.
- Rebuild for wider production users: `YES` only after all manual smoke items above are checked.

## 5) Build Commands

From `apps/scanner-mobile`:

```bash
npx eas-cli@latest build --platform android --profile preview
```

Or production:

```bash
npx eas-cli@latest build --platform android --profile production
```
