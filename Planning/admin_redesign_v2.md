# Admin App Redesign v2 — Hub-First, Playful Event Brand

Hand-off spec for VS Code Codex to rebuild the `apps/admin` UI around a
**center-hub navigation** model (no permanent sidebar) with a **playful event
brand** vibe and **balanced density**. Backend APIs are unchanged.

> Replaces the sidebar/topbar shell from v1 of plan.md. Sections 4 (Design
> System), 6 (Cross-cutting), 7 (Migration order) and 8 (Deliverables) from v1
> still apply unless overridden here.

---

## 0. Reference Mockups

These JPGs in `src/assets/` are the source of truth for layout and tone:

| File | Screen |
|---|---|
| `mockup_hub_desktop.jpg` | Home hub (desktop, 4 action cards) |
| `mockup_hub_mobile.jpg`  | Home hub + section detail (mobile) |
| `mockup_create_event.jpg`| Create Event 4-step wizard |
| `mockup_guests.jpg`      | Guests list with stats + bulk actions |
| `mockup_send.jpg`        | Send invitations composer |
| `mockup_library.jpg`     | Templates / invite library gallery |

Match spacing, radius, type, and color from these mockups exactly.

---

## 1. Navigation Model — Center Hub

**No persistent sidebar. No top tab bar.** Navigation is:

```
Home Hub  →  Section page  →  optional sub-step / detail
                  ↑ back chevron + breadcrumb returns to Home
```

### 1.1 Top bar (all pages, slim, transparent over background)
- Left: Invitely logo + back chevron + breadcrumb (hidden on Home).
- Center: ⌘K command-palette pill ("Search events, guests, templates…").
- Right: notifications bell, theme toggle, user avatar menu.
- Height 56px desktop, 52px mobile. No borders — uses background blur.

### 1.2 Home hub (`/`)
- Big greeting in **Fraunces** serif: "Good evening, {firstName} 🎉".
- Sub-line in **Inter**: today's date + 1-line status ("3 events this week").
- **4 large action cards** in a 2×2 grid (desktop) / 2×2 grid (mobile):
  1. **Create Event** → `/events/new`
  2. **Manage Guests** → `/guests`
  3. **Send Invitations** → `/send`
  4. **Library & Templates** → `/library`
- Each card: rounded-3xl, soft pastel gradient, illustrated icon top-left,
  title, 1-line description, small "→" affordance bottom-right.
- Below cards: **Recent activity** strip — horizontal scroll of last 5 events
  with thumbnail + name + RSVP progress bar. Click → event dashboard.
- Background: cream `#FBF7F2` with 3 blurred gradient blobs (peach/lavender/mint).

### 1.3 Section pages
Each of the 4 hubs is a self-contained page. Power features (filters, bulk,
search) live **inside** the page, never in global chrome. Right-side helper
panels are informational only — never block content.

### 1.4 Command palette (`⌘K` / tap search pill)
Universal jump: events, clients, templates, guests + quick actions
("Create event", "Send invitations", "Import guests CSV"). This replaces deep
sidebar groups for power users.

### 1.5 Mobile rules
- Same hub model. No bottom tab bar.
- Cards stack 2×2; section pages get sticky bottom action bar when needed.
- Back chevron is always top-left, thumb-reachable.
- ⌘K becomes a tap-to-search icon in the top bar.

### 1.6 Removed from v1
- Collapsible icon sidebar — gone.
- Sidebar grouping (WORKSPACE/OPERATIONS/etc.) — gone.
- Per-route left-nav highlight states — gone.

---

## 2. Per-Screen Specs

### 2.1 Create Event (`/events/new`) — `mockup_create_event.jpg`
4-step wizard with progress dots top-center:

1. **Event type** — 6 illustrated tiles (Birthday, Wedding, Engagement,
   Brunch, Baby Shower, Corporate). Live invite preview on the right.
2. **Details** — name, date, time, venue, cover image upload.
3. **Design invite** — pick template from Library or upload; live preview.
4. **Guest list** — paste, CSV import, or pick existing group.

Sticky bottom bar: `Save draft` (ghost) · `Continue →` (primary).
Back chevron exits to Home with confirm-if-dirty.

