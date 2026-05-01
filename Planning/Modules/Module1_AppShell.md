# Module 1: App Shell & Layout

## Phase 4 Implementation – Detailed Component Design

---

## 1. Module Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | Foundation layout wrapping all authenticated pages |
| **Scope** | Header, sidebar navigation, content area, RTL/LTR |
| **Dependencies** | Auth context (for user/role), i18n (for language) |
| **Used By** | All authenticated routes |

---

## 2. Component Hierarchy

```
<App>
└── <Providers>
    ├── <AuthProvider>
    ├── <LanguageProvider>
    ├── <ThemeProvider>
    └── <QueryClientProvider>
        └── <Router>
            ├── <PublicRoutes>
            │   └── <LoginPage>
            │
            └── <ProtectedRoutes>
                └── <AppShell>
                    ├── <TopHeader />
                    ├── <SideNavigation />
                    └── <ContentArea>
                        └── <Outlet /> (React Router)
```

---

## 3. Component Specifications

### 3.1 AppShell

```
┌─────────────────────────────────────────────────────────────────┐
│  AppShell                                                       │
├─────────────────────────────────────────────────────────────────┤
│  Purpose: Main layout wrapper for authenticated views           │
│                                                                 │
│  Props: None (uses context)                                     │
│                                                                 │
│  State:                                                         │
│    - sidebarCollapsed: boolean                                  │
│    - sidebarMobileOpen: boolean                                 │
│                                                                 │
│  Consumes:                                                      │
│    - useDirection() → { direction, isRTL }                      │
│    - useAuth() → { user, isAuthenticated }                      │
│                                                                 │
│  Layout:                                                        │
│    - CSS Grid: header (row 1), sidebar + content (row 2)        │
│    - Direction-aware: sidebar position flips with RTL           │
└─────────────────────────────────────────────────────────────────┘
```

**CSS Grid Structure:**

```css
/* LTR Layout */
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: var(--header-height) 1fr;
  grid-template-areas:
    "header header"
    "sidebar content";
  min-height: 100vh;
}

/* RTL Layout - sidebar moves to right */
.app-shell[dir="rtl"] {
  grid-template-areas:
    "header header"
    "content sidebar";
}
```

---

### 3.2 TopHeader

```
┌─────────────────────────────────────────────────────────────────┐
│  TopHeader                                                      │
├─────────────────────────────────────────────────────────────────┤
│  Purpose: Global header with branding and user controls         │
│                                                                 │
│  Layout (LTR):                                                  │
│  [☰ Menu] [Logo]           [🌐 Lang] [🔔 Notif] [👤 User ▼]    │
│                                                                 │
│  Layout (RTL):                                                  │
│  [👤 User ▼] [🔔 Notif] [🌐 Lang]           [Logo] [Menu ☰]    │
│                                                                 │
│  Sub-components:                                                │
│    - <Logo />                                                   │
│    - <MenuToggle /> (mobile/tablet only)                        │
│    - <LanguageSwitch />                                         │
│    - <NotificationBell />                                       │
│    - <UserMenu />                                               │
│                                                                 │
│  Props: None                                                    │
│                                                                 │
│  Consumes:                                                      │
│    - useAuth() → { user, logout }                               │
│    - useLanguage() → { language, setLanguage }                  │
│    - useNotifications() → { unreadCount }                       │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.3 LanguageSwitch

```
┌─────────────────────────────────────────────────────────────────┐
│  LanguageSwitch                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Purpose: Toggle between Arabic and English                     │
│                                                                 │
│  Visual:                                                        │
│    [🇸🇦 العربية | 🇺🇸 EN]  ← Toggle button style                 │
│                                                                 │
│  Behavior:                                                      │
│    1. Click triggers language change                            │
│    2. Updates document.dir immediately                          │
│    3. Persists to localStorage                                  │
│    4. Syncs to user preference API (if authenticated)           │
│    5. No page reload required                                   │
│                                                                 │
│  State: None (uses LanguageContext)                             │
│                                                                 │
│  Actions:                                                       │
│    - toggleLanguage(): void                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.4 UserMenu

