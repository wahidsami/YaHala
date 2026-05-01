# Modules 8-11: Rule Builder, Preview, Memory Book & Reports

## Phase 4 Implementation – Detailed Component Design

---

# Part A: Rule Builder (Module 8)

## 1. Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | No-code conditional visibility rules for widgets |
| **Location** | Properties Panel → Rules Tab |
| **Access** | `templates.edit` permission |

---

## 2. Rule Model

```
Rule {
  id: string
  action: 'show' | 'hide' | 'enable' | 'disable'
  conditionLogic: 'and' | 'or'           // Between conditions
  conditions: Condition[]
}

Condition {
  id: string
  type: 'time' | 'scan' | 'guest' | 'event'
  operator: string                        // Type-specific
  value: string | number | boolean
}
```

---

## 3. Condition Types

| Type | Operators | Values |
|------|-----------|--------|
| **time** | `before`, `after`, `during` | `event.start`, `event.end` |
| **scan** | `equals` | `not_scanned`, `checked_in` |
| **guest** | `group_is`, `has_companions` | Group name, boolean |
| **event** | `type_is` | `wedding`, `corporate`, `social` |

---

## 4. Rule Builder UI

```
┌─────────────────────────────────────────────────────────────────┐
│  RULES                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Default visibility: [Show ▼]                                   │
│                                                                 │
│  Rule 1:                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [HIDE ▼] this widget when:                                  ││
│  │                                                             ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ [Time ▼]  [is after ▼]  [Event End ▼]                   │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │ [AND ▼]                                                     ││
│  │                                                             ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ [Scan ▼]  [is ▼]  [Checked In ▼]                        │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │ [+ Add Condition]                         [🗑️ Delete Rule] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [+ Add Rule]                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Rule Evaluation Flow

```
Evaluate widget visibility:

1. Get widget.rules[]
2. IF no rules → use default (show)
3. FOR each rule:
   a. Evaluate all conditions
   b. Combine with AND/OR logic
   c. IF conditions met → apply rule.action
4. Return final visibility state
```

```
evaluateRules(widget, context):
  visibility = 'show'  // default
  
  FOR rule in widget.rules:
    conditionResults = rule.conditions.map(c => evaluateCondition(c, context))
    
    IF rule.conditionLogic === 'and':
      allMet = conditionResults.every(r => r === true)
    ELSE:
      allMet = conditionResults.some(r => r === true)
    
    IF allMet:
      visibility = rule.action
      BREAK  // First matching rule wins
  
  RETURN visibility
```

---

## 6. Conflict Detection

```
Conflicts occur when:
  - Rule A: SHOW when time.after(event.end)
  - Rule B: HIDE when time.after(event.end)

Detection:
  Compare condition sets for overlap
  If overlap found + conflicting actions → warn

UI Warning:
  ┌────────────────────────────────────────┐
  │ ⚠️ Rule 2 conflicts with Rule 1        │
  │ Both trigger after event ends          │
  └────────────────────────────────────────┘
```

---

# Part B: Preview Simulator (Module 9)

## 7. Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | Test template under different states |
| **Location** | Template Builder toolbar |
| **Access** | `templates.view` permission |

---

## 8. Simulator Toolbar

```
┌─────────────────────────────────────────────────────────────────┐
│  PREVIEW SIMULATOR                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Time:    [● Before Event] [○ During] [○ After]                │
│  Scan:    [● Not Scanned] [○ Checked In]                       │
│  Guest:   [Regular ▼]  (VIP, Family, etc.)                     │
│  Lang:    [🇸🇦 AR] [🇺🇸 EN]                                       │
│  Device:  [📱 Mobile] [💻 Desktop]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Preview Context

