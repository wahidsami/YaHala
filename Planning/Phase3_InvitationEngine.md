# Phase 3: Invitation Card Engine & Template Builder

## Centralized Digital Invitation & QR Verification Platform

---

## 1. Core Concept: Dynamic Invitation Experience

An invitation card is **not a static image**. It is:

| Aspect | Description |
|--------|-------------|
| **Dynamic Web Page** | HTML-based, rendered on demand |
| **Per-Guest** | Personalized with guest data |
| **Template-Driven** | Built from reusable template |
| **Rule-Controlled** | Widgets appear/hide based on conditions |
| **Time-Evolving** | Different experience before, during, after event |

```
┌─────────────────────────────────────────────────────────────────┐
│                    INVITATION LIFECYCLE                         │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   BEFORE EVENT  │  DURING EVENT   │      AFTER EVENT            │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ • View details  │ • QR scanned    │ • Voice recorder appears    │
│ • See QR code   │ • Check-in done │ • Text congratulations      │
│ • Save to cal   │ • QR hides      │ • Memory submission         │
│ • Get directions│                 │ • Thank you message         │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

---

## 2. Template vs Instance Model

### 2.1 Template (Definition)

> Created by **System Admin only**. Reusable across events.

| Property | Description |
|----------|-------------|
| **Creator** | System Admin only |
| **Scope** | Global (available to all clients) or client-specific |
| **Mutability** | Editable until assigned to active events |
| **Contains** | Layout, widgets, styles, rules, translations |

**Template = Blueprint**

### 2.2 Invitation Instance (Runtime)

> Generated **per Guest** when invitation link is accessed.

| Property | Description |
|----------|-------------|
| **Creator** | System (auto-generated) |
| **Scope** | Single guest, single event |
| **Mutability** | Read-only structure, mutable guest data |
| **Uses** | Template + Guest data + Event data + Current time + Scan state |

**Instance = Rendered Output**

### 2.3 One Template → Thousands of Instances

```
Template: "Royal Wedding Gold"
         │
         ├──► Guest: Ahmed Al-Rashid  ──► Instance #1 (personalized)
         │         └─ QR: abc123, Status: not_scanned
         │
         ├──► Guest: Sarah Mohammed   ──► Instance #2 (personalized)
         │         └─ QR: def456, Status: checked_in
         │
         └──► Guest: Omar Abdullah    ──► Instance #3 (personalized)
                   └─ QR: ghi789, Status: not_scanned

Same layout, different:
  • Guest name
  • QR code
  • Widget visibility (based on scan state)
  • Available actions (based on time)
```

---

## 3. Template Structure (Conceptual)

### 3.1 Template Data Model

```
TEMPLATE
├── Metadata
│   ├── name: "Royal Wedding Gold"
│   ├── category: wedding
│   ├── supported_languages: [ar, en]
│   └── supported_event_types: [wedding]
│
├── Layout
│   ├── direction: rtl | ltr (auto from language)
│   ├── background: color | image | gradient
│   └── sections: [header, body, footer, actions]
│
├── Widgets (ordered list)
│   ├── Widget 1: guest_name_block
│   ├── Widget 2: event_details_block
│   ├── Widget 3: qr_code_block
│   ├── Widget 4: voice_recorder (conditional)
│   └── Widget N: ...
│
├── Styles
│   ├── primary_color
│   ├── font_family_ar
│   ├── font_family_en
│   └── spacing, borders, shadows
│
└── Rules (conditional logic)
    ├── Rule 1: show voice_recorder WHEN time > event.end
    ├── Rule 2: hide qr_code WHEN guest.check_in_status = checked_in
    └── Rule N: ...
