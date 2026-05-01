# Phase 4: Admin Dashboard Application

## Centralized Digital Invitation & QR Verification Platform

---

## 1. Objective

Build a fully functional **Admin Dashboard Web Application** enabling system operators to:

- Manage clients, events, guests, and invitations
- Design invitation templates visually (drag & drop)
- Configure widget visibility rules without code
- Preview invitation behavior across time & states
- Generate reports and memory books

### Out of Scope (Phase 4)

| Deferred | Phase |
|----------|-------|
| Flutter scanner app | Phase 5 |
| AI content moderation | Future |
| Payment & billing | Future |
| Public marketing website | Future |

---

## 2. Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | React.js 18+ | Functional components, hooks |
| **State** | React Context + React Query | Server state separation |
| **Routing** | React Router v6 | Nested routes, lazy loading |
| **Styling** | CSS Modules + CSS Variables | RTL-first, themeable |
| **UI Components** | Custom component library | Abstracted from 3rd party |
| **Form Handling** | React Hook Form | Validation, error handling |
| **HTTP Client** | Axios | Interceptors, token refresh |
| **Drag & Drop** | dnd-kit | Accessible, performant |
| **Icons** | Lucide React | Lightweight, RTL-aware |
| **i18n** | react-i18next | AR/EN, pluralization |
| **Backend** | REST API | See Phase 2 |
| **Database** | MySQL | See Phase 2 |
| **Auth** | JWT (access + refresh) | HttpOnly cookies |

---

## 3. Application Architecture

### 3.1 Project Structure

```
src/
├── app/
│   ├── App.jsx                 # Root component
│   ├── routes.jsx              # Route definitions
│   └── providers.jsx           # Context providers wrapper
│
├── components/
│   ├── ui/                     # Base UI components
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Modal/
│   │   ├── Table/
│   │   ├── Card/
│   │   └── ...
│   ├── layout/                 # Shell components
│   │   ├── AppShell/
│   │   ├── TopHeader/
│   │   ├── SideNavigation/
│   │   └── ContentArea/
│   └── shared/                 # Shared domain components
│       ├── LanguageSwitch/
│       ├── UserMenu/
│       └── RoleGuard/
│
├── features/                   # Feature modules
│   ├── auth/
│   ├── dashboard/
│   ├── clients/
│   ├── events/
│   ├── templates/
│   ├── guests/
│   ├── reports/
│   ├── logs/
│   └── settings/
│
├── hooks/                      # Custom hooks
│   ├── useAuth.js
│   ├── usePermissions.js
│   ├── useDirection.js
│   └── useApi.js
│
├── services/                   # API services
│   ├── api.js                  # Axios instance
│   ├── authService.js
│   ├── clientService.js
│   └── ...
│
├── i18n/                       # Translations
│   ├── ar.json
│   ├── en.json
│   └── index.js
│
├── styles/                     # Global styles
│   ├── variables.css
│   ├── reset.css
│   └── rtl.css
│
└── utils/                      # Utilities
    ├── formatters.js
    ├── validators.js
    └── permissions.js
```

### 3.2 Application Shell

```
┌─────────────────────────────────────────────────────────────────┐
│                         TOP HEADER                              │
│  [Logo]            [🌐 AR/EN] [🔔 Notifications] [👤 User ▼]   │
├────────────────┬────────────────────────────────────────────────┤
│                │                                                │
│   SIDE         │              CONTENT AREA                      │
│   NAVIGATION   │                                                │
│                │   ┌────────────────────────────────────────┐   │
│   📊 Dashboard │   │  Page Header                           │   │
│   👥 Clients   │   │  Title / Breadcrumb / Actions          │   │
│   📅 Events    │   ├────────────────────────────────────────┤   │
│   🎨 Templates │   │                                        │   │
│   👤 Guests    │   │  Page Content                          │   │
│   📈 Reports   │   │  (Dynamic per route)                   │   │
│   📋 Logs      │   │                                        │   │
│   ⚙️ Settings  │   └────────────────────────────────────────┘   │
│                │                                                │
└────────────────┴────────────────────────────────────────────────┘
```

### 3.3 RTL/LTR Layout Switching

