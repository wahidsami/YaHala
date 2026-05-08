# Instructions Addon Implementation Plan (2026-05-08)

## Scope
Build Instructions addon as a reusable addon with:
- Dedicated list page (search, filters, pagination, add new)
- Dedicated editor page (back, name, client, save)
- Widget-canvas architecture to be reused by upcoming addons
- Event binding support so saved instructions can be attached to invitation cards

## Functional Requirements
1. Main Instructions page
- Table with search, filters, pagination
- Top `Add New` button
- Headers: multi-select checkbox, instruction name, client, created, actions (view/edit/delete)

2. Add new/edit page
- Back button
- Instruction name input (required, cannot save empty)
- Client dropdown
- Save button
- Editor below

3. Editor layout (shared foundation)
- Left panel: widgets
- Middle panel: canvas/work area (template-canvas style)
- Right panel: selected widget settings
- Resizable page height with bottom handle
- Responsive HTML5 output
- Grid controls: show grid, snap to grid, grid size

4. Widgets (Instructions V1)
- Title widget: font type, alignment, text formatting
- Text widget: font type, alignment, text formatting + bullets
- Image widget: upload, resize, lock ratio
- Background widget: CSS background controls (tile/fit/cover/repeat/position), no effects
- Item block widget: icon/image + text, transparent/boxed mode, full style controls, RTL/LTR icon position behavior

5. Event usage
- Saved instruction records can be selected/bound in event add-ons setup
- Bound instruction appears as invitation tab/page

## Architecture Decision
Use a single relational record per instruction with JSONB payload for editor schema:
- `instructions.content_schema` for canvas/widgets
- `instructions.editor_settings` for grid/page behavior

This is faster to evolve and can be reused for other addon editors.

## Database Migration
Create `apps/api/src/db/migrations/020_instructions_addon.sql`:

```sql
CREATE TABLE IF NOT EXISTS instructions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(180) NOT NULL,
    name_ar VARCHAR(180),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    content_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    editor_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES dashboard_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_instructions_client
    ON instructions(client_id);

CREATE INDEX IF NOT EXISTS idx_instructions_status
    ON instructions(status);

CREATE INDEX IF NOT EXISTS idx_instructions_created_at
    ON instructions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_instructions_name_lower
    ON instructions((LOWER(name)));
```

## VPS Commands
From project root on VPS:

```bash
cd /path/to/YaHala
git pull origin main
npm run migrate --workspace=apps/api
psql "$DATABASE_URL" -c "select to_regclass('public.instructions');"
psql "$DATABASE_URL" -c "\\d+ instructions"
```

## API Endpoints (to implement)
- `GET /api/admin/instructions`
- `GET /api/admin/instructions/:id`
- `POST /api/admin/instructions`
- `PUT /api/admin/instructions/:id`
- `DELETE /api/admin/instructions/:id`

Validation:
- `name` required on create/update save
- `clientId` required on create

## UI Implementation Order
1. DB + API CRUD
2. Addons list route for `instructions` wired to API
3. Instructions editor page shell with required name/client/save
4. Canvas/editor framework + widgets
5. Event binding with real instruction records
6. Public renderer from saved schema

## Notes
- Keep backward compatibility with current event instructions payload until binding migration is complete.
- Commit and push after each completed slice.