```

### 3.2 Section Organization

| Section | Purpose | Typical Widgets |
|---------|---------|-----------------|
| **Header** | Branding, decoration | Logo, decorative image |
| **Body** | Core content | Guest name, event details, venue |
| **Actions** | Interactive elements | QR code, buttons, maps |
| **Footer** | Post-event content | Voice recorder, questionnaire |

---

## 4. Widget System

### 4.1 Widget Architecture

Every widget has:

| Property | Description |
|----------|-------------|
| **Type** | Widget identifier (e.g., `text_block`) |
| **Inputs** | Data sources (guest, event, static) |
| **Outputs** | Saved data, triggered actions |
| **Visibility Rules** | Conditions for showing/hiding |
| **Styles** | Widget-specific appearance |
| **Translations** | AR/EN content variants |

---

### 4.2 Widget Catalog

#### 📝 Text Block
| Property | Value |
|----------|-------|
| **Purpose** | Display static or dynamic text |
| **Inputs** | Static text OR dynamic: `{guest.name}`, `{event.name}` |
| **Outputs** | None (display only) |
| **Visibility** | Always visible OR conditional |
| **Use Cases** | Introductions, blessings, event description |

---

#### 🖼️ Image Block
| Property | Value |
|----------|-------|
| **Purpose** | Display decorative or informational images |
| **Inputs** | Image URL (template asset or event-specific) |
| **Outputs** | None |
| **Visibility** | Always or conditional |
| **Use Cases** | Header decoration, venue photo, couple photo |

---

#### 📅 Event Details Block
| Property | Value |
|----------|-------|
| **Purpose** | Show event date, time, venue |
| **Inputs** | `event.start_datetime`, `event.end_datetime`, `event.timezone`, `event.venue_ar/en` |
| **Outputs** | None |
| **Visibility** | Always visible |
| **Features** | Auto-formats date/time per language, shows local timezone |

---

#### 👤 Guest Name Block
| Property | Value |
|----------|-------|
| **Purpose** | Personalized greeting |
| **Inputs** | `guest.name_ar`, `guest.name_en` |
| **Outputs** | None |
| **Visibility** | Always visible |
| **Use Cases** | "Dear Ahmed Al-Rashid" / "عزيزي أحمد الرشيد" |

---

#### 📱 QR Code Block
| Property | Value |
|----------|-------|
| **Purpose** | Display scannable QR for check-in |
| **Inputs** | `qr_token.qr_image_url` |
| **Outputs** | None (scanner reads it) |
| **Visibility** | HIDE after `guest.check_in_status = checked_in` |
| **Use Cases** | Event entrance verification |

---

#### 🔘 Button / Action Block
| Property | Value |
|----------|-------|
| **Purpose** | Trigger actions (save to calendar, get directions) |
| **Inputs** | Action type, label, URL/handler |
| **Outputs** | Action triggered |
| **Actions** | `add_to_calendar`, `open_maps`, `share_invitation` |
| **Visibility** | Conditional (e.g., hide after event) |

---

#### 🎙️ Voice Recorder Widget
| Property | Value |
|----------|-------|
| **Purpose** | Record audio congratulations |
| **Inputs** | Max duration (e.g., 60 seconds), instructions text |
| **Outputs** | `guest_submissions.voice_url`, `guest_submissions.submitted_at` |
| **Visibility** | SHOW after `event.end_datetime` OR after check-in |
| **Limits** | 1 submission per guest (editable: yes/no configurable) |

---

#### 📋 Questionnaire / Survey Widget
| Property | Value |
|----------|-------|
| **Purpose** | Collect structured feedback |
| **Inputs** | Question list, answer types (text, choice, rating) |
| **Outputs** | `guest_responses.answers` (JSON) |
| **Visibility** | SHOW after specific condition (scan, time, etc.) |
| **Use Cases** | Post-event feedback, session rating, dietary preferences |

---

#### ➖ Divider / Spacer
| Property | Value |
|----------|-------|
| **Purpose** | Visual separation between sections |
| **Inputs** | Height, style (line, dots, pattern) |
| **Outputs** | None |
| **Visibility** | Always |

---

#### 💬 Text Submission Widget
| Property | Value |
|----------|-------|
| **Purpose** | Collect text congratulations/messages |
| **Inputs** | Placeholder text, max length, instructions |
| **Outputs** | `guest_submissions.text_content`, `guest_submissions.submitted_at` |
| **Visibility** | SHOW after `event.end_datetime` OR after check-in |
| **Limits** | 1 submission per guest |

---

### 4.3 Widget Summary Table

| Widget | Inputs | Outputs | Typical Visibility |
|--------|--------|---------|-------------------|
| Text Block | Static/dynamic text | — | Always |
| Image Block | Image URL | — | Always |
| Event Details | Event data | — | Always |
| Guest Name | Guest data | — | Always |
| QR Code | QR token | — | Before check-in |
| Button/Action | Action config | Action triggered | Conditional |
| Voice Recorder | Config | Voice file | After event |
| Questionnaire | Questions | Responses | After scan/event |
| Divider | Style | — | Always |
| Text Submission | Config | Text message | After event |

---

## 5. Conditional Logic Engine

### 5.1 Rule Structure

Every rule follows this pattern:

```
WHEN [condition_group] THEN [action] ON [widget_id]
```

**Actions:**
- `SHOW` – Widget becomes visible
- `HIDE` – Widget becomes hidden
- `ENABLE` – Widget becomes interactive
- `DISABLE` – Widget becomes non-interactive

---

### 5.2 Condition Types

#### ⏰ Time-Based Conditions

| Condition | Evaluates To |
|-----------|--------------|
| `time.before_event_start` | Current time < event.start_datetime |
| `time.during_event` | event.start_datetime ≤ Current time ≤ event.end_datetime |
| `time.after_event_end` | Current time > event.end_datetime |
| `time.after_event_start` | Current time > event.start_datetime |
| `time.hours_before(N)` | Current time < event.start_datetime - N hours |
| `time.hours_after(N)` | Current time > event.end_datetime + N hours |

---

#### 📱 Scan-Based Conditions

| Condition | Evaluates To |
|-----------|--------------|
| `scan.not_scanned` | guest.check_in_status = not_checked_in |
| `scan.checked_in` | guest.check_in_status = checked_in |
| `scan.rejected` | Last scan result was invalid/duplicate |

---

#### 👤 Guest-Based Conditions

| Condition | Evaluates To |
|-----------|--------------|
| `guest.group_is(VIP)` | guest.group_id matches "VIP" group |
| `guest.group_is(Family)` | guest.group_id matches "Family" group |
| `guest.invitation_status_is(X)` | guest.invitation_status = X |
| `guest.has_companions` | guest.companions_allowed > 0 |

---

#### 🎉 Event-Based Conditions

| Condition | Evaluates To |
|-----------|--------------|
| `event.type_is(wedding)` | event belongs to wedding category |
| `event.type_is(corporate)` | event belongs to corporate category |
| `event.status_is(active)` | event.status = active |
| `event.status_is(completed)` | event.status = completed |

---

### 5.3 Rule Examples

| Rule | Widget | Condition | Action |
|------|--------|-----------|--------|
| Show voice recorder after event | voice_recorder | `time.after_event_end` | SHOW |
| Show questionnaire after check-in | questionnaire | `scan.checked_in` | SHOW |
| Hide QR after successful scan | qr_code | `scan.checked_in` | HIDE |
| Enable memory submission post-event | text_submission | `time.after_event_end` | ENABLE |
| Show VIP welcome message | vip_text_block | `guest.group_is(VIP)` | SHOW |
| Hide calendar button after event | add_to_calendar | `time.after_event_start` | HIDE |

---

### 5.4 Rule Combination (AND/OR)

```
Compound Rule:
  WHEN (time.after_event_end AND scan.checked_in)
  THEN SHOW voice_recorder