```
┌─────────────────────────────────────┐
│         ENGLISH (LTR)               │
│  [Sidebar LEFT]  [Content RIGHT]    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         ARABIC (RTL)                │
│  [Content LEFT]  [Sidebar RIGHT]    │
└─────────────────────────────────────┘
```

**Implementation:**

| Aspect | Approach |
|--------|----------|
| **Direction** | `document.dir = 'rtl' | 'ltr'` on language change |
| **CSS** | Logical properties (`margin-inline-start`, `padding-inline-end`) |
| **Icons** | Flip directional icons (arrows, chevrons) |
| **No Reload** | Instant switch via React state |

---

## 4. Authentication & Authorization

### 4.1 Login Flow

```
LOGIN SCREEN
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    [Logo: Rawaj]                                │
│                                                                 │
│              ┌─────────────────────────────┐                    │
│              │  📧 Email                   │                    │
│              └─────────────────────────────┘                    │
│              ┌─────────────────────────────┐                    │
│              │  🔒 Password                │                    │
│              └─────────────────────────────┘                    │
│                                                                 │
│              [🌐 العربية | English]                              │
│                                                                 │
│              [        Login        ]                            │
│                                                                 │
│              Forgot Password?                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Auth State Management

```
AuthContext
├── user: { id, email, name, role, permissions }
├── isAuthenticated: boolean
├── isLoading: boolean
├── login(email, password): Promise
├── logout(): void
├── refreshToken(): Promise
└── hasPermission(key): boolean
```

### 4.3 Role-Based Access Control

| Role | Navigation Visibility | Actions |
|------|----------------------|---------|
| **Super Admin** | All sections | All CRUD |
| **Admin User** | All except Settings | CRUD on events, guests; View templates |
| **Report Viewer** | Dashboard, Reports, Logs | View only |

**Enforcement Layers:**

| Layer | Implementation |
|-------|----------------|
| **Navigation** | `RoleGuard` component hides menu items |
| **Routes** | Protected routes redirect unauthorized users |
| **Components** | Buttons/actions hidden based on permissions |
| **API** | Backend rejects unauthorized requests |

### 4.4 Permission Keys

```
clients.view, clients.create, clients.edit, clients.delete
events.view, events.create, events.edit, events.delete
templates.view, templates.create, templates.edit
guests.view, guests.create, guests.edit, guests.delete
reports.view, reports.export
logs.view
settings.view, settings.edit
```

---

## 5. Core Modules

### 5.1 Dashboard Overview

**Purpose:** At-a-glance system health

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Dashboard                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Clients  │  │ Events   │  │ Guests   │  │ Scans    │        │
│  │   24     │  │   156    │  │  12,450  │  │  8,320   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────┐  │
│  │  Invitations Sent (Chart)   │  │  Recent Activity        │  │
│  │  ████████████               │  │  • Event created...     │  │
│  │  ██████                     │  │  • Guest imported...    │  │
│  │  ████████████████           │  │  • Template updated...  │  │
│  └─────────────────────────────┘  └─────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- KPI cards with animated counters
- Charts (line/bar) for trends
- Recent activity feed
- Language-aware date/number formatting

---

### 5.2 Client Management

**Screens:**

| Screen | Route | Description |
|--------|-------|-------------|
| Client List | `/clients` | Paginated table with filters |
| Client Profile | `/clients/:id` | Tabbed view (Overview, Events, Scanner Users) |
| Add Client | `/clients/new` | Multi-step form |

**Client List Features:**
- Search by name
- Filter by status (active, inactive, suspended)
- Filter by subscription tier
- Sort by creation date, event count

**Client Profile Tabs:**
- **Overview:** Contact info, subscription limits, usage stats
- **Events:** All events for this client
- **Scanner Users:** Manage scanner credentials
- **Activity:** Recent actions related to client

---

### 5.3 Event Management

**Screens:**

| Screen | Route | Description |
|--------|-------|-------------|
| Event List | `/events` | Client-scoped event table |
| Event Details | `/events/:id` | Event dashboard + guest management |
| Create Event | `/events/new` | Wizard-based creation |
| Edit Event | `/events/:id/edit` | Edit form |

**Create Event Wizard:**

```
Step 1: Basic Info
┌─────────────────────────────────────────────────────────────────┐
│  Event Name (AR)  [____________________]                        │
│  Event Name (EN)  [____________________]                        │
│  Client           [Select Client ▼]                             │
│  Event Type       [Wedding ▼]                                   │
│                                            [Next →]             │
└─────────────────────────────────────────────────────────────────┘

