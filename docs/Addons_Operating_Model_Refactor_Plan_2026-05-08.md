# Add-ons Operating Model Refactor Plan

- Date: 2026-05-08
- Project: YaHala Admin Event Dashboard
- Owner: Engineering + Product
- Status: In Progress
- Objective: Make Add-ons the single source of truth and remove duplicate/conflicting event-tab flows.

## 1) Problem Summary

- Event dashboard currently has overlapping surfaces:
  - Top tabs: `Add-ons`, `Polls`, `Submissions`, `Memory Book`
  - Invitation Setup also includes add-on controls/checklist.
- This creates duplicated ownership and conflicting logic.
- Operators cannot clearly understand:
  - where to enable an add-on
  - where to configure an add-on
  - what defines invitation card tabs

## 2) Target UX Model

1. `Add-ons` is the only control center for enabling/configuring add-ons.
2. Remove top-level event tabs:
   - `Polls`
   - `Submissions`
   - `Memory Book`
3. Add-ons page inside event dashboard becomes split layout:
   - left: add-on catalog + checkboxes/toggles
   - right: active add-on workspace/content
4. Invitation Setup becomes invitation-focused only:
   - template assignment
   - card-tab ordering/preview and final validation
   - no duplicate add-on ownership

## 3) Card Tabs vs Add-on Content Contract

- `Card tabs`:
  - tabs visible to invitee on public invitation card
  - stored in `event.settings.invitation_setup.tabs`
- `Add-on content`:
  - actual objects/resources linked to the event (polls/questionnaires/etc.)
  - enabled add-ons stored in `event.settings.addIns`
- Rule:
  - only enabled add-ons may produce card tabs
  - disabling add-on removes/hides its card tabs

## 4) Phases

## Phase 1 - Remove Top-Level Duplication
- Goal: Remove `Polls`, `Submissions`, `Memory Book` from event top tabs.
- Scope:
  - update `EventDashboardPage` tab nav and tab content rendering
  - keep functionality discoverable under Add-ons (next phases)
- Acceptance:
  - event dashboard top tabs no longer include duplicated addon-specific tabs
- Status: `done`
- Tracking:
  - [x] Remove tab buttons from event dashboard
  - [x] Remove corresponding tab render blocks
  - [x] Build passes

## Phase 2 - Add-ons Control Center Layout
- Goal: Rebuild event `Add-ons` tab into left-menu + right-content workspace.
- Status: `done`
- Tracking:
  - [x] Add side menu with add-on checkboxes/toggles
  - [x] Add right-panel content containers
  - [x] Preserve multilingual labels and clear helper text

## Phase 3 - State & Persistence Unification
- Goal: Add-ons tab becomes source-of-truth for enabling and linking.
- Status: `done`
- Tracking:
  - [x] Move add-on enable logic fully into Add-ons tab
  - [x] Persist `settings.addIns` and tab mappings coherently
  - [x] Enforce backend pruning for disabled add-on tabs

## Phase 4 - Invitation Setup Simplification
- Goal: Remove duplicate add-on controls from Invitation Setup.
- Status: `pending`
- Tracking:
  - [ ] Remove add-ons section from Invitation Setup
  - [ ] Remove or replace checklist with live computed status
  - [ ] Keep template and card-tab-specific controls only

## Phase 5 - Multi-Instance Add-on Experience
- Goal: Support multiple resources per add-on type from Add-ons workspace.
- Status: `pending`
- Tracking:
  - [ ] Poll: select/create multiple polls
  - [ ] Questionnaire: select/create multiple questionnaires (if allowed by business rules)
  - [ ] Explicit linking UX to card tabs

## Phase 6 - QA and Release
- Goal: Validate end-to-end flows and finalize rollout.
- Status: `pending`
- Tracking:
  - [ ] E2E smoke: client -> event -> add-ons -> setup -> send -> observe
  - [ ] Regression: public card tab rendering and submission integrity
  - [ ] Docs update in refactor plans and runbook notes

## 5) Execution Log

- 2026-05-08: Plan created.
- 2026-05-08: Phase 1 completed (top-level duplicated tabs removed from Event Dashboard).
- 2026-05-08: Phase 2 completed (event Add-ons tab converted to left-menu control center with multi-select content linking and save flow).
- 2026-05-08: Phase 3 completed (deduplicated add-on/tab persistence, deterministic sort ordering, and post-save reload to prevent stale UI state).