```
PreviewContext {
  time: {
    current: 'before_event' | 'during_event' | 'after_event'
    eventStart: Date
    eventEnd: Date
  }
  scan: {
    status: 'not_scanned' | 'checked_in'
    checkedInAt: Date | null
  }
  guest: {
    name: 'أحمد الرشيد | Ahmed Al-Rashid'
    group: 'vip' | 'family' | 'regular'
    hasCompanions: boolean
  }
  event: {
    name: 'Sample Wedding'
    type: 'wedding' | 'corporate'
  }
  language: 'ar' | 'en'
  device: 'mobile' | 'desktop'
}
```

---

## 10. Debug Visibility Panel

```
┌─────────────────────────────────────────────────────────────────┐
│  DEBUG: Widget Visibility                              [Hide]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Guest Name Block     │ ✅ VISIBLE │ No rules (always show)    │
│  Event Details Block  │ ✅ VISIBLE │ No rules (always show)    │
│  QR Code Block        │ ✅ VISIBLE │ scan ≠ checked_in ✓       │
│  Voice Recorder       │ ❌ HIDDEN  │ time ≠ after_event ✗      │
│  Text Submission      │ ❌ HIDDEN  │ time ≠ after_event ✗      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Each row shows:
- Widget name
- Current state (visible/hidden)
- **Why** (condition evaluation result)

---

# Part C: Memory Book (Module 10)

## 11. Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | Generate shareable compilation of guest messages |
| **Route** | `/events/:id/memory-book` |
| **Access** | `events.view` permission |

---

## 12. Submission Viewer

```
<SubmissionViewer>
├── <Filters>
│   ├── Type: [All] [Voice] [Text]
│   ├── Status: [All] [Approved] [Pending]
│   └── Search: [Guest name...]
│
├── <SubmissionList>
│   └── <SubmissionCard /> (repeated)
│
└── <BulkActions>
    ├── [Approve Selected]
    └── [Hide Selected]
```

### Submission Card

```
┌─────────────────────────────────────────────────────────────────┐
│ ☐ │ 🎙️ Voice │ Ahmed Al-Rashid │ VIP │ 00:45 │ Jan 16, 01:23 │ │
│   │          │                                                 │ │
│   │ [▶️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]                       │ │
│   │                                                            │ │
│   │                                   [✓ Approve] [👁️ Hide]   │ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Memory Book Generation

### Generation Flow

```
Admin clicks "Generate Memory Book"
       ↓
<GenerationModal>
  Settings:
    ☑ Include guest names
    ☑ Include voice messages
    ☑ Include text messages
    ☐ Include timestamps
       ↓
POST /api/admin/events/:id/memory-book/generate
       ↓
Backend:
  1. Query approved submissions
  2. Organize by type
  3. Generate HTML template
  4. Upload to storage
  5. Return URL
       ↓
Show preview + share link
```

### Memory Book Output

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    💍 Mohammed & Fatima                         │
│                      March 15, 2026                             │
│                                                                 │
│  ───────────────────────────────────────────────────────────    │
│                                                                 │
│  Messages from Loved Ones                                       │
│                                                                 │
│  "Congratulations! May your journey together..."                │
│  — Ahmed Al-Rashid                                              │
│                                                                 │
│  [▶️ Voice message from Sara Mohammed]                         │
│                                                                 │
│  "Best wishes to the happy couple!"                             │
│  — Omar Abdullah                                                │
│                                                                 │
│  ───────────────────────────────────────────────────────────    │
│                                                                 │
│                 Created with Rawaj Platform                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Aggregation Flow

```
Query:
  SELECT * FROM guest_submissions
  WHERE event_id = :eventId
    AND status = 'approved'
  ORDER BY created_at ASC

Group by type:
  { voice: [...], text: [...] }

Merge with guest data:
  submission.guest → { name_ar, name_en, group }

Render HTML:
  template + data → memory_book.html

Store:
  Upload to /events/{id}/memory-book/index.html
```

---

## 14. Admin Actions