Interpretation:
  Voice recorder only appears if:
    1. Event has ended
    2. AND guest was actually checked in
```

---

### 5.5 Admin-Friendly Rule Configuration

Rules are configured via **dropdown-based UI**, not code:

```
┌─────────────────────────────────────────────────────────────┐
│  RULE BUILDER                                               │
├─────────────────────────────────────────────────────────────┤
│  Widget: [Voice Recorder ▼]                                 │
│                                                             │
│  Action: [SHOW ▼]                                           │
│                                                             │
│  When ALL of these are true:                                │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ [Time ▼] [is after ▼] [Event End ▼]                 │ │
│    └─────────────────────────────────────────────────────┘ │
│                                          [+ Add Condition]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Wedding-Specific Experience

### 6.1 Wedding Guest Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEDDING GUEST TIMELINE                       │
└─────────────────────────────────────────────────────────────────┘

PHASE 1: BEFORE EVENT (Days/Hours Before)
┌─────────────────────────────────────────────────────────────────┐
│  VISIBLE WIDGETS:                                               │
│  ✓ Guest Name Block     "Dear Ahmed Al-Rashid"                  │
│  ✓ Event Details        "Wedding of Mohammed & Fatima"          │
│  ✓ Venue Block          "Ritz Carlton, Riyadh"                  │
│  ✓ QR Code Block        [████████]                              │
│  ✓ Add to Calendar      [📅 Save Date]                          │
│  ✓ Get Directions       [🗺️ Open Maps]                          │
│                                                                 │
│  HIDDEN WIDGETS:                                                │
│  ✗ Voice Recorder       (appears after event)                   │
│  ✗ Text Congratulations (appears after event)                   │
└─────────────────────────────────────────────────────────────────┘

