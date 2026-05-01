# Module 3 & 4: Dashboard & Client Management

## Phase 4 Implementation – Detailed Component Design

---

# Part A: Dashboard Overview (Module 3)

## 1. Module Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | At-a-glance system health and activity |
| **Route** | `/dashboard` |
| **Access** | All authenticated users |
| **Data** | Aggregated stats, charts, recent activity |

---

## 2. Page Structure

```
<DashboardPage>
├── <PageHeader title="Dashboard" />
│
├── <KPISection>
│   ├── <KPICard title="Clients" />
│   ├── <KPICard title="Events" />
│   ├── <KPICard title="Guests" />
│   └── <KPICard title="Scans Today" />
│
├── <ChartsSection>
│   ├── <InvitationsChart />      ← Line chart
│   └── <AttendanceChart />       ← Bar chart
│
└── <ActivitySection>
    └── <RecentActivityFeed />
```

---

## 3. KPI Cards

### 3.1 Card Structure

```
┌─────────────────────────────────────┐
│  👥 Clients                         │
│                                     │
│  24                                 │
│  ▲ +3 this month                    │
└─────────────────────────────────────┘
```

### 3.2 KPI Data

| KPI | API Field | Change Calculation |
|-----|-----------|-------------------|
| Clients | `stats.totalClients` | vs last month |
| Events | `stats.totalEvents` (active) | vs last month |
| Guests | `stats.totalGuests` | vs last month |
| Scans Today | `stats.scansToday` | vs yesterday |

### 3.3 KPICard Component

```
<KPICard>
├── Props:
│   icon: ReactNode
│   title: string (i18n key)
│   value: number
│   change: { value: number, trend: 'up' | 'down' | 'neutral' }
│   loading: boolean
│
├── Features:
│   - Animated counter on load
│   - Skeleton when loading
│   - Trend arrow with color
│   - Language-aware number format
```

---

## 4. Charts

### 4.1 Invitations Chart (Line)

```
┌─────────────────────────────────────────────────────────┐
│  Invitations Sent (Last 30 Days)                        │
│                                                         │
│  1000 ─┼─────────────────────────────────────           │
│   800 ─┼───────────────────────╱╲─────────              │
│   600 ─┼────────────────╱╲───╱──╲───────                │
│   400 ─┼─────────╱╲───╱────╲╱────────                   │
│   200 ─┼───╱╲──╱────╲────────────────                   │
│     0 ─┼─╱────────────────────────────                  │
│        └────────────────────────────────────────        │
│         Jan 1    Jan 8    Jan 15    Jan 22              │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Attendance Chart (Bar)

```
┌─────────────────────────────────────────────────────────┐
│  Check-in Rate by Event Type                            │
│                                                         │
│  Weddings    ████████████████████ 89%                   │
│  Corporate   ████████████████ 76%                       │
│  Social      ██████████████ 68%                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Chart Data Flow

```
Dashboard mounts
       ↓
useQuery('dashboard-stats')
       ↓
GET /api/admin/dashboard/stats
       ↓
Response: {
  kpis: { clients, events, guests, scansToday },
  charts: {
    invitations: [{ date, count }],
    attendance: [{ type, rate }]
  }
}
       ↓
Charts render with data
```

---

## 5. Activity Feed

### 5.1 Feed Structure

```
┌─────────────────────────────────────────────────────────┐
│  Recent Activity                                        │
├─────────────────────────────────────────────────────────┤
│  📅 Event created: "Mohammed & Fatima Wedding"          │
│     by Ahmed Al-Rashid • 2 hours ago                    │
│                                                         │
│  👤 50 guests imported to "Annual Conference"           │
│     by Sara Mohammed • 5 hours ago                      │
│                                                         │
│  🎨 Template "Royal Gold" updated                       │
│     by Admin • Yesterday                                │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Activity Item Types

| Type | Icon | Message Template |
|------|------|------------------|
| `event_created` | 📅 | "Event created: {name}" |
| `guests_imported` | 👤 | "{count} guests imported to {event}" |
| `template_updated` | 🎨 | "Template {name} updated" |
| `client_created` | 👥 | "Client {name} added" |
| `invitations_sent` | ✉️ | "{count} invitations sent" |

---

## 6. API Endpoints

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/admin/dashboard/stats` | GET | KPIs + chart data |
| `/api/admin/dashboard/activity` | GET | Recent activity (paginated) |

