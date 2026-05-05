# Scanner Mobile Expo.dev / EAS Setup

## 1) Where to put `EXPO_PUBLIC_API_URL`
You can set it in any of these places:

1. Local dev file (recommended for your machine):
- `apps/scanner-mobile/.env`
- Content:
```env
EXPO_PUBLIC_API_URL=https://yapi.testproject.cloud/api
```

2. EAS build profile env (already added):
- `apps/scanner-mobile/eas.json`

3. EAS Secrets (recommended for production hygiene):
- `eas secret:create --name EXPO_PUBLIC_API_URL --value https://yapi.testproject.cloud/api`

## 2) One-time setup
From repo root:
```powershell
npm install
```

Install Expo/EAS CLI globally if needed:
```powershell
npm install -g eas-cli expo
```

Login to Expo:
```powershell
eas login
```

Initialize project link (first time only):
```powershell
cd apps/scanner-mobile
eas init
```

## 3) Build commands (Expo.dev / EAS)
Inside `apps/scanner-mobile`:

Android internal build:
```powershell
eas build --platform android --profile preview
```

iOS internal build:
```powershell
eas build --platform ios --profile preview
```

Production Android:
```powershell
eas build --platform android --profile production
```

Production iOS:
```powershell
eas build --platform ios --profile production
```

## 4) Required app identifiers (you should confirm)
Before store release, set these in `app.json`:
- `expo.android.package` (e.g. `com.yahala.scanner`)
- `expo.ios.bundleIdentifier` (e.g. `com.yahala.scanner`)

## 5) Verify API connectivity in build
After installing the app build:
1. Open app login screen
2. Login with scanner credentials
3. Confirm events load
4. Scan token and verify success response

## 6) Backend must be ready
On VPS/Coolify API env:
- `OPENAI_API_KEY`
- `STT_PROVIDER=openai`
- `OPENAI_STT_MODEL=gpt-4o-mini-transcribe` (optional explicit)
- existing JWT/DB/delivery variables

## 7) Worker note
If invitation sending is expected from mobile walk-in flow, ensure delivery worker is running in Coolify.
