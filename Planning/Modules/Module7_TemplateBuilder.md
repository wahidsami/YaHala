# Module 7: Template Builder

## Phase 4 Implementation – Core Feature Design

---

## 1. Module Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | Visual drag-and-drop invitation template designer |
| **Route** | `/templates/:id/edit` |
| **Access** | `templates.edit` permission (Super Admin only) |
| **Criticality** | **HIGHEST** – Core feature of the platform |

---

## 2. Builder Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOOLBAR                                                                    │
│  Template: Royal Wedding Gold  │ [AR│EN] │ [📱│💻] │ [Preview ▼] │ [💾 Save]│
├──────────────┬──────────────────────────────────────┬───────────────────────┤
│              │                                      │                       │
│  WIDGET      │           CANVAS                     │   PROPERTIES          │
│  PALETTE     │                                      │   PANEL               │
│              │  ┌────────────────────────────────┐  │                       │
│  ┌────────┐  │  │        HEADER SECTION          │  │  Selected:            │
│  │📝 Text │  │  │  ┌──────────────────────────┐  │  │  Guest Name Block     │
│  └────────┘  │  │  │   Guest Name Block       │  │  │  ─────────────────    │
│  ┌────────┐  │  │  └──────────────────────────┘  │  │                       │
│  │🖼️ Image│  │  └────────────────────────────────┘  │  Content              │
│  └────────┘  │                                      │  [Tab: AR] [Tab: EN]  │
│  ┌────────┐  │  ┌────────────────────────────────┐  │                       │
│  │📅 Event│  │  │         BODY SECTION           │  │  Greeting:            │
│  └────────┘  │  │  ┌──────────────────────────┐  │  │  [Dear {guest.name}]  │
│  ┌────────┐  │  │  │   Event Details Block    │  │  │                       │
│  │📱 QR   │  │  │  └──────────────────────────┘  │  │  Style                │
│  └────────┘  │  │  ┌──────────────────────────┐  │  │  Font Size: [24px ▼]  │
│  ┌────────┐  │  │  │   QR Code Block          │  │  │  Alignment: [Center▼ ]│
│  │🎙️ Voice│  │  │  └──────────────────────────┘  │  │                       │
│  └────────┘  │  └────────────────────────────────┘  │  Rules                │
│  ┌────────┐  │                                      │  [+ Add Rule]         │
│  │📋 Survey│ │  ┌────────────────────────────────┐  │                       │
│  └────────┘  │  │        FOOTER SECTION          │  │                       │
│  ┌────────┐  │  │  ┌──────────────────────────┐  │  │                       │
│  │💬 Text │  │  │  │   Voice Recorder  [👁️]   │  │  │                       │
│  │  Submit│  │  │  └──────────────────────────┘  │  │                       │
│  └────────┘  │  └────────────────────────────────┘  │                       │
│              │                                      │                       │
└──────────────┴──────────────────────────────────────┴───────────────────────┘
```

---

## 3. Widget Instance Model

### 3.1 Widget Instance Structure

```
WidgetInstance {
  id: string                    // Unique ID (uuid)
  type: WidgetType              // 'text_block', 'qr_code', etc.
  sectionId: string             // 'header' | 'body' | 'footer'
  order: number                 // Position within section
  
  content: {
    ar: ContentData             // Arabic content
    en: ContentData             // English content
  }
  
  bindings: {
    [key: string]: string       // e.g., { text: 'guest.name' }
  }
  
  style: {
    fontSize?: string
    textAlign?: 'start' | 'center' | 'end'
    color?: string
    padding?: string
    // ... other style overrides
  }
  
  config: {
    // Widget-specific configuration
    maxDuration?: number        // For voice recorder
    questions?: Question[]      // For questionnaire
    actionType?: string         // For button
  }
  
  rules: Rule[]                 // Visibility rules
}
```

### 3.2 Widget Types Enum

```
WidgetType =
  | 'text_block'
  | 'image_block'
  | 'guest_name_block'
  | 'event_details_block'
  | 'qr_code_block'
  | 'button_block'
  | 'voice_recorder'
  | 'text_submission'
  | 'questionnaire'
  | 'divider'
```

### 3.3 Content Structure by Widget Type

```
text_block:
  content.ar/en = { text: string }

image_block:
  content.ar/en = { imageUrl: string, alt: string }

guest_name_block:
  content.ar/en = { greeting: string }  // "Dear {guest.name}"
  bindings = { name: 'guest.name_ar' | 'guest.name_en' }

event_details_block:
  content.ar/en = { label: string }
  bindings = { 
    name: 'event.name',
    date: 'event.start_datetime',
    venue: 'event.venue'
  }