PHASE 2: AT EVENT (During - After Scan)
┌─────────────────────────────────────────────────────────────────┐
│  CHANGES AFTER QR SCAN:                                         │
│  ✗ QR Code Block        HIDDEN (already checked in)             │
│  ✓ Welcome Message      "Welcome! Enjoy the celebration"        │
│  ✓ Check-in Confirmed   ✅ "You have checked in at 10:23 PM"    │
└─────────────────────────────────────────────────────────────────┘

PHASE 3: AFTER EVENT (Post 10 PM or event end)
┌─────────────────────────────────────────────────────────────────┐
│  NEW WIDGETS APPEAR:                                            │
│  ✓ Voice Recorder       [🎙️ Record Congratulations]             │
│  ✓ Text Submission      [💬 Write a Message]                    │
│  ✓ Optional Photo Upload (future)                               │
│                                                                 │
│  HIDDEN:                                                        │
│  ✗ Add to Calendar      (event passed)                          │
│  ✗ Get Directions       (event passed)                          │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Wedding Data Collection

| Submission Type | Data Stored | Linked To |
|-----------------|-------------|-----------|
| Voice Message | Audio file URL, duration | guest_id, event_id, timestamp |
| Text Message | Text content | guest_id, event_id, timestamp |
| Photo (future) | Image URL | guest_id, event_id, timestamp |

---

## 7. Memory Book Concept

### 7.1 Purpose

> A digital keepsake for the event hosts (bride & groom, or corporate organizer) containing all guest messages.

### 7.2 Data Flow

```
Guest Submissions
      │
      ├──► Voice Recording ──► Stored in guest_submissions
      │                         └─ voice_url, duration, guest_id
      │
      └──► Text Message ──► Stored in guest_submissions
                             └─ text_content, guest_id
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MEMORY BOOK GENERATOR                        │
│                    (Runs after event ends)                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Query all guest_submissions WHERE event_id = X              │
│  2. Group by submission type (voice, text)                      │
│  3. Optionally include guest names (privacy setting)            │
│  4. Generate HTML-based memory book page                        │
│  5. Store as read-only artifact                                 │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
Memory Book Output
  ├── HTML Page (for web viewing)
  ├── PDF Export (optional, future)
  └── Accessible only to event owners
```

### 7.3 Memory Book Structure

