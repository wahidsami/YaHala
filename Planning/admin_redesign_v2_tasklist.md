# Admin Redesign v2 Task List

Last updated: 2026-05-12

This file tracks the current implementation status of the admin redesign work based on:

- [x] `Planning/admin_redesign_v2.md`
- [x] the current `apps/admin` implementation
- [x] the redesign work already completed in this repo

Use this as the working checklist for the remaining redesign.

---

## 1. Completed

### 1.1 Shell and navigation
- [x] Removed the old sidebar-first shell from the primary admin flow.
- [x] Added a new hub-style chrome with back button.
- [x] Added a new hub-style chrome with breadcrumb path.
- [x] Added a new hub-style chrome with search / command palette entry.
- [x] Added a new hub-style chrome with theme toggle.
- [x] Added a new hub-style chrome with user menu.
- [x] Moved the main landing page to `/`.
- [x] Redirected `/dashboard` to `/`.
- [x] Kept deep legacy routes accessible inside the new shell.

### 1.2 Home hub
- [x] Added the new home hub page.
- [x] Added the `Create Event` main entry card.
- [x] Added the `Manage Guests` main entry card.
- [x] Added the `Send Invitations` main entry card.
- [x] Added the `Library & Templates` main entry card.
- [x] Added recent event/activity strip behavior using existing API data.

### 1.3 Primary flows
- [x] Added a new Create Event wizard page.
- [x] Added a new Send Invitations page.
- [x] Added a new Library page.

### 1.4 System-wide styling
- [x] Reworked shared admin visual tokens and base styling.
- [x] Applied the new visual language to the redesigned shell and primary flows.

### 1.5 Compatibility
- [x] Kept `Clients` reachable inside the new shell.
- [x] Kept `Events` reachable inside the new shell.
- [x] Kept `Addons` reachable inside the new shell.
- [x] Kept `Reports` reachable inside the new shell.
- [x] Kept `Logs` reachable inside the new shell.
- [x] Kept `Settings` reachable inside the new shell.
- [x] Kept `Invitation Projects` reachable inside the new shell.
- [x] Verified the admin app builds successfully with `npm run build`.

---

## 2. Partially Completed

### 2.1 Guests
- [x] Guests page is reachable through the new shell.
- [x] Guests page inherits the new global styling layer.
- [x] Guests page now has a dedicated redesign pass with stat cards, segmented views, helper panel, and bulk-action UX.
- [ ] Guests page still needs final mockup-parity polish and a truer RSVP/event-group data model.

### 2.2 Secondary screens
- [x] Secondary screens still work under the new shell.
- [ ] Secondary screens are not yet visually redesigned to match the new hub-first product language.

---

## 3. Remaining High-Priority Work

### 3.1 Guests redesign
- [x] Rebuild Guests page to match `mockup_guests.jpg` more closely.
- [x] Replace current summary model with invitation-lifecycle stat cards.
- [ ] Replace current summary model with true RSVP-first `Confirmed` stat card backed by event-level data.
- [ ] Replace current summary model with true RSVP-first `Pending` stat card backed by event-level data.
- [ ] Replace current summary model with true RSVP-first `Declined` stat card backed by event-level data.
- [x] Add segmented RSVP-style filtering tabs.
- [x] Rework Guests toolbar around search.
- [ ] Rework Guests toolbar around event filter.
- [ ] Rework Guests toolbar around group filter.
- [x] Rework Guests toolbar around RSVP-style lifecycle filtering.
- [x] Rework Guests toolbar around import CSV.
- [x] Rework Guests toolbar around add guest.
- [x] Add row-selection UX with floating bulk action bar.
- [x] Add quick groups side panel.
- [x] Improve mobile layout for the Guests flow.

### 3.2 Send Invitations polish
- [x] Improve `/send` to better match `mockup_send.jpg`.
- [x] Refine audience chips and recipient selection UX.
- [x] Improve channel-specific preview behavior.
- [x] Improve schedule/send-now UX.
- [x] Decide whether message body should become event-aware defaults per channel.
- [x] Add stronger visual connection to the active invitation/template preview.

### 3.3 Library polish
- [x] Improve `/library` to better match `mockup_library.jpg`.
- [x] Upgrade gallery cards to feel more like real template previews.
- [x] Improve saved-template experience.
- [x] Improve upload / custom design entry flow.
- [x] Review whether template categories need expansion beyond current backend values.