qr_code_block:
  content.ar/en = { label: string }  // "Show this at entrance"
  bindings = { qr: 'qr_token.image_url' }

voice_recorder:
  content.ar/en = { 
    buttonLabel: string,          // "Record Message"
    instructions: string          // "Up to 60 seconds"
  }
  config = { maxDuration: 60 }

text_submission:
  content.ar/en = {
    placeholder: string,
    buttonLabel: string
  }
  config = { maxLength: 500 }

questionnaire:
  content.ar/en = { title: string }
  config = { 
    questions: [
      { id, type: 'text'|'choice'|'rating', question_ar, question_en }
    ] 
  }
```

---

## 4. Canvas Sections

### 4.1 Section Model

```
Section {
  id: 'header' | 'body' | 'footer'
  label: string                    // Display name
  widgets: WidgetInstance[]        // Ordered list
  minWidgets: number               // 0 for optional
  maxWidgets: number               // -1 for unlimited
}
```

### 4.2 Section Behavior

| Section | Purpose | Constraints |
|---------|---------|-------------|
| **Header** | Branding, decoration | 0-3 widgets |
| **Body** | Core content | 1+ widgets (required) |
| **Footer** | Post-event, actions | 0-5 widgets |

### 4.3 Canvas State

```
CanvasState {
  sections: {
    header: Section
    body: Section
    footer: Section
  }
  selectedWidgetId: string | null
  draggedWidgetType: WidgetType | null
  isDirty: boolean                 // Has unsaved changes
}
```

---

## 5. Drag & Drop System

### 5.1 Drag Sources

| Source | Payload | Behavior |
|--------|---------|----------|
| **Palette Widget** | `{ type: WidgetType }` | Creates new instance |
| **Canvas Widget** | `{ id: string }` | Moves existing widget |

### 5.2 Drop Targets

| Target | Accepts | Action |
|--------|---------|--------|
| **Section** | Palette widget | Insert at end |
| **Between Widgets** | Both | Insert at position |
| **On Widget** | Canvas widget | Swap positions |

### 5.3 Drag & Drop Flow

```
User drags from Palette
       ↓
onDragStart({ type: 'text_block' })
       ↓
Visual: ghost element + drop indicators
       ↓
onDragOver(sectionId, insertIndex)
       ↓
Visual: highlight drop zone
       ↓
onDrop()
       ↓
Create WidgetInstance:
  id = generateUUID()
  type = draggedType
  sectionId = targetSection
  order = insertIndex
  content = defaultContent[type]
       ↓
Add to sections[sectionId].widgets
       ↓
Select new widget (open properties)
```

### 5.4 Reorder Flow

```
User drags existing widget
       ↓
onDragStart({ id: 'widget-123' })
       ↓
onDrop(newSectionId, newIndex)
       ↓
Remove from old position
Insert at new position
Update order values
       ↓
Canvas re-renders
```

---

## 6. Widget Properties Panel

### 6.1 Panel Structure

```
<PropertiesPanel>
├── <PanelHeader>
│   ├── Widget icon + type label
│   └── [🗑️ Delete] button
│
├── <ContentTab>
│   ├── <LanguageTabs> [AR] [EN]
│   └── <ContentFields />  ← Based on widget type
│
├── <StyleTab>
│   ├── Font size
│   ├── Text alignment
│   ├── Color picker
│   └── Spacing controls
│
└── <RulesTab>
    ├── <RulesList />
    └── [+ Add Rule]
```

### 6.2 Language-Aware Content Editing

```
┌─────────────────────────────────────────┐
│  Content                                │
│  ───────                                │
│  [🇸🇦 AR]  [🇺🇸 EN]  ← Active tab highlighted │
├─────────────────────────────────────────┤
│                                         │
│  When AR tab active:                    │
│  ┌─────────────────────────────────────┐│
│  │  Greeting                           ││
│  │  [عزيزي {guest.name}             ]  ││
│  │                                     ││
│  │  Available variables:               ││
│  │  {guest.name} {event.name}          ││
│  └─────────────────────────────────────┘│
│                                         │
│  When EN tab active:                    │
│  ┌─────────────────────────────────────┐│
│  │  Greeting                           ││
│  │  [Dear {guest.name}              ]  ││
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

### 6.3 Variable Insertion

```
User clicks inside text input
       ↓
Show variable dropdown or chip buttons:
  [{guest.name}] [{event.name}] [{event.date}]
       ↓
User clicks variable
       ↓
Insert at cursor position
       ↓
Display as styled chip in input
```

---

## 7. Template Serialization (JSON Shape)

### 7.1 Complete Template JSON