```
MEMORY BOOK PAGE
├── Header
│   ├── Event name
│   ├── Event date
│   └── Host names
│
├── Messages Section
│   ├── Message 1
│   │   ├── Guest name (optional)
│   │   ├── Text content
│   │   └── Timestamp
│   ├── Message 2
│   └── ...
│
├── Voice Messages Section
│   ├── Voice 1
│   │   ├── Guest name (optional)
│   │   ├── Audio player
│   │   └── Duration
│   └── ...
│
└── Footer
    └── "Created with Rawaj Platform"
```

### 7.4 Privacy Controls

| Setting | Options |
|---------|---------|
| **Show Guest Names** | Yes / No (event-level setting) |
| **Access Control** | Only event owners (linked to client account) |
| **Content Moderation** | Auto-flag (future), manual review |
| **Retention Period** | Configurable (e.g., 1 year, permanent) |

---

## 8. Corporate / Meeting Event Model

### 8.1 Different Event, Same Engine

The same widget + rule engine supports non-wedding events:

```
CORPORATE EVENT FLOW
┌─────────────────────────────────────────────────────────────────┐
│  BEFORE EVENT                                                   │
│  ✓ Event Details        "Annual Sales Conference"               │
│  ✓ Agenda Block         Session schedule                        │
│  ✓ QR Code              Check-in                                │
│  ✓ Pre-event Survey     "What topics interest you?"             │
│                                                                 │
│  AFTER SCAN (During Event)                                      │
│  ✓ Session Feedback     [Rate this session: ⭐⭐⭐⭐⭐]           │
│  ✓ Live Q&A Link        [Ask a Question]                        │
│                                                                 │
│  AFTER EVENT                                                    │
│  ✓ Post-Event Survey    "How was your experience?"              │
│  ✓ Certificate Download [📜 Get Certificate]                    │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Corporate-Specific Rules

| Rule | Widget | Condition | Action |
|------|--------|-----------|--------|
| Show pre-event survey | questionnaire_pre | `time.before_event_start` | SHOW |
| Show session feedback | questionnaire_live | `scan.checked_in AND time.during_event` | SHOW |
| Show post-event survey | questionnaire_post | `time.after_event_end` | SHOW |
| Show certificate | cert_download | `time.after_event_end AND scan.checked_in` | SHOW |

### 8.3 Event Type Comparison

| Feature | Wedding | Corporate |
|---------|---------|-----------|
| Voice Recorder | ✅ Yes | ❌ No |
| Text Congratulations | ✅ Yes | ❌ No |
| Memory Book | ✅ Yes | ❌ No |
| Pre-Event Survey | ❌ No | ✅ Yes |
| Session Feedback | ❌ No | ✅ Yes |
| Post-Event Survey | Optional | ✅ Yes |
| Certificate | ❌ No | ✅ Yes |

---

## 9. Admin Workflow

### 9.1 Template Creation Flow

```
STEP 1: CREATE TEMPLATE
┌─────────────────────────────────────────────────────────────────┐
│  Name: "Royal Wedding Gold"                                     │
│  Category: Wedding                                              │
│  Languages: Arabic, English                                     │
│  [Create Template]                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
STEP 2: ADD WIDGETS
┌─────────────────────────────────────────────────────────────────┐
│  WIDGET PALETTE          CANVAS                                 │
│  ┌─────────────┐        ┌─────────────────────────────────────┐ │
│  │ Text Block  │        │  [Guest Name Block]                 │ │
│  │ Image       │   →    │  [Event Details Block]              │ │
│  │ QR Code     │        │  [QR Code Block]                    │ │
│  │ Voice Rec.  │        │  [Voice Recorder] (hidden by rule)  │ │
│  └─────────────┘        └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
STEP 3: DEFINE RULES
┌─────────────────────────────────────────────────────────────────┐
│  Rules for: Voice Recorder                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ SHOW this widget WHEN:                                      ││
│  │   [Time] [is after] [Event End]                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
STEP 4: CONFIGURE STYLES
┌─────────────────────────────────────────────────────────────────┐
│  Primary Color: [#D4AF37]                                       │
│  Font (Arabic): [Noto Sans Arabic]                              │
│  Font (English): [Playfair Display]                             │
│  Background: [Upload Image]                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
STEP 5: SAVE & PREVIEW
┌─────────────────────────────────────────────────────────────────┐
│  Preview States:                                                │
│  [Before Event] [After Scan] [After Event] [Mobile] [Desktop]   │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  Preview        │                                            │
│  │  (simulated)    │                                            │
│  └─────────────────┘                                            │
│                                                                 │
│  [Save as Draft]  [Publish Template]                            │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Template Assignment

```
EVENT CREATION / EDIT
┌─────────────────────────────────────────────────────────────────┐
│  Event Name: "Mohammed & Fatima Wedding"                        │
│  Date/Time: 2026-03-15 22:00 - 2026-03-16 02:00                │
│  Timezone: Asia/Riyadh                                          │
│                                                                 │
│  Invitation Template: [Royal Wedding Gold ▼]                    │
│                                                                 │
│  [Preview with Sample Guest]                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Rendering Flow

### 10.1 Guest Opens Invitation Link

```
REQUEST: GET https://invite.rawaj.app/{link_token}
                              ↓
STEP 1: LINK RESOLUTION
┌─────────────────────────────────────────────────────────────────┐
│  Query invitation_links WHERE link_token = {link_token}         │
│  Validate: not expired, is valid                                │
│  Result: guest_id, event_id                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
STEP 2: LOAD CONTEXT
┌─────────────────────────────────────────────────────────────────┐
│  Load: guest record                                             │
│  Load: event record (with timezone)                             │
│  Load: template assigned to event                               │
│  Load: qr_token for guest                                       │
│  Calculate: current_time in event.timezone                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
STEP 3: BUILD CONTEXT OBJECT
┌─────────────────────────────────────────────────────────────────┐
│  context = {                                                    │
│    guest: { name_ar, name_en, check_in_status, group },         │
│    event: { name, start_datetime, end_datetime, venue, type },  │
│    qr: { image_url, is_valid },                                 │
│    time: { now, is_before_event, is_during, is_after },         │
│    language: ar | en (from browser or guest preference)         │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
STEP 4: EVALUATE RULES
┌─────────────────────────────────────────────────────────────────┐
│  FOR each widget in template.widgets:                           │
│    FOR each rule targeting this widget:                         │
│      Evaluate condition against context                         │
│      Apply action (SHOW/HIDE/ENABLE/DISABLE)                    │
│    END                                                          │
│  END                                                            │
│  Result: filtered_widgets (only visible ones)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
STEP 5: RENDER HTML
┌─────────────────────────────────────────────────────────────────┐
│  FOR each widget in filtered_widgets:                           │
│    Substitute placeholders with context data                    │
│    Apply styles                                                 │
│    Render widget HTML                                           │
│  END                                                            │
│  Assemble into full page                                        │
│  Apply RTL/LTR based on language                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
STEP 6: TRACK & RESPOND
┌─────────────────────────────────────────────────────────────────┐
│  Update: guest.invitation_status = 'clicked'                    │
│  Log: page view event                                           │
│  Return: rendered HTML page                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Action Handling

| Action | Trigger | Handler |
|--------|---------|---------|
| Voice Submit | Guest records & submits | Store file, create `guest_submissions` record |
| Text Submit | Guest types & submits | Store text, create `guest_submissions` record |
| Survey Submit | Guest completes form | Store responses in `guest_responses` |
| Add to Calendar | Guest clicks button | Generate ICS file, download |
| Open Maps | Guest clicks button | Open native maps with venue coords |

---

## 11. Security & Abuse Prevention

### 11.1 Submission Limits

| Control | Implementation |
|---------|----------------|
| **One Voice per Guest** | Check `guest_submissions` before allowing new recording |
| **One Text per Guest** | Same as above |
| **Editable Window** | Allow edit within X hours of submission (configurable) |
| **Max File Size** | Voice: 5MB, Image: 10MB |
| **Max Duration** | Voice: 60 seconds |

### 11.2 Link Security

| Control | Implementation |
|---------|----------------|
| **Token Unpredictability** | 64-character random tokens |
| **Expiration** | Links expire 24-48 hours after event ends |
| **Rate Limiting** | Max 60 requests per minute per IP |
| **No Enumeration** | Invalid tokens return generic error |

### 11.3 Content Moderation (Future)

| Level | Method |
|-------|--------|
| **Basic** | Profanity filter on text submissions |
| **Standard** | Audio transcription + text filter |
| **Advanced** | AI-based content moderation |
| **Manual** | Admin review queue for flagged content |

### 11.4 Public Access Restrictions

| Rule | Enforcement |
|------|-------------|
| **No Authentication Required** | Guests access via token, no login |
| **Read-Only Guest Data** | Guests cannot modify their profile |
| **Scoped Access** | Token only grants access to own invitation |
| **No Cross-Guest Access** | Cannot view other guests' data |

---

## 12. Database Additions (Phase 3)

> New tables required to support this phase:

### `guest_submissions`
| Field | Type | Description |
|-------|------|-------------|
| `id` | PK | Unique identifier |
| `guest_id` | FK → guests | Guest reference |
| `event_id` | FK → events | Event reference |
| `submission_type` | ENUM | 'voice', 'text', 'photo' |
| `content_url` | VARCHAR | File URL (for voice/photo) |
| `text_content` | TEXT | Text message content |
| `duration` | INT | Audio duration in seconds |
| `submitted_at` | TIMESTAMP | Submission time |
| `updated_at` | TIMESTAMP | Last edit time |
| `is_approved` | BOOLEAN | Moderation status |

### `guest_responses`
| Field | Type | Description |
|-------|------|-------------|
| `id` | PK | Unique identifier |
| `guest_id` | FK → guests | Guest reference |
| `event_id` | FK → events | Event reference |
| `widget_id` | VARCHAR | Questionnaire widget identifier |
| `responses` | JSON | Question-answer pairs |
| `submitted_at` | TIMESTAMP | Submission time |

---

## 13. Future Considerations

> [!NOTE]
> The following enhancements are **not required now** but documented for future awareness.

### 13.1 Extended Widget State Model

Current widget states: `visible`, `hidden`, `enabled`, `disabled`

**Future states to consider:**

| State | Use Case |
|-------|----------|
| `locked` | Widget visible but no longer accepting input |
| `submitted` | Show confirmation instead of form (e.g., "Thank you for your message") |
| `expired` | Widget time window has passed |

**Example Flow:**
```
Voice Recorder States:
  hidden → visible → recording → submitted → locked
                                    ↓
                      "Thank you for your message ✓"
```

### 13.2 Memory Book Generation Trigger

**Current:** "Runs after event ends" (implicit)

**Options to decide later:**

| Trigger | Description |
|---------|-------------|
| **Auto-generated** | System creates memory book at `event.end_datetime + X hours` |
| **On-demand** | Admin clicks "Generate Memory Book" button |
| **Hybrid** | Auto-generate draft, admin publishes |

Both are valid; decision can be made during implementation.

### 13.3 Template Versioning

**Problem:** Updating a template could break existing events.

**Future solution:**

| Concept | Description |
|---------|-------------|
| **Template Versions** | Template v1, v2, v3... |
| **Version Lock** | Event locks to template version at creation |
| **Backward Compatibility** | Old events remain stable on old version |

**Example:**
```
Template: "Royal Wedding Gold"
  └── v1 (used by Event A, Event B)
  └── v2 (new events use this)
  └── v3 (draft, not published)
```

---

*Document Version: 1.1*  
*Created: 2026-01-18*  
*Updated: 2026-01-18 – Added Future Considerations section*  
*Relates To: Phase 1 (implementation_plan.md), Phase 2 (backend_architecture.md)*