```
┌─────────────────────────────────────────────────────────────────┐
│  UserMenu                                                       │
├─────────────────────────────────────────────────────────────────┤
│  Purpose: User info dropdown with actions                       │
│                                                                 │
│  Trigger: Avatar + Name + Chevron                               │
│                                                                 │
│  Dropdown Contents:                                             │
│    ┌─────────────────────────┐                                  │
│    │  👤 Ahmed Al-Rashid     │                                  │
│    │  admin@rawaj.com        │                                  │
│    │  Role: Super Admin      │                                  │
│    ├─────────────────────────┤                                  │
│    │  ⚙️ Profile Settings    │                                  │
│    │  🔒 Change Password     │                                  │
│    ├─────────────────────────┤                                  │
│    │  🚪 Logout              │                                  │
│    └─────────────────────────┘                                  │
│                                                                 │
│  State:                                                         │
│    - isOpen: boolean                                            │
│                                                                 │
│  Consumes:                                                      │
│    - useAuth() → { user, logout }                               │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.5 SideNavigation

```
┌─────────────────────────────────────────────────────────────────┐
│  SideNavigation                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Purpose: Main navigation menu                                  │
│                                                                 │
│  Visual (Expanded):          Visual (Collapsed):                │
│  ┌───────────────────────┐   ┌─────────┐                        │
│  │ 📊 Dashboard          │   │   📊    │                        │
│  │ 👥 Clients            │   │   👥    │                        │
│  │ 📅 Events             │   │   📅    │                        │
│  │ 🎨 Templates          │   │   🎨    │                        │
│  │ 👤 Guests             │   │   👤    │                        │
│  │ 📈 Reports            │   │   📈    │                        │
│  │ 📋 Logs               │   │   📋    │                        │
│  │ ⚙️ Settings           │   │   ⚙️    │                        │
│  └───────────────────────┘   └─────────┘                        │
│                                                                 │
│  Props:                                                         │
│    - collapsed: boolean                                         │
│    - onToggle: () => void                                       │
│                                                                 │
│  Consumes:                                                      │
│    - usePermissions() → { hasPermission }                       │
│    - useLocation() → current route for active state             │
│                                                                 │
│  Features:                                                      │
│    - Active item highlighted                                    │
│    - Items filtered by role/permissions                         │
│    - Tooltips when collapsed                                    │
│    - Collapse toggle button at bottom                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.6 NavItem

```
┌─────────────────────────────────────────────────────────────────┐
│  NavItem                                                        │
├─────────────────────────────────────────────────────────────────┤
│  Purpose: Single navigation link                                │
│                                                                 │
│  Props:                                                         │
│    - icon: ReactNode                                            │
│    - label: string (i18n key)                                   │
│    - to: string (route path)                                    │
│    - permission?: string (required permission key)              │
│    - collapsed: boolean                                         │
│                                                                 │
│  Behavior:                                                      │
│    - If permission specified && !hasPermission → don't render   │
│    - Active state: matches current route                        │
│    - Hover: subtle background highlight                         │
│    - Collapsed: show tooltip on hover                           │
│                                                                 │
│  Accessibility:                                                 │
│    - aria-current="page" when active                            │
│    - Keyboard navigable                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.7 ContentArea

```
┌─────────────────────────────────────────────────────────────────┐
│  ContentArea                                                    │
├─────────────────────────────────────────────────────────────────┤
│  Purpose: Main content wrapper                                  │
│                                                                 │
│  Layout:                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  <PageHeader />                                             ││
│  │    - Title                                                  ││
│  │    - Breadcrumb                                             ││
│  │    - Actions slot                                           ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │  <main>                                                     ││
│  │    <Outlet /> ← React Router renders page here              ││
│  │  </main>                                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Props: None (children via Outlet)                              │
│                                                                 │
│  Styling:                                                       │
│    - Scrollable (overflow-y: auto)                              │
│    - Padding: 24px (responsive)                                 │
│    - Max-width: 1440px (centered)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. State Management

