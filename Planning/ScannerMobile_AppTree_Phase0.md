# Scanner Mobile App Tree (Phase 0 Baseline)

## Location
- `apps/scanner-mobile`

## Tree
- `assets/`
- `LogoColor.svg` (brand source asset)
- `splash-logo.png` (native splash-compatible raster)
- `src/app/App.js` (app bootstrap, font loading, auth gate)
- `src/modules/auth/`
- `LoginScreen.js` (login-only UX, no registration)
- `authApi.js` (scanner login API integration)
- `sessionStorage.js` (secure token storage)
- `src/modules/scanner/` (reserved for QR feature implementation)
- `src/modules/visitor-intake/` (reserved for voice and walk-in feature)
- `src/modules/stats/` (reserved for realtime event stats screens)
- `src/shared/api/client.js` (axios base client)
- `src/shared/i18n/index.js` (EN/AR localization resources)
- `src/shared/theme/tokens.js` (design tokens + font strategy)
- `src/shared/components/BrandedSplash.js` (startup splash view)
- `app.json` (Expo app config + native splash)
- `package.json`
- `babel.config.js`
- `index.js`

## Design Notes
- Login credentials are provisioned from existing admin system (no signup flow in mobile app).
- Arabic language uses Cairo font and RTL-aware rendering.
- Startup flow is optimized for speed:
- short splash
- secure token restore
- immediate auth gate decision

## Next Tree Expansions (Phase 1/2)
- `src/modules/scanner/screens/ScannerHomeScreen.js`
- `src/modules/scanner/components/CameraScannerView.js`
- `src/modules/scanner/components/ScanResultCard.js`
- `src/modules/stats/screens/EventStatsScreen.js`
- `src/modules/visitor-intake/screens/VisitorIntakeScreen.js`
- `src/modules/visitor-intake/services/voiceExtractionService.js`

## Performance Guardrails
- Keep expensive parsing and scan throttling in isolated hooks.
- Avoid global rerenders by isolating module state boundaries.
- Cache event list and last selected event per session.
- Keep visual effects subtle and GPU-friendly for mid-range Android devices.
