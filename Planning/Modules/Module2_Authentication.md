# Module 2: Authentication & RBAC

## Phase 4 Implementation – Detailed Component Design

---

## 1. Module Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | User authentication and permission enforcement |
| **Scope** | Login, logout, session, tokens, RBAC |
| **Dependencies** | Backend Auth API (Phase 2) |
| **Used By** | All protected routes and components |

---

## 2. Auth State Model

### 2.1 AuthContext State

```
AuthState {
  // Core State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: AuthError | null
  
  // Token State (internal)
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: number | null
}
```

### 2.2 User Object

```
User {
  id: string
  email: string
  name: string
  nameAr: string
  role: 'super_admin' | 'admin_user' | 'report_viewer'
  permissions: string[]
  tenantScope: string[] | 'all'    // Client IDs or 'all' for Super Admin
  language: 'ar' | 'en'
  avatarUrl: string | null
  lastLoginAt: string
}
```

### 2.3 Permission Keys

```
Permission Keys (Complete List):

// Clients
clients.view
clients.create
clients.edit
clients.delete

// Events
events.view
events.create
events.edit
events.delete

// Templates
templates.view
templates.create
templates.edit
templates.delete

// Guests
guests.view
guests.create
guests.edit
guests.delete
guests.import
guests.export

// Reports
reports.view
reports.export

// Logs
logs.view

// Settings
settings.view
settings.edit

// Scanner Users
scanner_users.view
scanner_users.create
scanner_users.edit
scanner_users.delete
```

---

## 3. AuthContext Structure

### 3.1 Context Definition

```
AuthContext
├── State:
│   user: User | null
│   isAuthenticated: boolean
│   isLoading: boolean
│   error: AuthError | null
│
├── Actions:
│   login(email, password): Promise<void>
│   logout(): void
│   refreshSession(): Promise<void>
│   updateProfile(data): Promise<void>
│   changePassword(current, new): Promise<void>
│   clearError(): void
│
├── Permission Helpers:
│   hasPermission(key: string): boolean
│   hasAnyPermission(keys: string[]): boolean
│   hasAllPermissions(keys: string[]): boolean
│   canAccessClient(clientId: string): boolean
│
└── Computed:
    permissions: string[]
    role: string
    tenantScope: string[] | 'all'
```

### 3.2 Provider Implementation Logic

```
AuthProvider Lifecycle:

1. MOUNT
   ├── Check localStorage for tokens
   ├── If tokens exist:
   │   ├── Validate token expiry
   │   ├── If valid → fetchCurrentUser()
   │   └── If expired → attemptRefresh()
   └── If no tokens → isAuthenticated = false, isLoading = false

2. LOGIN
   ├── Call API: POST /api/admin/auth/login
   ├── Store tokens (HttpOnly cookies preferred, fallback localStorage)
   ├── Set user state
   └── Redirect to intended URL or /dashboard

3. LOGOUT
   ├── Call API: POST /api/admin/auth/logout
   ├── Clear tokens
   ├── Clear user state
   └── Redirect to /login

4. TOKEN REFRESH
   ├── Intercept 401 responses
   ├── Queue failed requests
   ├── Call API: POST /api/admin/auth/refresh
   ├── If success → retry queued requests
   └── If fail → logout()
```

---

## 4. Login Flow

### 4.1 Login Page Components

```
<LoginPage>
├── <LoginForm>
│   ├── <EmailInput />
│   ├── <PasswordInput />
│   ├── <LanguageSwitch />      ← Switch before login
│   ├── <RememberMe />          ← Optional
│   └── <SubmitButton />
│
├── <ForgotPasswordLink />
└── <LoginError />              ← Inline error display
```

### 4.2 Login Flow Diagram

```
User enters email + password
         ↓
Click "Login"
         ↓
[LOADING STATE: button disabled, spinner]
         ↓
POST /api/admin/auth/login
  body: { email, password }
         ↓
    ┌────┴────┐
    │         │
 SUCCESS    ERROR
    │         │
    ↓         ↓
Store       Show error:
tokens      - Invalid credentials
    │       - Account locked
    ↓       - Account disabled
Fetch user
profile
    │
    ↓
Redirect to:
  - savedUrl (if exists)
  - OR /dashboard

```

### 4.3 Login API Response

```
Success Response (200):
{
  accessToken: "eyJ...",
  refreshToken: "eyJ...",
  expiresIn: 3600,
  user: {
    id: "usr_123",
    email: "admin@rawaj.com",
    name: "Ahmed Al-Rashid",
    nameAr: "أحمد الرشيد",
    role: "super_admin",
    permissions: ["clients.view", "clients.create", ...],
    tenantScope: "all",
    language: "ar"
  }
}

Error Response (401):
{
  error: "INVALID_CREDENTIALS",
  message: "Email or password is incorrect"
}

Error Response (403):
{
  error: "ACCOUNT_DISABLED",
  message: "Your account has been disabled"
}
```

### 4.4 Login Error Handling