| Action | Permission | Behavior |
|--------|------------|----------|
| View submissions | `events.view` | Read-only list |
| Approve/Hide | `events.edit` | Toggle status |
| Generate book | `events.edit` | Create artifact |
| Regenerate | `events.edit` | Replace existing |
| Share link | `events.view` | Copy URL |
| Download | `events.view` | HTML file |

---

# Part D: Reports & Exports (Module 11)

## 15. Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | Analytics and data exports |
| **Route** | `/reports` |
| **Access** | `reports.view` permission |

---

## 16. Report Types

| Report | Filters | Metrics |
|--------|---------|---------|
| **Guest Attendance** | Event, date range | Check-ins, no-shows, rate |
| **Invitation Engagement** | Event, channel | Sent, delivered, opened |
| **Scan Logs** | Event, result | All scans with details |
| **Submissions** | Event, type | Voice/text counts |

---

## 17. Report Viewer

```
┌─────────────────────────────────────────────────────────────────┐
│  Invitation Engagement Report                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filters:                                                       │
│  Event: [All Events ▼]  Period: [Last 30 Days ▼]  [Generate]    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Summary                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Sent     │  │ Delivered│  │ Opened   │  │ Clicked  │        │
│  │  1,234   │  │  1,198   │  │   892    │  │   654    │        │
│  │   100%   │  │  97.1%   │  │  72.3%   │  │  53.0%   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [Funnel Chart Visualization]                           │    │
│  │  Sent ████████████████████████████████████ 1,234       │    │
│  │  Delivered █████████████████████████████████ 1,198      │    │
│  │  Opened ██████████████████████████ 892                  │    │
│  │  Clicked ████████████████████ 654                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│                      [📊 View Details] [📥 Export CSV]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 18. Export Flow

```
User clicks "Export CSV"
       ↓
POST /api/admin/reports/export
  body: { type, filters, format: 'csv' | 'excel' }
       ↓
Backend generates file
       ↓
Return download URL
       ↓
Browser downloads file
```

### Export Formats

| Format | Extension | Library |
|--------|-----------|---------|
| CSV | `.csv` | Native |
| Excel | `.xlsx` | ExcelJS |
| PDF | `.pdf` | Future |

---

## 19. File Structure

```
src/features/
├── rules/
│   ├── components/
│   │   ├── RuleBuilder.jsx
│   │   ├── RuleCard.jsx
│   │   ├── ConditionRow.jsx
│   │   └── ConflictWarning.jsx
│   └── utils/
│       ├── ruleEvaluator.js
│       └── conflictDetector.js
│
├── preview/
│   ├── components/
│   │   ├── PreviewSimulator.jsx
│   │   ├── StateToggles.jsx
│   │   └── DebugPanel.jsx
│   └── hooks/
│       └── usePreviewContext.js
│
├── memory-book/
│   ├── components/
│   │   ├── SubmissionViewer.jsx
│   │   ├── SubmissionCard.jsx
│   │   ├── GenerationModal.jsx
│   │   └── MemoryBookPreview.jsx
│   └── pages/
│       └── MemoryBookPage.jsx
│
└── reports/
    ├── components/
    │   ├── ReportFilters.jsx
    │   ├── ReportSummary.jsx
    │   ├── ReportChart.jsx
    │   └── ExportButton.jsx
    └── pages/
        ├── ReportsPage.jsx
        └── ReportDetailPage.jsx
```

---

## 20. Definition of Done

| Criteria | Status |
|----------|--------|
| Rule builder creates valid rules | ⬜ |
| Conflict detection warns user | ⬜ |
| Preview toggles change widget visibility | ⬜ |
| Debug panel explains visibility | ⬜ |
| Submission viewer displays content | ⬜ |
| Memory book generates correctly | ⬜ |
| Reports display charts | ⬜ |
| Export downloads file | ⬜ |
| RTL layout correct | ⬜ |

---

*Module Version: 1.0*  
*Created: 2026-01-18*