### 4.1 Context Providers

| Context | State | Purpose |
|---------|-------|---------|
| **AuthContext** | user, isAuthenticated, permissions | Auth state |
| **LanguageContext** | language, direction, t() | i18n and RTL |
| **ThemeContext** | theme, setTheme | Dark/light mode (future) |
| **ShellContext** | sidebarCollapsed, toggleSidebar | Layout state |

### 4.2 ShellContext

```
ShellContext
├── State:
│   - sidebarCollapsed: boolean (default: false)
│   - sidebarMobileOpen: boolean (default: false)
│
├── Actions:
│   - toggleSidebar(): void
│   - setSidebarCollapsed(value: boolean): void
│   - openMobileSidebar(): void
│   - closeMobileSidebar(): void
│
└── Persistence:
    - Collapsed state saved to localStorage
    - Restored on app load
```

---

## 5. RTL/LTR Implementation

### 5.1 Direction Hook

```
useDirection()
├── Returns:
│   - direction: 'ltr' | 'rtl'
│   - isRTL: boolean
│   - isLTR: boolean
│
├── Source:
│   - Derived from LanguageContext.language
│   - 'ar' → 'rtl', 'en' → 'ltr'
│
└── Side Effects:
    - Updates document.dir attribute
    - Updates document.lang attribute
    - Updates <html> class for CSS targeting
```

### 5.2 CSS Strategy

| Approach | Usage |
|----------|-------|
| **Logical Properties** | `margin-inline-start`, `padding-inline-end` |
| **CSS Variables** | `--sidebar-width`, `--header-height` |
| **RTL Class** | `.rtl` on `<html>` for edge cases |
| **Flip Icons** | Directional icons (arrows) use `transform: scaleX(-1)` |

### 5.3 Icon Handling

```
Directional Icons (must flip in RTL):
  - ChevronRight / ChevronLeft
  - ArrowRight / ArrowLeft
  - Menu (hamburger stays same)

Implementation:
  <Icon name="chevron-right" flip={isRTL} />
```

---

## 6. Responsive Breakpoints

| Breakpoint | Sidebar Behavior | Header |
|------------|-----------------|--------|
| **≥1280px** | Expanded (260px) | Full |
| **1024-1279px** | Collapsed (72px) | Full |
| **768-1023px** | Hidden, overlay on toggle | Hamburger menu |
| **<768px** | Full overlay | Hamburger, simplified |

---

## 7. Navigation Configuration

```
Navigation items are data-driven:

NAV_ITEMS = [
  {
    id: 'dashboard',
    icon: 'LayoutDashboard',
    labelKey: 'nav.dashboard',
    path: '/dashboard',
    permission: null  // All authenticated users
  },
  {
    id: 'clients',
    icon: 'Users',
    labelKey: 'nav.clients',
    path: '/clients',
    permission: 'clients.view'
  },
  {
    id: 'events',
    icon: 'Calendar',
    labelKey: 'nav.events',
    path: '/events',
    permission: 'events.view'
  },
  {
    id: 'templates',
    icon: 'Palette',
    labelKey: 'nav.templates',
    path: '/templates',
    permission: 'templates.view'
  },
  {
    id: 'guests',
    icon: 'UserCheck',
    labelKey: 'nav.guests',
    path: '/guests',
    permission: 'guests.view'
  },
  {
    id: 'reports',
    icon: 'BarChart3',
    labelKey: 'nav.reports',
    path: '/reports',
    permission: 'reports.view'
  },
  {
    id: 'logs',
    icon: 'FileText',
    labelKey: 'nav.logs',
    path: '/logs',
    permission: 'logs.view'
  },
  {
    id: 'settings',
    icon: 'Settings',
    labelKey: 'nav.settings',
    path: '/settings',
    permission: 'settings.view'
  }
]
```

---

## 8. Interaction Flows

### 8.1 Language Switch