Step 2: Date & Venue
┌─────────────────────────────────────────────────────────────────┐
│  Start Date/Time  [📅 2026-03-15] [🕐 22:00]                    │
│  End Date/Time    [📅 2026-03-16] [🕐 02:00]                    │
│  Timezone         [Asia/Riyadh ▼]                               │
│  Venue (AR)       [____________________]                        │
│  Venue (EN)       [____________________]                        │
│                                   [← Back] [Next →]             │
└─────────────────────────────────────────────────────────────────┘

Step 3: Template Selection
┌─────────────────────────────────────────────────────────────────┐
│  Select Invitation Template:                                    │
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │ Royal   │  │ Modern  │  │ Classic │                         │
│  │ Wedding │  │ Gold    │  │ Blue    │                         │
│  │   ✓     │  │         │  │         │                         │
│  └─────────┘  └─────────┘  └─────────┘                         │
│                                   [← Back] [Create Event]       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Template Builder (Core Feature)

### 6.1 Builder Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Template: Royal Wedding Gold     [AR|EN] [Preview ▼] [💾 Save] │
├───────────────┬─────────────────────────────────────────────────┤
│               │                                                 │
│  WIDGET       │              CANVAS                             │
│  PALETTE      │                                                 │
│               │   ┌─────────────────────────────────────────┐   │
│  ┌─────────┐  │   │  [HEADER SECTION]                       │   │
│  │ 📝 Text │  │   │  ┌─────────────────────────────────┐   │   │
│  └─────────┘  │   │  │  Guest Name Block               │   │   │
│  ┌─────────┐  │   │  └─────────────────────────────────┘   │   │
│  │ 🖼️ Image│  │   └─────────────────────────────────────────┘   │
│  └─────────┘  │                                                 │
│  ┌─────────┐  │   ┌─────────────────────────────────────────┐   │
│  │ 📅 Event│  │   │  [BODY SECTION]                         │   │
│  └─────────┘  │   │  ┌─────────────────────────────────┐   │   │
│  ┌─────────┐  │   │  │  Event Details Block            │   │   │
│  │ 📱 QR   │  │   │  └─────────────────────────────────┘   │   │
│  └─────────┘  │   │  ┌─────────────────────────────────┐   │   │
│  ┌─────────┐  │   │  │  QR Code Block                  │   │   │
│  │ 🎙️ Voice│  │   │  └─────────────────────────────────┘   │   │
│  └─────────┘  │   └─────────────────────────────────────────┘   │
│  ┌─────────┐  │                                                 │
│  │ 📋 Survey│ │   ┌─────────────────────────────────────────┐   │
│  └─────────┘  │   │  [FOOTER SECTION]                       │   │
│               │   │  ┌─────────────────────────────────┐   │   │
│               │   │  │  Voice Recorder  [👁️ hidden]    │   │   │
│               │   │  └─────────────────────────────────┘   │   │
│               │   └─────────────────────────────────────────┘   │
│               │                                                 │
├───────────────┴─────────────────────────────────────────────────┤
│  PROPERTIES PANEL (Selected: Voice Recorder)                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Label (AR): [سجّل تهنئتك]  Label (EN): [Record Message]    ││
│  │  Max Duration: [60 seconds ▼]                               ││
│  │  Allow Edit: [✓ Yes]                                        ││
│  │  [📏 Rules] ──────────────────────────────────────────────  ││
│  │  Show when: [Time] [is after] [Event End]                   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Drag & Drop Behavior

| Action | Behavior |
|--------|----------|
| **Drag from Palette** | Creates new widget instance |
| **Drag on Canvas** | Reorders widgets vertically |
| **Drop on Section** | Places widget in that section |
| **Delete** | Removes widget (with confirmation) |

**Sections:**
- Header (fixed at top)
- Body (main content)
- Footer (post-event content)

### 6.3 Widget Properties Panel

When a widget is selected:

```
PROPERTIES PANEL
├── Content Tab
│   ├── Label (AR) input
│   ├── Label (EN) input
│   ├── Placeholder text
│   └── Data binding selector
│
├── Style Tab (optional)
│   ├── Font size override
│   ├── Color override
│   └── Padding/margin
│
└── Rules Tab
    ├── Visibility rules list
    └── [+ Add Rule] button
```