| Error Code | User Message (EN) | User Message (AR) |
|------------|------------------|-------------------|
| `INVALID_CREDENTIALS` | "Invalid email or password" | "البريد الإلكتروني أو كلمة المرور غير صحيحة" |
| `ACCOUNT_DISABLED` | "Your account has been disabled" | "تم تعطيل حسابك" |
| `ACCOUNT_LOCKED` | "Account locked. Try again in 15 minutes" | "الحساب مقفل. حاول مرة أخرى بعد 15 دقيقة" |
| `NETWORK_ERROR` | "Unable to connect. Check your internet" | "تعذر الاتصال. تحقق من الإنترنت" |

---

## 5. Token Handling

### 5.1 Token Storage Strategy

```
PREFERRED: HttpOnly Cookies (Backend sets)
├── Access token in HttpOnly cookie
├── Refresh token in HttpOnly cookie
├── CSRF token for mutations
└── Benefits: XSS-proof

FALLBACK: localStorage (if cookies not supported)
├── Access token in localStorage
├── Refresh token in localStorage
├── Must sanitize all inputs
└── Clear on logout
```

### 5.2 Token Refresh Flow

```
API Request fails with 401
         ↓
Is refresh already in progress?
    ┌────┴────┐
   YES       NO
    │         │
    ↓         ↓
Queue      Set refreshing = true
request    
    │         ↓
    │      POST /api/admin/auth/refresh
    │         │
    │     ┌───┴───┐
    │     │       │
    │  SUCCESS   FAIL
    │     │       │
    │     ↓       ↓
    │  Store    Logout()
    │  new      Redirect
    │  tokens   to /login
    │     │
    │     ↓
    └──► Retry all queued requests
         Set refreshing = false
```

### 5.3 Axios Interceptor Logic

```
Request Interceptor:
  - Attach Authorization header (if not using cookies)
  - Add language header
  - Add CSRF token for mutations

Response Interceptor:
  - 401 → Trigger refresh flow
  - 403 → Redirect to /access-denied
  - 500 → Show generic error toast
```

---

## 6. Permission Evaluation

### 6.1 hasPermission Function

```
hasPermission(key: string): boolean

Logic:
  1. If user is null → return false
  2. If user.role === 'super_admin' → return true (bypass)
  3. Return user.permissions.includes(key)
```

### 6.2 canAccessClient Function

```
canAccessClient(clientId: string): boolean

Logic:
  1. If user is null → return false
  2. If user.tenantScope === 'all' → return true
  3. Return user.tenantScope.includes(clientId)
```

### 6.3 Permission Checks Matrix

```
┌────────────────────────────────────────────────────────────────┐
│  PERMISSION EVALUATION LAYERS                                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Layer 1: ROUTE LEVEL                                          │
│  ────────────────────                                          │
│  <PermissionRoute permission="settings.view">                  │
│    → Blocks entire page if unauthorized                        │
│    → Shows AccessDenied component                              │
│                                                                │
│  Layer 2: COMPONENT LEVEL                                      │
│  ────────────────────────                                      │
│  <RoleGuard permission="clients.delete">                       │
│    <DeleteButton />                                            │
│  </RoleGuard>                                                  │
│    → Hides specific UI elements                                │
│    → Renders nothing if unauthorized                           │
│                                                                │
│  Layer 3: ACTION LEVEL                                         │
│  ─────────────────────                                         │
│  const canEdit = hasPermission('events.edit')                  │
│  <SaveButton disabled={!canEdit} />                            │
│    → Disables actions if unauthorized                          │
│                                                                │
│  Layer 4: API LEVEL                                            │
│  ──────────────────                                            │
│  Backend validates permissions on every request                │
│    → Returns 403 if unauthorized                               │
│    → Frontend shows error toast                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. RoleGuard Behavior

### 7.1 RoleGuard Component

```
<RoleGuard>
├── Props:
│   permission: string | string[]
│   mode: 'all' | 'any'         (default: 'any')
│   fallback?: ReactNode        (default: null)
│   children: ReactNode
│
├── Logic:
│   if mode === 'any':
│     show = hasAnyPermission(permissions)
│   else:
│     show = hasAllPermissions(permissions)
│   
│   return show ? children : fallback
│
└── Usage Examples:
    
    // Single permission
    <RoleGuard permission="clients.delete">
      <DeleteButton />
    </RoleGuard>
    
    // Multiple permissions (any)
    <RoleGuard permission={['events.edit', 'events.delete']}>
      <ActionsMenu />
    </RoleGuard>
    
    // Multiple permissions (all required)
    <RoleGuard permission={['reports.view', 'reports.export']} mode="all">
      <ExportButton />
    </RoleGuard>
    
    // With fallback
    <RoleGuard permission="settings.edit" fallback={<ViewOnlyBadge />}>
      <EditForm />
    </RoleGuard>
```

### 7.2 Hook Alternative

```
usePermissions() Hook

const { hasPermission, hasAnyPermission, canAccessClient } = usePermissions()

// In component
const canDelete = hasPermission('clients.delete')

return (
  <button disabled={!canDelete}>
    Delete
  </button>
)
```

---

## 8. Session Management

### 8.1 Session Timeout

```
Session Timeout Handling:

Token Expiry: 1 hour (access), 7 days (refresh)