```
{
  "id": "tpl_abc123",
  "name": "Royal Wedding Gold",
  "nameAr": "دعوة ملكية ذهبية",
  "category": "wedding",
  "eventTypes": ["wedding"],
  "languages": ["ar", "en"],
  "version": 1,
  "status": "published",
  
  "metadata": {
    "createdAt": "2026-01-18T10:00:00Z",
    "updatedAt": "2026-01-18T15:30:00Z",
    "createdBy": "usr_admin1"
  },
  
  "layout": {
    "direction": "auto",
    "background": {
      "type": "image",
      "value": "/templates/royal-gold/bg.jpg"
    }
  },
  
  "styles": {
    "primaryColor": "#D4AF37",
    "fontFamily": {
      "ar": "Noto Sans Arabic",
      "en": "Playfair Display"
    },
    "baseFontSize": "16px"
  },
  
  "sections": {
    "header": {
      "widgets": [
        {
          "id": "w_001",
          "type": "image_block",
          "order": 0,
          "content": {
            "ar": { "imageUrl": "/templates/royal-gold/header.png", "alt": "زينة" },
            "en": { "imageUrl": "/templates/royal-gold/header.png", "alt": "Decoration" }
          },
          "style": {},
          "rules": []
        }
      ]
    },
    
    "body": {
      "widgets": [
        {
          "id": "w_002",
          "type": "guest_name_block",
          "order": 0,
          "content": {
            "ar": { "greeting": "عزيزي {guest.name}" },
            "en": { "greeting": "Dear {guest.name}" }
          },
          "bindings": {
            "guest.name": "guest.name_ar|guest.name_en"
          },
          "style": {
            "fontSize": "28px",
            "textAlign": "center"
          },
          "rules": []
        },
        {
          "id": "w_003",
          "type": "event_details_block",
          "order": 1,
          "content": {
            "ar": { "label": "يسعدنا دعوتكم لحضور" },
            "en": { "label": "You are cordially invited to" }
          },
          "bindings": {
            "event.name": "event.name_ar|event.name_en",
            "event.date": "event.start_datetime",
            "event.venue": "event.venue_ar|event.venue_en"
          },
          "style": {},
          "rules": []
        },
        {
          "id": "w_004",
          "type": "qr_code_block",
          "order": 2,
          "content": {
            "ar": { "label": "أظهر هذا الرمز عند الدخول" },
            "en": { "label": "Show this code at entrance" }
          },
          "bindings": {
            "qr": "qr_token.image_url"
          },
          "style": {},
          "rules": [
            {
              "id": "r_001",
              "action": "hide",
              "conditions": [
                { "type": "scan", "operator": "equals", "value": "checked_in" }
              ]
            }
          ]
        }
      ]
    },
    
    "footer": {
      "widgets": [
        {
          "id": "w_005",
          "type": "voice_recorder",
          "order": 0,
          "content": {
            "ar": { 
              "buttonLabel": "سجل تهنئتك",
              "instructions": "حتى 60 ثانية"
            },
            "en": { 
              "buttonLabel": "Record Your Message",
              "instructions": "Up to 60 seconds"
            }
          },
          "config": {
            "maxDuration": 60,
            "allowEdit": true
          },
          "style": {},
          "rules": [
            {
              "id": "r_002",
              "action": "show",
              "conditions": [
                { "type": "time", "operator": "after", "value": "event.end_datetime" }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

---

## 8. Canvas Rendering Logic

### 8.1 Render Flow

```
Template JSON loaded
       ↓
Parse sections.header, sections.body, sections.footer
       ↓
FOR each section:
  Render <Section>
    FOR each widget in section.widgets (sorted by order):
      Render <WidgetRenderer type={widget.type} instance={widget} />
       ↓
<WidgetRenderer> dispatches to specific component:
  text_block → <TextBlockWidget />
  image_block → <ImageBlockWidget />
  qr_code_block → <QRCodeWidget />
  ... etc
```

### 8.2 Widget Renderer Component

```
<WidgetRenderer>
├── Props:
│   instance: WidgetInstance
│   isSelected: boolean
│   onSelect: () => void
│   onUpdate: (changes) => void
│   language: 'ar' | 'en'
│
├── Renders:
│   <WidgetWrapper>
│     ├── Selection border (if selected)
│     ├── Drag handle
│     ├── Widget content (type-specific)
│     └── Visibility indicator (if has rules)
│   </WidgetWrapper>
│
└── Behavior:
    - Click → select
    - Double-click → quick edit
    - Drag → reorder
```

### 8.3 Placeholder Substitution (Preview)

```
Content: "Dear {guest.name}"
       ↓