---

## 7. Rule Builder UI

### 7.1 Rule Builder Component

```
┌─────────────────────────────────────────────────────────────────┐
│  RULES FOR: Voice Recorder                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Default: [Hidden ▼]                                            │
│                                                                 │
│  Rule 1:                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [SHOW ▼] this widget when:                                 ││
│  │                                                             ││
│  │  [Time ▼]  [is after ▼]  [Event End ▼]                      ││
│  │                                             [+ Add AND]     ││
│  │                                             [🗑️ Delete]      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [+ Add Rule (OR)]                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Condition Dropdowns

**Category Selection:**

| Category | Options |
|----------|---------|
| **Time** | Before event start, During event, After event end, After event start |
| **Scan Status** | Not scanned, Checked in |
| **Guest** | Is VIP, Is Family, Has companions |
| **Event** | Is wedding, Is corporate |

### 7.3 Rule Validation

| Validation | Message |
|------------|---------|
| **Empty conditions** | "Add at least one condition" |
| **Conflicting rules** | "Rule 2 conflicts with Rule 1" |
| **Circular dependency** | Warning if widget depends on itself |

---

## 8. Preview Simulator

### 8.1 Simulator Toolbar

```
┌─────────────────────────────────────────────────────────────────┐
│  PREVIEW MODE                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Time State:     [Before Event ▼]                               │
│  Scan Status:    [Not Scanned ▼]                                │
│  Guest Type:     [Regular ▼]                                    │
│  Language:       [🇸🇦 AR] [🇺🇸 EN]                                 │
│  Device:         [📱 Mobile] [💻 Desktop]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Preview States

| State | Simulated Conditions |
|-------|---------------------|
| **Before Event** | time.before_event_start = true |
| **During (Not Scanned)** | time.during_event = true, scan.not_scanned = true |
| **During (Checked In)** | time.during_event = true, scan.checked_in = true |
| **After Event** | time.after_event_end = true, scan.checked_in = true |

### 8.3 Debug Panel (Optional)

Shows why widgets are visible/hidden:

```
DEBUG: Widget Visibility
├── Guest Name Block: VISIBLE (always)
├── QR Code Block: VISIBLE (scan.not_scanned = true)
├── Voice Recorder: HIDDEN (time.after_event_end = false)
└── Text Submission: HIDDEN (time.after_event_end = false)
```

---

## 9. Guest & Submission Management

### 9.1 Guest List

```
┌─────────────────────────────────────────────────────────────────┐
│  Guests for: Mohammed & Fatima Wedding                          │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Search] [Filter: Status ▼] [Filter: Group ▼] [+ Add Guest] │
├─────────────────────────────────────────────────────────────────┤
│  ☐  Name           Phone          Status      Check-in  Actions │
│  ☐  Ahmed Al-R...  +966 5...      ✅ Sent     ✓ 22:15  [···]   │
│  ☐  Sarah Moh...   +966 5...      ✅ Sent     —        [···]   │
│  ☐  Omar Abd...    +966 5...      ⏳ Pending  —        [···]   │
├─────────────────────────────────────────────────────────────────┤
│  Showing 1-25 of 156                      [← Prev] [Next →]     │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Submission Viewer

```
┌─────────────────────────────────────────────────────────────────┐
│  Guest Submissions                                              │
├─────────────────────────────────────────────────────────────────┤
│  [Filter: Event ▼] [Filter: Type ▼] [📥 Export]                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Ahmed Al-Rashid              🎙️ Voice  |  00:45        │  │
│  │  📅 2026-03-16 01:23                                      │  │
│  │  [▶️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]                   │  │
│  │                                        [✓ Approve] [🗑️]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Sarah Mohammed               💬 Text                   │  │
│  │  📅 2026-03-16 01:45                                      │  │
│  │  "Congratulations! Wishing you a lifetime of happiness..."│  │
│  │                                        [✓ Approve] [🗑️]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Memory Book Generation