IDLE TIMEOUT: 30 minutes of inactivity
├── Track last activity timestamp
├── Show warning modal at 25 minutes
├── Auto-logout at 30 minutes
└── Clear all state, redirect to login

ACTIVITY TRACKING:
├── Mouse movement
├── Keyboard input
├── API requests
└── Update lastActivity timestamp
```

### 8.2 Session Timeout Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                     SESSION EXPIRING                            │
│                                                                 │
│  Your session will expire in 5 minutes due to inactivity.      │
│                                                                 │
│  [Stay Logged In]              [Logout Now]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Actions:
  - Stay Logged In → Refresh token, reset timer
  - Logout Now → Immediate logout
  - Modal timeout → Auto logout
```

### 8.3 Multiple Tab Handling

```
Multi-Tab Sync:

When user logs out in Tab A:
  1. Broadcast logout event via localStorage
  2. Tab B receives event
  3. Tab B clears state and redirects to login

When user logs in in Tab A:
  1. Broadcast login event
  2. Tab B receives event
  3. Tab B refreshes auth state

Implementation:
  window.addEventListener('storage', (e) => {
    if (e.key === 'auth_event') {
      handleAuthEvent(JSON.parse(e.newValue))
    }
  })
```

---

## 9. Forgot Password Flow

### 9.1 Flow Diagram

```
User clicks "Forgot Password"
         ↓
<ForgotPasswordPage>
  Enter email
         ↓
POST /api/admin/auth/forgot-password
         ↓
    ┌────┴────┐
    │         │
 SUCCESS    EMAIL NOT FOUND
    │         │
    ↓         ↓
Show:      Show:
"Check     "Email not
your       registered"
email"     OR (for security)
           same success msg
         ↓
User clicks email link
         ↓
<ResetPasswordPage>
  Enter new password
  Confirm password
         ↓
POST /api/admin/auth/reset-password
  body: { token, newPassword }
         ↓
    ┌────┴────┐
    │         │
 SUCCESS    FAIL
    │         │
    ↓         ↓
Redirect   Show error:
to login   - Token expired
with       - Token invalid
success
message
```

---

## 10. Failure & Edge Cases

### 10.1 Network Failures

| Scenario | Handling |
|----------|----------|
| **No internet** | Show offline banner, disable actions |
| **API timeout** | Show retry button, keep form state |
| **Server error (500)** | Show generic error, log to monitoring |

### 10.2 Auth Edge Cases

| Scenario | Handling |
|----------|----------|
| **Token expires during form fill** | Auto-refresh in background |
| **Refresh token expired** | Redirect to login, save intended URL |
| **Account disabled mid-session** | 403 on next request → logout |
| **Role changed mid-session** | Next refresh fetches new permissions |
| **Multiple failed logins** | Show lockout warning after 3 attempts |

### 10.3 Race Conditions

```
PROBLEM: Multiple 401s trigger multiple refresh attempts

SOLUTION: Refresh Queue
├── First 401 triggers refresh
├── Subsequent 401s are queued
├── All queued requests retry after refresh succeeds
└── If refresh fails, all queued requests error

IMPLEMENTATION:
  let isRefreshing = false
  let failedQueue = []
  
  // On 401:
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    })
  }
  isRefreshing = true
  // ... refresh logic
```

### 10.4 Security Edge Cases

| Scenario | Handling |
|----------|----------|
| **XSS attempt in login** | Sanitize all inputs |
| **CSRF attack** | Use CSRF tokens for mutations |
| **Token in URL** | Never put tokens in URLs |
| **Console token access** | Use HttpOnly cookies |
| **Brute force** | Rate limit login attempts (backend) |

---

## 11. File Structure

```
src/
├── features/
│   └── auth/
│       ├── components/
│       │   ├── LoginForm.jsx
│       │   ├── ForgotPasswordForm.jsx
│       │   ├── ResetPasswordForm.jsx
│       │   ├── SessionTimeoutModal.jsx
│       │   └── AccessDenied.jsx
│       │
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── ForgotPasswordPage.jsx
│       │   └── ResetPasswordPage.jsx
│       │
│       └── index.js
│
├── contexts/
│   └── AuthContext.jsx
│
├── hooks/
│   ├── useAuth.js
│   └── usePermissions.js
│
├── components/
│   └── shared/
│       ├── RoleGuard/
│       ├── ProtectedRoute/
│       └── PermissionRoute/
│
└── services/
    └── authService.js
```

---

## 12. Definition of Done

Module 2 is **COMPLETE** when:

| Criteria | Status |
|----------|--------|
| Login flow works with valid credentials | ⬜ |
| Login shows appropriate errors | ⬜ |
| Logout clears all state and redirects | ⬜ |
| Token refresh works transparently | ⬜ |
| Protected routes block unauthenticated users | ⬜ |
| Permission routes block unauthorized users | ⬜ |
| RoleGuard hides/shows UI correctly | ⬜ |
| Session timeout warning works | ⬜ |
| Forgot password flow works | ⬜ |
| Multi-tab logout sync works | ⬜ |
| All error cases handled gracefully | ⬜ |

---

*Module Version: 1.0*  
*Created: 2026-01-18*