```
User clicks Language Switch
         ↓
setLanguage(newLang) called
         ↓
LanguageContext updates:
  - language: 'ar' | 'en'
  - direction: 'rtl' | 'ltr'
         ↓
Side effects trigger:
  - document.dir = direction
  - document.lang = language
  - localStorage.setItem('lang', language)
         ↓
All components re-render with new direction
         ↓
(Optional) API call to save user preference
```

### 8.2 Sidebar Toggle

```
User clicks collapse button
         ↓
toggleSidebar() called
         ↓
ShellContext updates:
  - sidebarCollapsed: !current
         ↓
CSS transition animates width
         ↓
localStorage.setItem('sidebar-collapsed', value)
```

### 8.3 Mobile Menu

```
User clicks hamburger (mobile)
         ↓
openMobileSidebar() called
         ↓
Overlay appears, sidebar slides in
         ↓
User taps overlay OR nav item
         ↓
closeMobileSidebar() called
         ↓
Overlay fades, sidebar slides out
```

---

## 9. Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Skip Link** | "Skip to main content" link at top |
| **Focus Trap** | Mobile sidebar traps focus |
| **Keyboard Nav** | Tab through nav items |
| **ARIA Labels** | All buttons have labels |
| **Landmarks** | `<header>`, `<nav>`, `<main>` |
| **Reduced Motion** | Respect `prefers-reduced-motion` |

---

## 10. File Structure

```
src/
├── components/
│   └── layout/
│       ├── AppShell/
│       │   ├── AppShell.jsx
│       │   ├── AppShell.module.css
│       │   └── index.js
│       │
│       ├── TopHeader/
│       │   ├── TopHeader.jsx
│       │   ├── TopHeader.module.css
│       │   ├── Logo.jsx
│       │   ├── LanguageSwitch.jsx
│       │   ├── NotificationBell.jsx
│       │   ├── UserMenu.jsx
│       │   └── index.js
│       │
│       ├── SideNavigation/
│       │   ├── SideNavigation.jsx
│       │   ├── SideNavigation.module.css
│       │   ├── NavItem.jsx
│       │   ├── navConfig.js
│       │   └── index.js
│       │
│       └── ContentArea/
│           ├── ContentArea.jsx
│           ├── ContentArea.module.css
│           ├── PageHeader.jsx
│           └── index.js
│
├── contexts/
│   ├── ShellContext.jsx
│   └── LanguageContext.jsx
│
└── hooks/
    ├── useDirection.js
    └── useShell.js
```

---

## 11. Global State Providers

### 11.1 Provider Hierarchy

```
<App>
└── <React.StrictMode>
    └── <QueryClientProvider>          ← Server state (React Query)
        └── <AuthProvider>             ← Auth state (must be early)
            └── <LanguageProvider>     ← i18n + RTL
                └── <ThemeProvider>    ← Dark/light mode
                    └── <ShellProvider>← Layout state
                        └── <Router>
                            └── <Routes />
```

### 11.2 Provider Specifications

#### AuthProvider

```
AuthProvider
├── State:
│   - user: User | null
│   - isAuthenticated: boolean
│   - isLoading: boolean
│   - permissions: string[]
│
├── Actions:
│   - login(email, password): Promise<void>
│   - logout(): void
│   - refreshToken(): Promise<void>
│
├── Derived:
│   - hasPermission(key): boolean
│   - hasAnyPermission(keys[]): boolean
│   - hasAllPermissions(keys[]): boolean
│
└── Hooks:
    - useAuth(): { user, isAuthenticated, login, logout }
    - usePermissions(): { hasPermission, permissions }
```

#### LanguageProvider

```
LanguageProvider
├── State:
│   - language: 'ar' | 'en'
│   - direction: 'rtl' | 'ltr'
│
├── Actions:
│   - setLanguage(lang): void
│   - toggleLanguage(): void
│
├── Utilities:
│   - t(key): string  ← Translation function
│   - formatDate(date): string
│   - formatNumber(num): string
│
├── Side Effects:
│   - Updates document.dir
│   - Updates document.lang
│   - Syncs to localStorage
│
└── Hooks:
    - useLanguage(): { language, setLanguage, t }
    - useDirection(): { direction, isRTL, isLTR }
```