### 10.1 Generation UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Memory Book: Mohammed & Fatima Wedding                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Status: [Ready to Generate]                                    │
│                                                                 │
│  Submissions:                                                   │
│    • Voice messages: 45                                         │
│    • Text messages: 78                                          │
│    • Total guests: 123                                          │
│                                                                 │
│  Settings:                                                      │
│    ☑️ Include guest names                                       │
│    ☐ Include timestamps                                         │
│                                                                 │
│  [📖 Generate Memory Book]                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Generated Memory Book

```
┌─────────────────────────────────────────────────────────────────┐
│  Memory Book Preview                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                   💍 Mohammed & Fatima                          │
│                     March 15, 2026                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Messages from Guests                                           │
│                                                                 │
│  "Congratulations! Wishing you..."                              │
│  — Ahmed Al-Rashid                                              │
│                                                                 │
│  [▶️ Voice Message from Sarah...]                               │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│              Created with Rawaj Platform                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

[🔗 Copy Link]  [📥 Download HTML]  [🔄 Regenerate]
```

---

## 11. Reports & Exports

### 11.1 Report Types

| Report | Purpose | Filters |
|--------|---------|---------|
| **Guest Attendance** | Check-in stats | Event, date range |
| **Invitation Engagement** | Sent, opened, clicked | Event, channel |
| **Scan Logs** | All QR scans | Event, result type, date |
| **Submission Summary** | Voice/text counts | Event, type |

### 11.2 Report Viewer

```
┌─────────────────────────────────────────────────────────────────┐
│  Invitation Engagement Report                                   │
├─────────────────────────────────────────────────────────────────┤
│  Event: [All Events ▼]  Date: [Last 30 Days ▼]  [Generate]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Summary                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Sent     │  │ Delivered│  │ Opened   │  │ Clicked  │        │
│  │  1,234   │  │  1,198   │  │   892    │  │   654    │        │
│  │          │  │  97.1%   │  │  72.3%   │  │  53.0%   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  [📊 View Chart]  [📥 Export CSV]  [📥 Export PDF]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Non-Functional Requirements

### 12.1 Performance

| Requirement | Target |
|-------------|--------|
| **Initial Load** | < 3 seconds |
| **Route Change** | < 500ms |
| **Table Render** | < 200ms for 100 rows |
| **Template Save** | < 1 second |

**Implementation:**
- Code splitting per feature module
- Lazy loading for heavy components
- Skeleton loaders during fetch
- Pagination (25 items default)
- Virtual scrolling for long lists

### 12.2 Accessibility

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard Navigation** | Tab through all interactive elements |
| **Focus Indicators** | Visible focus rings (2px solid) |
| **ARIA Labels** | All icons and buttons labeled |
| **Screen Reader** | Semantic HTML, proper headings |
| **Color Contrast** | WCAG 2.1 AA (4.5:1 minimum) |
| **RTL Testing** | Full RTL test suite |

### 12.3 Auditability

| Action | Logged |
|--------|--------|
| Template created/edited | ✓ |
| Event created/edited | ✓ |
| Guest imported/modified | ✓ |
| Settings changed | ✓ |
| User logged in/out | ✓ |

---

## 13. Implementation Order

### Phase 4A: Foundation (Weeks 1-2)

| Week | Deliverables |
|------|--------------|
| **1** | Project setup, auth, shell layout, RTL support |
| **2** | Dashboard, client list, client profile |

### Phase 4B: Core Features (Weeks 3-4)

| Week | Deliverables |
|------|--------------|
| **3** | Event management, guest management |
| **4** | Template builder (drag & drop, properties) |

### Phase 4C: Advanced Features (Weeks 5-6)

| Week | Deliverables |
|------|--------------|
| **5** | Rule builder, preview simulator |
| **6** | Memory book generation, reports |

---

## 14. Definition of Done

Phase 4 is **COMPLETE** when:

| Criteria | Status |
|----------|--------|
| Admin dashboard fully functional | ⬜ |
| Template builder usable without developers | ⬜ |
| Rule engine configurable via UI | ⬜ |
| Invitations previewable in all states | ⬜ |
| Memory book generation works | ⬜ |
| Arabic & English feel native | ⬜ |
| All roles enforced correctly | ⬜ |
| Performance targets met | ⬜ |
| Accessibility requirements met | ⬜ |

---

*Document Version: 1.0*  
*Created: 2026-01-18*  
*Relates To: Phase 1, Phase 2, Phase 3*