---

# Part B: Client Management (Module 4)

## 7. Module Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | Manage business clients (tenants) |
| **Routes** | `/clients`, `/clients/:id`, `/clients/new` |
| **Access** | `clients.view` permission |
| **Scope** | Super Admin: all, Admin: assigned only |

---

## 8. Client List Page

### 8.1 Page Structure

```
<ClientListPage>
├── <PageHeader title="Clients" actions={<AddClientButton />} />
│
├── <FilterBar>
│   ├── <SearchInput />
│   ├── <StatusFilter />
│   └── <SubscriptionFilter />
│
├── <ClientsTable>
│   ├── <TableHeader />
│   ├── <TableBody>
│   │   └── <ClientRow /> (repeated)
│   └── <TablePagination />
│
└── <EmptyState /> (if no clients)
```

### 8.2 Table Columns

| Column | Field | Sortable | Width |
|--------|-------|:--------:|-------|
| Name | `name` | ✅ | 25% |
| Contact | `email`, `phone` | ❌ | 20% |
| Status | `status` | ✅ | 10% |
| Events | `eventCount` | ✅ | 10% |
| Subscription | `subscriptionTier` | ✅ | 15% |
| Created | `createdAt` | ✅ | 12% |
| Actions | — | ❌ | 8% |

### 8.3 Table Row

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ☐ │ Rawaj Events    │ info@rawaj.com  │ ● Active │ 12 │ Pro    │ Jan 15 │ ⋮ │
│   │ Ahmed Al-Rashid │ +966 5...       │          │    │        │        │   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Filtering & Pagination

### 9.1 Filter State

```
FilterState {
  search: string           // Name or email
  status: 'all' | 'active' | 'inactive' | 'suspended'
  subscription: 'all' | 'basic' | 'pro' | 'enterprise'
  sortBy: string           // Column key
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number         // 10, 25, 50
}
```

### 9.2 URL Sync

```
Filters sync to URL query params:
  /clients?search=rawaj&status=active&page=2

Benefits:
  - Shareable filtered views
  - Browser back/forward works
  - Bookmarkable searches
```

### 9.3 Data Flow

```
User types in search
       ↓
Debounce 300ms
       ↓
Update filter state
       ↓
useQuery(['clients', filters]) triggers
       ↓
GET /api/admin/clients?search=...&status=...&page=...
       ↓
Response: {
  data: [...clients],
  pagination: { total, page, pageSize, totalPages }
}
       ↓
Table re-renders
```

### 9.4 Pagination Component

```
┌─────────────────────────────────────────────────────────────────┐
│  Showing 1-25 of 156 clients    [10▼] [← Prev] [1] [2] [3] [→]  │
└─────────────────────────────────────────────────────────────────┘

Props:
  total: number
  page: number
  pageSize: number
  onPageChange(page): void
  onPageSizeChange(size): void
```

---

## 10. Client Profile Page

### 10.1 Page Structure

```
<ClientProfilePage>
├── <PageHeader 
│     title={client.name}
│     breadcrumb={['Clients', client.name]}
│     actions={<ClientActions />}
│   />
│
├── <ClientTabs>
│   ├── Tab: Overview (default)
│   ├── Tab: Events
│   ├── Tab: Scanner Users
│   └── Tab: Activity
│
└── <TabContent /> (based on active tab)
```

### 10.2 Tabs

| Tab | Route | Content |
|-----|-------|---------|
| Overview | `/clients/:id` | Profile + Usage + Limits |
| Events | `/clients/:id/events` | Event list for client |
| Scanner Users | `/clients/:id/scanners` | Scanner credentials |
| Activity | `/clients/:id/activity` | Client activity log |

### 10.3 Overview Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  OVERVIEW                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │  Client Info            │  │  Subscription           │      │
│  │  ─────────────────      │  │  ─────────────────      │      │
│  │  Name: Rawaj Events     │  │  Plan: Pro              │      │
│  │  Email: info@rawaj.com  │  │  Events: 12 / 50        │      │
│  │  Phone: +966 5...       │  │  Guests: 1,200 / 5,000  │      │
│  │  Status: ● Active       │  │  Expires: Mar 15, 2026  │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Usage This Month                                           ││
│  │  ───────────────────────────────────────                    ││
│  │  Events: ████████░░░░░░░░░░░░ 8/20                          ││
│  │  Guests: ████████████████░░░░ 3,200/5,000                   ││
│  │  Scans:  ████████████░░░░░░░░ 2,450                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.4 Client Actions