#### ThemeProvider (Future)

```
ThemeProvider
├── State:
│   - theme: 'light' | 'dark' | 'system'
│
├── Actions:
│   - setTheme(theme): void
│
└── Hooks:
    - useTheme(): { theme, setTheme }
```

#### ShellProvider

```
ShellProvider
├── State:
│   - sidebarCollapsed: boolean
│   - sidebarMobileOpen: boolean
│
├── Actions:
│   - toggleSidebar(): void
│   - openMobileSidebar(): void
│   - closeMobileSidebar(): void
│
└── Hooks:
    - useShell(): { sidebarCollapsed, toggleSidebar, ... }
```

---

## 12. Route Protection Strategy

### 12.1 Route Types

| Type | Access | Example |
|------|--------|---------|
| **Public** | Anyone (including unauthenticated) | `/login`, `/forgot-password` |
| **Protected** | Authenticated users only | `/dashboard`, `/clients` |
| **Permission-Gated** | Users with specific permission | `/settings` (Super Admin) |

### 12.2 Protection Components

#### ProtectedRoute

```
<ProtectedRoute>
├── Purpose: Block unauthenticated access
│
├── Logic:
│   if (isLoading) → <LoadingSpinner />
│   if (!isAuthenticated) → <Navigate to="/login" />
│   else → <Outlet /> (render children)
│
├── Features:
│   - Saves attempted URL for redirect after login
│   - Shows loading state during auth check
│
└── Usage:
    <Route element={<ProtectedRoute />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/clients" element={<Clients />} />
    </Route>
```

#### PermissionRoute

```
<PermissionRoute permission="settings.view">
├── Purpose: Block users without required permission
│
├── Props:
│   - permission: string (required key)
│   - fallback?: ReactNode (optional custom UI)
│
├── Logic:
│   if (!hasPermission(permission)) → <AccessDenied />
│   else → <Outlet />
│
└── Usage:
    <Route element={<PermissionRoute permission="settings.view" />}>
      <Route path="/settings" element={<Settings />} />
    </Route>
```

#### RoleGuard (Component-Level)

```
<RoleGuard permission="clients.delete">
├── Purpose: Hide/show UI elements based on permission
│
├── Props:
│   - permission: string
│   - children: ReactNode
│   - fallback?: ReactNode (optional, default: null)
│
├── Logic:
│   if (hasPermission(permission)) → render children
│   else → render fallback (or null)
│
└── Usage:
    <RoleGuard permission="clients.delete">
      <DeleteButton onClick={handleDelete} />
    </RoleGuard>
```

### 12.3 Route Configuration

```
ROUTES = {
  public: [
    { path: '/login', element: <LoginPage /> },
    { path: '/forgot-password', element: <ForgotPassword /> },
    { path: '/reset-password/:token', element: <ResetPassword /> }
  ],
  
  protected: [
    { path: '/', element: <Navigate to="/dashboard" /> },
    { path: '/dashboard', element: <Dashboard /> },
    { path: '/clients', element: <Clients />, permission: 'clients.view' },
    { path: '/clients/:id', element: <ClientProfile />, permission: 'clients.view' },
    { path: '/events', element: <Events />, permission: 'events.view' },
    { path: '/templates', element: <Templates />, permission: 'templates.view' },
    { path: '/guests', element: <Guests />, permission: 'guests.view' },
    { path: '/reports', element: <Reports />, permission: 'reports.view' },
    { path: '/logs', element: <Logs />, permission: 'logs.view' },
    { path: '/settings', element: <Settings />, permission: 'settings.view' }
  ]
}
```

### 12.4 Auth Flow Diagram

```
User opens app
       ↓
AuthProvider initializes
       ↓
Check for stored token
       ↓
  ┌────┴────┐
  │         │
Token     No Token
  │         │
  ↓         ↓
Validate   isAuthenticated = false
Token      isLoading = false
  │
  ↓
  ┌────┴─────┐
  │          │
Valid     Invalid/
Token     Expired
  │          │
  ↓          ↓
Set user   Clear token
state      Redirect to login
```