**API**: `POST /admin/events` (step 2 commit), `PATCH /admin/events/:id`
(steps 3–4), `POST /admin/events/:id/guests/bulk`.

### 2.2 Guests (`/guests`) — `mockup_guests.jpg`
- Top: 4 stat pills — Invited / Confirmed / Pending / Declined (counts + %).
- Segmented tabs: All · Confirmed · Pending · Declined.
- Toolbar row: search, filter (event, group, RSVP, tags), `Import CSV`,
  `+ Add Guest`.
- Virtualized table: avatar, name, group chips, RSVP pill, +1 count,
  last contacted, row actions.
- Row select → **floating bulk-action bar** (Send reminder, Move group,
  Export, Delete).
- Right helper panel: **Quick groups** (saved filters, drag-to-reorder).

**API**: `GET /admin/guests?…`, `POST /admin/guests/bulk-action`,
`POST /admin/guests/import`, `GET /admin/guests/stats`.

### 2.3 Send Invitations (`/send`) — `mockup_send.jpg`
- Channel pills: WhatsApp · Email · SMS · Public link.
- Audience chips: pick event + group(s) + filters; live recipient count.
- Message editor with merge-tag pills (`{{name}}`, `{{event}}`,
  `{{rsvp_link}}`); attached invite card preview.
- Schedule toggle → date/time picker; default = Send now.
- Right: live phone preview (WhatsApp/SMS) or email preview, swaps with channel.
- One big primary button: `Send {n} invites →`.

**API**: `POST /admin/invitation-projects`, `POST /admin/invitations/bulk`,
`POST /admin/invitations/schedule`, `GET /admin/invitations/preview`.

### 2.4 Library & Templates (`/library`) — `mockup_library.jpg`
- Filter chips by occasion (All, Wedding, Birthday, Corporate, …).
- 3-column gallery grid of invite cards: thumbnail, title, occasion tag,
  heart-to-save, hover → `Use template →`.
- Right panel: **Saved templates** + drag-and-drop **Upload your own** zone.
- Click a card → split-pane builder (controls left, live preview right,
  device toggle desktop/mobile).

**API**: `GET /admin/templates`, `POST /admin/templates`,
`POST /admin/templates/:id/duplicate`, `POST /admin/templates/upload`.

---

## 3. Design System Updates

Override the v1 tokens with the playful event brand palette.

### 3.1 Tokens (`src/styles/tokens.css`, `oklch`)
```css
:root {
  --bg:           oklch(0.985 0.012 75);   /* cream #FBF7F2 */
  --surface:      oklch(1 0 0);
  --foreground:   oklch(0.22 0.02 285);

  --primary:      oklch(0.72 0.16 28);     /* warm coral */
  --primary-fg:   oklch(0.99 0 0);
  --accent-peach: oklch(0.88 0.08 55);
  --accent-lav:   oklch(0.85 0.06 295);
  --accent-mint:  oklch(0.88 0.07 165);

  --muted:        oklch(0.96 0.01 80);
  --border:       oklch(0.92 0.01 80);
  --ring:         oklch(0.72 0.16 28 / 0.4);

  --radius-card:  1.5rem;   /* rounded-3xl on cards */
  --radius-pill:  9999px;
  --shadow-card:  0 10px 40px -20px oklch(0.5 0.1 30 / 0.25);
  --gradient-hub: linear-gradient(135deg,
                    var(--accent-peach), var(--accent-lav), var(--accent-mint));
}
.dark { /* deeper cream→plum, same accent hues, lower lightness */ }
```

### 3.2 Type
- Display / greetings: **Fraunces** (serif, 600).
- UI / body: **Inter** (400 / 500 / 600).
- Numbers in stat pills: **Inter Tight** tabular-nums.
- Never use Geist (was v1) — replaced for warmer feel.

### 3.3 Components
shadcn primitives, customised:
- `HubCard` — rounded-3xl, gradient border, illustrated icon slot.
- `StatPill` — pill with label + big number + delta.
- `BreadcrumbBar` — chevron + 1–3 crumbs, sticky top.
- `CommandPalette` — cmdk, full-screen on mobile, centered modal desktop.
- `BulkActionBar` — floats up from bottom on row select.
- `WizardStepper` — dots top-center, sticky footer Continue/Back.