```
<ClientActions>
├── <RoleGuard permission="clients.edit">
│   └── <EditButton />
│
├── <RoleGuard permission="clients.edit">
│   └── <StatusToggle />   ← Enable/Disable
│
└── <RoleGuard permission="clients.delete">
    └── <DeleteButton />
```

---

## 11. Add/Edit Client Form

### 11.1 Form Fields

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| Name | text | ✅ | 2-100 chars |
| Name (AR) | text | ✅ | Arabic text |
| Email | email | ✅ | Valid email |
| Phone | phone | ✅ | Saudi format |
| Status | select | ✅ | active/inactive |
| Subscription | select | ✅ | basic/pro/enterprise |
| Event Limit | number | ✅ | 1-1000 |
| Guest Limit | number | ✅ | 100-100000 |

### 11.2 Form Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Add New Client                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Basic Information                                              │
│  ─────────────────                                              │
│  Name (EN)     [________________________]                       │
│  Name (AR)     [________________________]                       │
│  Email         [________________________]                       │
│  Phone         [________________________]                       │
│                                                                 │
│  Subscription                                                   │
│  ─────────────                                                  │
│  Plan          [Pro ▼]                                          │
│  Event Limit   [50]                                             │
│  Guest Limit   [5000]                                           │
│                                                                 │
│                              [Cancel]  [Save Client]            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/clients` | GET | List with filters |
| `/api/admin/clients/:id` | GET | Single client |
| `/api/admin/clients` | POST | Create client |
| `/api/admin/clients/:id` | PUT | Update client |
| `/api/admin/clients/:id` | DELETE | Delete client |
| `/api/admin/clients/:id/stats` | GET | Usage stats |

---

## 13. Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA FLOW DIAGRAM                          │
└─────────────────────────────────────────────────────────────────┘

CLIENT LIST:
  FilterBar → FilterState → useQuery → API → Table

CLIENT PROFILE:
  Route params → useQuery(clientId) → API → Profile + Tabs

MUTATIONS:
  Form submit → useMutation → API → Invalidate cache → Refetch
```

---

## 14. File Structure

```
src/features/
├── dashboard/
│   ├── components/
│   │   ├── KPICard.jsx
│   │   ├── KPISection.jsx
│   │   ├── InvitationsChart.jsx
│   │   ├── AttendanceChart.jsx
│   │   └── RecentActivityFeed.jsx
│   ├── pages/
│   │   └── DashboardPage.jsx
│   ├── hooks/
│   │   └── useDashboardStats.js
│   └── index.js
│
└── clients/
    ├── components/
    │   ├── ClientsTable.jsx
    │   ├── ClientRow.jsx
    │   ├── ClientFilters.jsx
    │   ├── ClientForm.jsx
    │   ├── ClientProfile.jsx
    │   ├── ClientOverviewTab.jsx
    │   ├── ClientEventsTab.jsx
    │   ├── ClientScannersTab.jsx
    │   └── ClientActions.jsx
    ├── pages/
    │   ├── ClientListPage.jsx
    │   ├── ClientProfilePage.jsx
    │   └── AddClientPage.jsx
    ├── hooks/
    │   ├── useClients.js
    │   ├── useClient.js
    │   └── useClientMutations.js
    └── index.js
```

---

## 15. Definition of Done

| Criteria | Status |
|----------|--------|
| Dashboard KPIs display correctly | ⬜ |
| Charts render with data | ⬜ |
| Activity feed shows recent items | ⬜ |
| Client list filters work | ⬜ |
| Client list pagination works | ⬜ |
| Client profile tabs work | ⬜ |
| Add/Edit client form validates | ⬜ |
| Delete client with confirmation | ⬜ |
| Permission-based actions hide correctly | ⬜ |
| RTL layout correct | ⬜ |

---

*Module Version: 1.0*  
*Created: 2026-01-18*
