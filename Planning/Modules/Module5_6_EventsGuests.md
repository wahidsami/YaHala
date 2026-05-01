# Module 5 & 6: Event & Guest Management

## Phase 4 Implementation – Detailed Component Design

---

# Part A: Event Management (Module 5)

## 1. Module Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | Create and manage events for clients |
| **Routes** | `/events`, `/events/new`, `/events/:id` |
| **Access** | `events.view` permission |
| **Scope** | Client-scoped |

---

## 2. Event Creation Wizard

### 2.1 Wizard State Model

```
WizardState {
  currentStep: 1 | 2 | 3 | 4
  isSubmitting: boolean
  errors: Record<string, string>
  
  data: {
    // Step 1: Basic Info
    clientId: string
    nameEn: string
    nameAr: string
    eventType: 'wedding' | 'corporate' | 'social'
    
    // Step 2: Date & Venue
    startDatetime: Date
    endDatetime: Date
    timezone: string
    venueEn: string
    venueAr: string
    
    // Step 3: Template
    templateId: string
    
    // Step 4: Settings
    allowPlusOne: boolean
    maxCompanions: number
  }
}
```

### 2.2 Wizard Steps

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP INDICATOR                                                 │
│  ───────────────────────────────────────────────────────        │
│  [1 Basic ●]───[2 Date & Venue ○]───[3 Template ○]───[4 ○]      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Step 1: Basic Info

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Basic Information                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Client *        [Select Client ▼]                              │
│                                                                 │
│  Event Name (EN) * [________________________]                   │
│  Event Name (AR) * [________________________]                   │
│                                                                 │
│  Event Type *    ○ Wedding  ○ Corporate  ○ Social               │
│                                                                 │
│                                           [Cancel] [Next →]     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Step 2: Date & Venue

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Date & Venue                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Start *         [📅 2026-03-15] [🕐 22:00]                     │
│  End *           [📅 2026-03-16] [🕐 02:00]                     │
│  Timezone *      [Asia/Riyadh ▼]                                │
│                                                                 │
│  Venue (EN)      [________________________]                     │
│  Venue (AR)      [________________________]                     │
│                                                                 │
│                                    [← Back] [Next →]            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 Step 3: Template Selection

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Invitation Template                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Select a template for this event:                              │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │             │  │             │  │             │             │
│  │  [Preview]  │  │  [Preview]  │  │  [Preview]  │             │
│  │             │  │             │  │             │             │
│  │ Royal Gold  │  │ Modern Blue │  │ Classic     │             │
│  │     ✓       │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│                                    [← Back] [Next →]            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 Step 4: Settings

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Event Settings                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Guest Settings                                                 │
│  ─────────────                                                  │
│  ☑ Allow companions (plus-one)                                  │
│  Maximum companions per guest: [2 ▼]                            │
│                                                                 │
│  Summary                                                        │
│  ───────                                                        │
│  Event: Mohammed & Fatima Wedding                               │
│  Client: Rawaj Events                                           │
│  Date: March 15, 2026 at 10:00 PM                              │
│  Template: Royal Gold                                           │
│                                                                 │
│                                    [← Back] [Create Event]      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.7 Wizard Navigation Logic

```
canProceed(step): boolean
  Step 1: clientId && nameEn && nameAr && eventType
  Step 2: startDatetime && endDatetime && timezone
  Step 3: templateId
  Step 4: always true

onNext():
  if (!canProceed(currentStep)) → show validation errors
  if (currentStep < 4) → currentStep++
  else → submit()

onBack():
  if (currentStep > 1) → currentStep--
  else → confirm cancel
```

---

## 3. Event Dashboard

### 3.1 Page Structure

```
<EventDashboardPage>
├── <PageHeader 
│     title={event.name}
│     subtitle={formatDate(event.startDatetime)}
│     status={<EventStatusBadge />}
│     actions={<EventActions />}
│   />
│
├── <EventKPIs>
│   ├── <KPI label="Guests" value={stats.totalGuests} />
│   ├── <KPI label="Checked In" value={stats.checkedIn} />
│   ├── <KPI label="Invites Sent" value={stats.invitesSent} />
│   └── <KPI label="Pending" value={stats.pending} />
│
├── <EventTabs>
│   ├── Tab: Guests
│   ├── Tab: Invitations
│   ├── Tab: Scan Logs
│   └── Tab: Submissions
│
└── <TabContent />
```

### 3.2 Event Status Badges