---

## 13. Navigation Visibility Rules Per Role

### 13.1 Permission Matrix

| Nav Item | Permission Key | Super Admin | Admin User | Report Viewer |
|----------|----------------|:-----------:|:----------:|:-------------:|
| Dashboard | — | ✅ | ✅ | ✅ |
| Clients | `clients.view` | ✅ | ✅ | ❌ |
| Events | `events.view` | ✅ | ✅ | ❌ |
| Templates | `templates.view` | ✅ | ✅ (view only) | ❌ |
| Guests | `guests.view` | ✅ | ✅ | ❌ |
| Reports | `reports.view` | ✅ | ✅ | ✅ |
| Logs | `logs.view` | ✅ | ✅ | ✅ |
| Settings | `settings.view` | ✅ | ❌ | ❌ |

### 13.2 Role Definitions

#### Super Admin

```
Super Admin
├── Permissions: ALL
├── Tenant Scope: Global (all clients)
├── Can Do:
│   - Full CRUD on all entities
│   - Manage system settings
│   - Create/edit templates
│   - Access all clients' data
│   - View all logs
```

#### Admin User

```
Admin User
├── Permissions:
│   - clients.view, clients.create, clients.edit
│   - events.view, events.create, events.edit, events.delete
│   - templates.view (NO create/edit)
│   - guests.view, guests.create, guests.edit, guests.delete
│   - reports.view, reports.export
│   - logs.view
│
├── Tenant Scope: Assigned clients only
├── Cannot:
│   - Access settings
│   - Create/edit templates
│   - See unassigned clients
```

#### Report Viewer

```
Report Viewer
├── Permissions:
│   - reports.view
│   - logs.view
│
├── Tenant Scope: Assigned clients only
├── Can Do:
│   - View dashboard
│   - View reports
│   - View logs
│   - Export reports
│
├── Cannot:
│   - Create/edit/delete anything
│   - Access client management
│   - Access event management
│   - Access templates
```

### 13.3 Dynamic Navigation Rendering

```
SideNavigation renders:

FOR each item in NAV_ITEMS:
  IF item.permission is null:
    → SHOW (all authenticated users)
  ELSE IF hasPermission(item.permission):
    → SHOW
  ELSE:
    → HIDE (do not render)
```

---

## 14. File Structure (Complete)

```
src/
├── app/
│   ├── App.jsx
│   ├── routes.jsx
│   └── providers.jsx
│
├── components/
│   ├── layout/
│   │   ├── AppShell/
│   │   ├── TopHeader/
│   │   ├── SideNavigation/
│   │   └── ContentArea/
│   │
│   └── shared/
│       ├── RoleGuard/
│       ├── ProtectedRoute/
│       └── PermissionRoute/
│
├── contexts/
│   ├── AuthContext.jsx
│   ├── LanguageContext.jsx
│   ├── ThemeContext.jsx
│   └── ShellContext.jsx
│
├── hooks/
│   ├── useAuth.js
│   ├── usePermissions.js
│   ├── useDirection.js
│   ├── useLanguage.js
│   └── useShell.js
│
├── i18n/
│   ├── ar.json
│   ├── en.json
│   └── index.js
│
├── services/
│   ├── api.js
│   └── authService.js
│
└── styles/
    ├── variables.css
    ├── reset.css
    └── rtl.css
```

---

## 15. Definition of Done

Foundation & Shell is **COMPLETE** when:

| Criteria | Status |
|----------|--------|
| All providers initialized correctly | ⬜ |
| AppShell renders correctly | ⬜ |
| RTL/LTR switching works instantly | ⬜ |
| Protected routes block unauthenticated users | ⬜ |
| Permission routes block unauthorized users | ⬜ |
| Navigation shows/hides items per role | ⬜ |
| Sidebar collapse/expand works | ⬜ |
| Mobile responsive behavior works | ⬜ |
| Accessibility requirements met | ⬜ |

---

*Module Version: 1.1*  
*Updated: 2026-01-18 – Added route protection, global providers, role matrix*