Parse placeholders: ['{guest.name}']
       ↓
In BUILDER mode:
  Show as chip: "Dear [guest.name]"
       ↓
In PREVIEW mode:
  Substitute with mock data: "Dear Ahmed Al-Rashid"
```

---

## 9. Builder State Management

### 9.1 BuilderContext

```
BuilderContext {
  // Template Data
  template: Template
  
  // UI State
  selectedWidgetId: string | null
  activeLanguage: 'ar' | 'en'
  previewDevice: 'mobile' | 'desktop'
  isDirty: boolean
  isSaving: boolean
  
  // Actions
  selectWidget(id): void
  updateWidget(id, changes): void
  addWidget(type, sectionId, index): void
  removeWidget(id): void
  moveWidget(id, sectionId, index): void
  duplicateWidget(id): void
  
  setLanguage(lang): void
  setDevice(device): void
  
  save(): Promise<void>
  publish(): Promise<void>
  
  // Undo/Redo
  undo(): void
  redo(): void
  canUndo: boolean
  canRedo: boolean
}
```

### 9.2 History (Undo/Redo)

```
History Stack:
  past: TemplateState[]     // Previous states
  present: TemplateState    // Current state
  future: TemplateState[]   // Redo states

On change:
  push(present) to past
  set new state as present
  clear future

On undo:
  push(present) to future
  pop(past) as present

On redo:
  push(present) to past
  pop(future) as present
```

---

## 10. Default Widget Content

```
When widget is dropped, initialize with defaults:

DEFAULTS = {
  text_block: {
    ar: { text: 'نص جديد' },
    en: { text: 'New text' }
  },
  
  guest_name_block: {
    ar: { greeting: 'عزيزي {guest.name}' },
    en: { greeting: 'Dear {guest.name}' }
  },
  
  event_details_block: {
    ar: { label: 'يسعدنا دعوتكم' },
    en: { label: 'You are invited to' }
  },
  
  qr_code_block: {
    ar: { label: 'رمز الدخول' },
    en: { label: 'Entry Code' }
  },
  
  voice_recorder: {
    ar: { buttonLabel: 'سجل رسالتك', instructions: 'حتى 60 ثانية' },
    en: { buttonLabel: 'Record Message', instructions: 'Up to 60 seconds' }
  },
  
  // ... etc
}
```

---

## 11. File Structure

```
src/features/templates/
├── components/
│   ├── TemplateBuilder/
│   │   ├── TemplateBuilder.jsx
│   │   ├── TemplateBuilder.module.css
│   │   ├── BuilderToolbar.jsx
│   │   ├── BuilderContext.jsx
│   │   └── index.js
│   │
│   ├── WidgetPalette/
│   │   ├── WidgetPalette.jsx
│   │   ├── PaletteItem.jsx
│   │   └── widgetDefinitions.js
│   │
│   ├── Canvas/
│   │   ├── Canvas.jsx
│   │   ├── Section.jsx
│   │   ├── WidgetWrapper.jsx
│   │   ├── DropIndicator.jsx
│   │   └── widgets/
│   │       ├── TextBlockWidget.jsx
│   │       ├── ImageBlockWidget.jsx
│   │       ├── GuestNameWidget.jsx
│   │       ├── EventDetailsWidget.jsx
│   │       ├── QRCodeWidget.jsx
│   │       ├── VoiceRecorderWidget.jsx
│   │       ├── TextSubmissionWidget.jsx
│   │       ├── QuestionnaireWidget.jsx
│   │       └── DividerWidget.jsx
│   │
│   └── PropertiesPanel/
│       ├── PropertiesPanel.jsx
│       ├── ContentEditor.jsx
│       ├── StyleEditor.jsx
│       ├── RulesEditor.jsx
│       ├── LanguageTabs.jsx
│       └── VariableInserter.jsx
│
├── hooks/
│   ├── useBuilder.js
│   ├── useWidgets.js
│   └── useHistory.js
│
└── utils/
    ├── widgetDefaults.js
    ├── templateSerializer.js
    └── placeholderParser.js
```

---

## 12. Definition of Done

| Criteria | Status |
|----------|--------|
| Drag from palette creates widget | ⬜ |
| Drag on canvas reorders widgets | ⬜ |
| Widget selection shows properties | ⬜ |
| AR/EN content editing works | ⬜ |
| Variable insertion works | ⬜ |
| Style changes apply to widget | ⬜ |
| Undo/Redo works | ⬜ |
| Save persists to API | ⬜ |
| Template JSON matches schema | ⬜ |
| RTL layout correct | ⬜ |

---

*Module Version: 1.0*  
*Created: 2026-01-18*