| Status | Color | Icon |
|--------|-------|------|
| `draft` | Gray | ○ |
| `active` | Green | ● |
| `completed` | Blue | ✓ |
| `cancelled` | Red | ✕ |

### 3.3 Event Actions

```
<EventActions>
├── [Edit Event]           → events.edit
├── [Send Invitations]     → events.edit (bulk action)
├── [Download QR Codes]    → events.view
├── [Generate Report]      → reports.view
├── [Archive Event]        → events.edit
└── [Delete Event]         → events.delete
```

---

# Part B: Guest Management (Module 6)

## 4. Guest Lifecycle

### 4.1 Guest Status Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    GUEST LIFECYCLE                              │
└─────────────────────────────────────────────────────────────────┘

INVITATION STATUS:
  pending → sent → delivered → clicked

CHECK-IN STATUS:
  not_checked_in → checked_in

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ PENDING  │ →  │   SENT   │ →  │ DELIVERED│ →  │ CLICKED  │
│ (gray)   │    │ (blue)   │    │ (green)  │    │ (purple) │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
                                                ┌──────────┐
                                                │CHECKED IN│
                                                │ (green ✓)│
                                                └──────────┘
```

### 4.2 Status Indicators

```
Invitation Status:
  ⏳ Pending    - Not yet sent
  📤 Sent       - Invitation dispatched
  ✅ Delivered  - Confirmed received
  👁️ Clicked    - Opened invitation link

Check-in Status:
  ○ Not checked in - Gray circle
  ✓ Checked in     - Green checkmark with time
```

---

## 5. Guest List

### 5.1 Page Structure

```
<GuestListPage eventId={id}>
├── <PageHeader 
│     title="Guests"
│     actions={<GuestActions />}
│   />
│
├── <GuestToolbar>
│   ├── <SearchInput />
│   ├── <StatusFilter />
│   ├── <GroupFilter />
│   └── <BulkActions />   ← When items selected
│
├── <GuestsTable>
│   ├── <SelectAllCheckbox />
│   └── <GuestRow /> (repeated)
│
└── <TablePagination />
```

### 5.2 Table Columns

| Column | Field | Width |
|--------|-------|-------|
| ☐ | Select | 40px |
| Name | `nameEn/Ar` | 22% |
| Phone | `phone` | 15% |
| Group | `groupName` | 12% |
| Invite Status | `invitationStatus` | 12% |
| Check-in | `checkInStatus` | 12% |
| Companions | `companionsCount` | 8% |
| Actions | — | 10% |

### 5.3 Guest Row

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ☑ │ Ahmed Al-Rashid     │ +966 5... │ VIP    │ ✅ Sent  │ ✓ 22:15 │ +2 │⋮│
│   │ أحمد الرشيد          │           │        │          │         │    │ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Bulk Operations

### 6.1 Bulk Action Toolbar

```
When 1+ guests selected:
┌─────────────────────────────────────────────────────────────────┐
│  ☑ 15 selected    [Send Invitations] [Change Group] [Delete]   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Bulk Actions

| Action | Permission | Confirmation |
|--------|------------|--------------|
| Send Invitations | `guests.edit` | Yes (shows count) |
| Change Group | `guests.edit` | No |
| Delete | `guests.delete` | Yes (destructive) |
| Export Selected | `guests.export` | No |

### 6.3 Bulk Action Flow

```
User selects guests
       ↓
Clicks "Send Invitations"
       ↓
<ConfirmationModal>
  "Send invitations to 15 guests?"
  [Cancel] [Send]
       ↓
POST /api/admin/guests/bulk-send
  body: { guestIds: [...] }
       ↓
Show progress: "Sending... 10/15"
       ↓
Success toast: "15 invitations sent"
       ↓
Refresh list (invalidate query)
```

---

## 7. Add/Import Guests

### 7.1 Add Single Guest

```
┌─────────────────────────────────────────────────────────────────┐
│  Add Guest                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Name (EN) *     [________________________]                     │
│  Name (AR) *     [________________________]                     │
│  Phone *         [+966 ___________]                             │
│  Email           [________________________]                     │
│  Group           [Select Group ▼]                               │
│                                                                 │
│  ☐ Allow companions                                             │
│  Max companions  [2 ▼]                                          │
│                                                                 │
│                               [Cancel] [Add Guest]              │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Bulk Import

```
┌─────────────────────────────────────────────────────────────────┐
│  Import Guests                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Download template: [📥 Excel Template]                         │
│                                                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  │                                                           │  │
│  │  📄 Drop Excel/CSV file here                              │  │
│  │     or click to browse                                    │  │
│  │                                                           │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                                                 │
│  Assign to group: [Select Group ▼]                              │
│                                                                 │
│                               [Cancel] [Import]                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Import Preview