### 3.4 Motion (framer-motion)
- Hub cards: stagger fade-up on mount (60ms gap).
- Card hover: scale 1.02, shadow lift.
- Page transition: cross-fade 180ms.
- Wizard step: slide-x 200ms.
- Respect `prefers-reduced-motion`.

---

## 4. Routing Changes

Drop the layout shell that wrapped every route in v1. Two layouts only:

```
src/app/
  (hub)/                 # uses HubChrome (slim topbar, no sidebar)
    page.tsx             → /
    events/new/page.tsx  → /events/new          (wizard)
    events/[id]/...      → /events/:id          (event dashboard, tabs)
    guests/page.tsx      → /guests
    send/page.tsx        → /send
    library/page.tsx     → /library
    library/[id]/page.tsx
    clients/...          (still reachable via ⌘K, no nav link)
    settings/...
  (public)/              # invite recipient pages, no chrome
    invite/[token]/page.tsx
```

Clients / Reports / Logs / Addons stay implemented but become **⌘K-only**
destinations — they don't appear on the Home hub. This keeps the entry point
calm for the 90% use case.

---

## 5. Backend / API

**No backend changes.** All endpoints from v1 §5 remain. Re-map them to new
screens as listed in §2 above. New TanStack Query hooks needed:

- `useHubSummary()` → counts for hub recent-activity strip
  (`GET /admin/dashboard/hub-summary` — alias of existing
  `/admin/reports/overview`, no new endpoint).
- `useGuestStats(eventId?)` → 4 stat pills.
- `useSendPreview(payload)` → live channel preview (debounced).

If `/admin/dashboard/hub-summary` alias is undesirable, just call
`/admin/reports/overview` directly from `useHubSummary`.

---

## 6. Migration Order for Codex

1. Install **Fraunces** + **Inter** via `next/font` (or `@fontsource`).
2. Replace tokens in `src/styles/tokens.css` with §3.1.
3. Build `HubChrome` (slim topbar + ⌘K + breadcrumb), delete old `AppShell`/
   `Sidebar`/`SidebarGroup`.
4. Build Home hub page (`/`) with `HubCard` × 4 + recent activity strip.
5. Port screens in this order, one PR each:
   Create Event wizard → Guests → Send → Library → Event dashboard tabs.
6. Move Clients / Reports / Logs / Addons / Settings under `(hub)` layout
   but remove them from any visible nav; expose via ⌘K only.
7. Add motion, keyboard shortcuts (`⌘K`, `g h` home, `n` new event, `?` help).
8. QA: 375px mobile, dark mode, RTL (Arabic), a11y AA, Lighthouse ≥ 90 / 95.

---

## 7. Deliverables Checklist

- [ ] No sidebar component imported anywhere.
- [ ] Home hub matches `mockup_hub_desktop.jpg` and `mockup_hub_mobile.jpg`.
- [ ] All 4 section pages match their mockups within 1 spacing step.
- [ ] ⌘K opens on every page including mobile.
- [ ] Back chevron + breadcrumb on every non-Home page.
- [ ] Wizard has confirm-if-dirty on exit.
- [ ] Bulk-action bar appears only on row select.
- [ ] Stat pills use tabular-nums.
- [ ] Fraunces loaded for all `h1`/greeting; Inter for the rest.
- [ ] Lighthouse Performance ≥ 90, A11y ≥ 95 on Home, Guests, Send.
- [ ] Mobile usable at 375px, no horizontal scroll.
- [ ] Dark mode parity.

---

## 8. How to Use This File in VS Code with Codex

1. Drop this file at `apps/admin/.codex/redesign_v2.md` in your repo.
2. Copy the 6 mockup JPGs from `/mnt/documents/` into
   `apps/admin/.codex/mockups/` so Codex can reference them.
3. Open Codex and paste:
   > "Implement `.codex/redesign_v2.md` step by step starting at section 6,
   > one task per migration step. Reference mockups in `.codex/mockups/`.
   > Do not change backend APIs."
4. Review each PR against §7 checklist before merging.