### 3.4 Create Event polish
- [ ] Improve wizard polish to better match `mockup_create_event.jpg`.
- [ ] Improve live preview quality.
- [ ] Improve step transitions and completion states.
- [ ] Improve dirty-state / exit confirmation behavior.
- [ ] Review whether client selection should stay in step 2 or move earlier for operational clarity.
- [ ] Review whether guest import options need a dedicated CSV/paste/create-group UI instead of only reusable guest selection.

---

## 4. Remaining Secondary Redesign Work

### 4.1 Event workspace
- [x] Restyle event detail/dashboard pages to match the new shell.
- [ ] Review event tabs for simplification and clearer grouping.
- [ ] Align invitation setup / invitation ops / guests / addons tabs with the new visual system.

### 4.2 Clients
- [ ] Redesign client list and client profile pages to fit the new product language.
- [ ] Keep Clients as a secondary / search-accessed destination.

### 4.3 Reports
- [x] Redesign reports pages visually for consistency with the hub-first admin.
- [ ] Keep Reports as a secondary / search-accessed destination.

### 4.4 Logs
- [ ] Redesign logs pages visually for consistency with the hub-first admin.
- [ ] Keep Logs as a secondary / search-accessed destination.

### 4.5 Addons
- [ ] Redesign addon index and builder entry flows visually.
- [ ] Decide whether addon creation needs a calmer entry experience from the command palette or event workspace.

### 4.6 Settings
- [ ] Redesign settings / delivery configuration page visually.

### 4.7 Invitation Projects
- [ ] Redesign invitation project list/detail pages visually.
- [ ] Keep these as deeper power-user screens, not hub-primary navigation.

---

## 5. UX and Product Cleanup

### 5.1 Command palette
- [ ] Improve result grouping and prioritization.
- [ ] Improve keyboard navigation and selection behavior.
- [ ] Add stronger quick-action coverage for advanced destinations.
- [ ] Review permission-aware empty states and hidden-result behavior.

### 5.2 Navigation consistency
- [ ] Audit all deep pages for breadcrumb correctness.
- [ ] Audit all back-button behaviors.
- [ ] Ensure no stale links still assume `/dashboard` is the landing page.
- [ ] Ensure all template/library entry points feel consistent.

### 5.3 Copy and onboarding
- [ ] Review home hub card copy for clarity for brand-new users.
- [ ] Review page headings and descriptions across primary flows.
- [ ] Review English and Arabic wording consistency.

---

## 6. QA and Validation

### 6.1 Responsive QA
- [ ] Test hub and primary flows at 375px width.
- [ ] Test tablet breakpoints.
- [ ] Remove any horizontal overflow on redesigned pages.

### 6.2 RTL / Arabic QA
- [ ] Verify breadcrumb and back-button placement in RTL.
- [ ] Verify card layouts, tables, and forms in Arabic.
- [ ] Verify typography remains readable in Arabic after redesign styling changes.

### 6.3 Visual QA
- [ ] Compare implemented pages against `mockup_hub_desktop.jpg`.
- [ ] Compare implemented pages against `mockup_hub_mobile.jpg`.
- [ ] Compare implemented pages against `mockup_create_event.jpg`.
- [ ] Compare implemented pages against `mockup_guests.jpg`.
- [ ] Compare implemented pages against `mockup_send.jpg`.
- [ ] Compare implemented pages against `mockup_library.jpg`.
- [ ] Close spacing, hierarchy, and density gaps where needed.

### 6.4 Technical QA
- [ ] Smoke-test primary flows with real API data.
- [ ] Smoke-test deep legacy pages under the new shell.
- [ ] Review console errors in dev mode.
- [ ] Review bundle size warning from Vite build.

---

## 7. Recommended Next Order

- [x] Guests full redesign
- [x] Send Invitations polish
- [x] Library polish
- [ ] Create Event polish
- [ ] Event workspace restyle
- [ ] Reports / Logs / Clients / Settings restyle
- [ ] Final responsive + RTL + visual QA pass

---

## 8. Notes

- [x] The redesign is already structurally in place.
- [ ] The remaining work still includes deeper flow redesign.
- [ ] The remaining work still includes mockup parity.
- [ ] The remaining work still includes secondary-screen consistency.
- [ ] The remaining work still includes QA / polish.
- [ ] The next best implementation target is now `Create Event`, because Library has its polish pass.