```
┌─────────────────────────────────────────────────────────────────┐
│  Import Preview                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ 48 valid rows                                                │
│  ⚠ 2 rows with warnings (duplicate phone)                       │
│  ✕ 1 row with errors (missing name)                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Row │ Name          │ Phone      │ Status              │    │
│  │ 1   │ Ahmed Ali     │ +966 5...  │ ✓ Valid             │    │
│  │ 2   │ Sara Mohammed │ +966 5...  │ ⚠ Duplicate phone   │    │
│  │ 3   │ (empty)       │ +966 5...  │ ✕ Name required     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ☑ Skip rows with errors                                        │
│                                                                 │
│                        [Cancel] [Import 48 Guests]              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Guest Groups

### 8.1 Group Management

```
Groups allow categorizing guests:
  - VIP
  - Family
  - Friends
  - Colleagues
  - Custom groups

Benefits:
  - Filter by group
  - Assign template widgets per group
  - Different invitation messaging
```

### 8.2 Group Selector

```
<GroupFilter>
  [All Groups ▼]
    ├── All Groups
    ├── VIP (12)
    ├── Family (45)
    ├── Friends (89)
    └── + Create Group
```

---

## 9. Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA FLOW DIAGRAM                          │
└─────────────────────────────────────────────────────────────────┘

EVENT CREATION:
  Wizard Form → WizardState → Submit → API → Redirect to Dashboard

GUEST LIST:
  Filters → useQuery(['guests', eventId, filters]) → API → Table

BULK ACTIONS:
  Selection → useMutation → API (batch endpoint) → Invalidate → Refetch

IMPORT:
  File upload → Parse → Preview → Confirm → API → Refresh list
```

---

## 10. API Endpoints

### Events

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/events` | GET | List events |
| `/api/admin/events/:id` | GET | Event details |
| `/api/admin/events` | POST | Create event |
| `/api/admin/events/:id` | PUT | Update event |
| `/api/admin/events/:id` | DELETE | Delete event |
| `/api/admin/events/:id/stats` | GET | Event KPIs |

### Guests

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/events/:id/guests` | GET | List guests |
| `/api/admin/events/:id/guests` | POST | Add guest |
| `/api/admin/events/:id/guests/import` | POST | Bulk import |
| `/api/admin/guests/:id` | PUT | Update guest |
| `/api/admin/guests/:id` | DELETE | Delete guest |
| `/api/admin/guests/bulk-send` | POST | Send invites |
| `/api/admin/guests/bulk-delete` | POST | Delete bulk |

---

## 11. File Structure

```
src/features/
├── events/
│   ├── components/
│   │   ├── EventWizard/
│   │   │   ├── EventWizard.jsx
│   │   │   ├── StepIndicator.jsx
│   │   │   ├── BasicInfoStep.jsx
│   │   │   ├── DateVenueStep.jsx
│   │   │   ├── TemplateStep.jsx
│   │   │   └── SettingsStep.jsx
│   │   ├── EventDashboard.jsx
│   │   ├── EventKPIs.jsx
│   │   └── EventActions.jsx
│   ├── pages/
│   │   ├── EventListPage.jsx
│   │   ├── CreateEventPage.jsx
│   │   └── EventDashboardPage.jsx
│   └── hooks/
│       ├── useEvents.js
│       └── useEventMutations.js
│
└── guests/
    ├── components/
    │   ├── GuestsTable.jsx
    │   ├── GuestRow.jsx
    │   ├── GuestFilters.jsx
    │   ├── GuestForm.jsx
    │   ├── ImportModal.jsx
    │   ├── ImportPreview.jsx
    │   └── BulkActions.jsx
    ├── pages/
    │   └── GuestListPage.jsx
    └── hooks/
        ├── useGuests.js
        └── useGuestMutations.js
```

---

## 12. Definition of Done

| Criteria | Status |
|----------|--------|
| Event wizard completes all steps | ⬜ |
| Event dashboard shows KPIs | ⬜ |
| Guest list with filters works | ⬜ |
| Bulk selection works | ⬜ |
| Bulk send invitations works | ⬜ |
| Single guest add works | ⬜ |
| Import with preview works | ⬜ |
| Status indicators display correctly | ⬜ |
| RTL layout correct | ⬜ |

---

*Module Version: 1.0*  
*Created: 2026-01-18*
