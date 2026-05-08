import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, CaseUpper, FileImage, Frame, Italic, List, Monitor, MoveDown, MoveUp, Save, Smartphone, Square, Trash2, Underline, ZoomIn, ZoomOut } from 'lucide-react';
import api from '../../services/api';
import './InstructionsBuilderPage.css';

const FONT_OPTIONS = ['Cairo', 'Tajawal', 'Noto Sans Arabic', 'IBM Plex Sans Arabic', 'Inter', 'Lora'];
const GRID_MIN = 4;
const GRID_MAX = 80;

const DEFAULT_SCHEMA = {
    version: 1,
    page: {
        width: 1080,
        height: 1600,
        responsive: true,
        background: {
            type: 'solid',
            color: '#ffffff',
            image: '',
            size: 'cover',
            repeat: 'no-repeat',
            position: 'center center',
            gradient: {
                from: '#ffffff',
                to: '#dbeafe',
                angle: 135
            }
        }
    },
    widgets: []
};

const DEFAULT_EDITOR_SETTINGS = {
    showGrid: true,
    snapToGrid: true,
    gridSize: 16,
    pageHeight: 1600,
    previewMode: 'desktop',
    activeLanguage: 'en'
};

function createId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `wid-${crypto.randomUUID()}`;
    }
    return `wid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function snap(value, grid, enabled) {
    if (!enabled) return value;
    return Math.round(value / grid) * grid;
}

function defaultWidget(type) {
    if (type === 'title') {
        return {
            id: createId(),
            type,
            x: 80,
            y: 80,
            w: 640,
            h: 90,
            z: 10,
            content: { text: 'Title', textAr: 'عنوان' },
            style: { fontFamily: 'Cairo', fontSize: 44, fontWeight: '700', textAlign: 'start', color: '#0f172a', direction: 'auto' }
        };
    }

    if (type === 'text') {
        return {
            id: createId(),
            type,
            x: 80,
            y: 200,
            w: 740,
            h: 180,
            z: 20,
            content: {
                text: 'Write your text here',
                textAr: 'اكتب النص هنا',
                bullets: ['First point', 'Second point'],
                bulletsAr: ['النقطة الأولى', 'النقطة الثانية'],
                asBullets: false
            },
            style: { fontFamily: 'Tajawal', fontSize: 26, fontWeight: '400', textAlign: 'start', color: '#1e293b', lineHeight: 1.45, direction: 'auto' }
        };
    }

    if (type === 'image') {
        return {
            id: createId(),
            type,
            x: 80,
            y: 420,
            w: 420,
            h: 240,
            z: 30,
            content: { src: '', alt: 'Image' },
            style: { lockRatio: true, objectFit: 'cover', borderRadius: 14 }
        };
    }

    if (type === 'item_block') {
        return {
            id: createId(),
            type,
            x: 80,
            y: 700,
            w: 760,
            h: 100,
            z: 40,
            content: { text: 'Item text', textAr: 'نص العنصر', icon: '•', iconImage: '', useIconImage: false },
            style: {
                fontFamily: 'Cairo',
                fontSize: 26,
                fontWeight: '500',
                textAlign: 'start',
                color: '#0f172a',
                blockMode: 'boxed',
                blockColor: '#e2e8f0',
                borderRadius: 10,
                iconColor: '#0f766e',
                iconSize: 26,
                direction: 'auto'
            }
        };
    }

    return { id: createId(), type, x: 60, y: 60, w: 300, h: 120, z: 50, content: {}, style: {} };
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

export default function InstructionsBuilderPage({ mode = 'create', initialData = null }) {
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const [clients, setClients] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);
    const [error, setError] = useState('');
    const [selectedWidgetId, setSelectedWidgetId] = useState(null);
    const [canvasZoom, setCanvasZoom] = useState(1);

    const [formData, setFormData] = useState(() => {
        const schema = initialData?.content_schema || DEFAULT_SCHEMA;
        const settings = initialData?.editor_settings || DEFAULT_EDITOR_SETTINGS;
        return {
            name: initialData?.name || '',
            nameAr: initialData?.name_ar || '',
            clientId: initialData?.client_id || '',
            status: initialData?.status || 'draft',
            contentSchema: {
                ...DEFAULT_SCHEMA,
                ...schema,
                page: {
                    ...DEFAULT_SCHEMA.page,
                    ...(schema.page || {}),
                    background: { ...DEFAULT_SCHEMA.page.background, ...(schema.page?.background || {}) }
                },
                widgets: Array.isArray(schema.widgets) ? schema.widgets : []
            },
            editorSettings: { ...DEFAULT_EDITOR_SETTINGS, ...settings, pageHeight: settings.pageHeight || schema?.page?.height || 1600 }
        };
    });

    useEffect(() => {
        fetchClients();
    }, []);

    async function fetchClients() {
        try {
            const response = await api.get('/admin/clients?pageSize=200&status=active');
            setClients(response.data.data || []);
        } catch (fetchError) {
            console.error('Failed to fetch clients:', fetchError);
        }
    }

    function updateField(key, value) {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }

    function updateEditorSettings(patch) {
        setFormData((prev) => ({ ...prev, editorSettings: { ...prev.editorSettings, ...patch } }));
    }

    function updatePage(patch) {
        setFormData((prev) => ({ ...prev, contentSchema: { ...prev.contentSchema, page: { ...prev.contentSchema.page, ...patch } } }));
    }

    function updatePageBackground(patch) {
        setFormData((prev) => ({
            ...prev,
            contentSchema: {
                ...prev.contentSchema,
                page: { ...prev.contentSchema.page, background: { ...prev.contentSchema.page.background, ...patch } }
            }
        }));
    }

    function updateWidgets(nextWidgets) {
        setFormData((prev) => ({ ...prev, contentSchema: { ...prev.contentSchema, widgets: nextWidgets } }));
    }

    function updateWidget(widgetId, patch) {
        updateWidgets((formData.contentSchema.widgets || []).map((item) => (
            item.id === widgetId
                ? { ...item, ...patch, content: { ...item.content, ...(patch.content || {}) }, style: { ...item.style, ...(patch.style || {}) } }
                : item
        )));
    }

    function addWidget(type) {
        if (type === 'background') {
            updatePageBackground({ color: '#f8fafc', image: '', size: 'cover', repeat: 'no-repeat', position: 'center center' });
            return;
        }
        const widget = defaultWidget(type);
        updateWidgets([...(formData.contentSchema.widgets || []), widget]);
        setSelectedWidgetId(widget.id);
    }

    function removeSelectedWidget() {
        if (!selectedWidgetId) return;
        updateWidgets((formData.contentSchema.widgets || []).filter((item) => item.id !== selectedWidgetId));
        setSelectedWidgetId(null);
    }

    function normalizeWidgetLayers(items) {
        const sorted = [...items].sort((a, b) => (a.z || 0) - (b.z || 0));
        return sorted.map((item, index) => ({ ...item, z: (index + 1) * 10 }));
    }

    function moveSelectedLayer(directionName) {
        if (!selectedWidgetId) return;
        const ordered = [...(formData.contentSchema.widgets || [])].sort((a, b) => (a.z || 0) - (b.z || 0));
        const index = ordered.findIndex((item) => item.id === selectedWidgetId);
        if (index < 0) return;
        const swapIndex = directionName === 'up' ? index + 1 : index - 1;
        if (swapIndex < 0 || swapIndex >= ordered.length) return;

        const copy = [...ordered];
        const temp = copy[index];
        copy[index] = copy[swapIndex];
        copy[swapIndex] = temp;
        updateWidgets(normalizeWidgetLayers(copy));
    }

    function beginWidgetDrag(event, widget, modeName) {
        event.preventDefault();
        event.stopPropagation();
        setSelectedWidgetId(widget.id);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const unscaledWidth = (previewMode === 'mobile' ? 420 : 1080);
        const startX = event.clientX;
        const startY = event.clientY;
        const start = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
        const grid = clamp(Number(formData.editorSettings.gridSize) || 16, GRID_MIN, GRID_MAX);
        const snapping = Boolean(formData.editorSettings.snapToGrid);
        const ratio = widget.h ? widget.w / widget.h : 1;

        function onMove(moveEvent) {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            if (modeName === 'move') {
                const normalizedDx = dx / (canvasZoom || 1);
                const normalizedDy = dy / (canvasZoom || 1);
                const nextX = clamp(snap(start.x + normalizedDx, grid, snapping), 0, unscaledWidth - widget.w);
                const nextY = clamp(snap(start.y + normalizedDy, grid, snapping), 0, (formData.editorSettings.pageHeight || 1600) - widget.h);
                updateWidget(widget.id, { x: nextX, y: nextY });
                return;
            }

            const normalizedDx = dx / (canvasZoom || 1);
            const normalizedDy = dy / (canvasZoom || 1);
            let nextW = clamp(snap(start.w + normalizedDx, grid, snapping), 80, unscaledWidth - widget.x);
            let nextH = clamp(snap(start.h + normalizedDy, grid, snapping), 50, (formData.editorSettings.pageHeight || 1600) - widget.y);
            if (widget.type === 'image' && widget.style?.lockRatio) {
                nextH = Math.max(50, Math.round(nextW / ratio));
            }
            updateWidget(widget.id, { w: nextW, h: nextH });
        }

        function onUp() {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    function beginPageResize(event) {
        event.preventDefault();
        const startY = event.clientY;
        const startHeight = Number(formData.editorSettings.pageHeight) || 1600;
        const grid = clamp(Number(formData.editorSettings.gridSize) || 16, GRID_MIN, GRID_MAX);

        function onMove(moveEvent) {
            const dy = moveEvent.clientY - startY;
            const nextHeight = clamp(snap(startHeight + dy, grid, true), 600, 6000);
            updateEditorSettings({ pageHeight: nextHeight });
            updatePage({ height: nextHeight });
        }

        function onUp() {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    async function onUploadWidgetImage(event, widgetId, modeName = 'src') {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await readFileAsDataUrl(file);
            if (modeName === 'iconImage') {
                updateWidget(widgetId, { content: { iconImage: dataUrl, useIconImage: true } });
            } else {
                updateWidget(widgetId, { content: { src: dataUrl } });
            }
        } catch (uploadError) {
            console.error(uploadError);
        }
    }

    async function onUploadBackgroundImage(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await readFileAsDataUrl(file);
            updatePageBackground({ image: dataUrl, type: 'image' });
        } catch (uploadError) {
            console.error(uploadError);
        }
    }

    async function handleSave() {
        const name = formData.name.trim();
        if (!name) {
            setError('Instruction name is required.');
            return;
        }
        if (!formData.clientId) {
            setError('Please select a client.');
            return;
        }

        setSaving(true);
        setError('');
        setSaveSuccessOpen(false);
        try {
            const payload = {
                name,
                nameAr: formData.nameAr,
                clientId: formData.clientId,
                status: formData.status,
                contentSchema: formData.contentSchema,
                editorSettings: formData.editorSettings
            };

            if (mode === 'edit' && initialData?.id) {
                await api.put(`/admin/instructions/${initialData.id}`, payload);
            } else {
                await api.post('/admin/instructions', payload);
            }
            setSaveSuccessOpen(true);
        } catch (saveError) {
            setError(saveError.response?.data?.message || 'Failed to save instruction.');
        } finally {
            setSaving(false);
        }
    }

    const widgets = formData.contentSchema.widgets || [];
    const selectedWidget = widgets.find((item) => item.id === selectedWidgetId) || null;
    const activeLanguage = formData.editorSettings.activeLanguage || 'en';
    const previewMode = formData.editorSettings.previewMode || 'desktop';
    const canvasHeight = formData.editorSettings.pageHeight || 1600;
    const canvasGrid = clamp(Number(formData.editorSettings.gridSize) || 16, GRID_MIN, GRID_MAX);
    const direction = activeLanguage === 'ar' ? 'rtl' : 'ltr';
    const canvasWidth = previewMode === 'mobile' ? 420 : 1080;

    function renderWidget(widget) {
        if (widget.type === 'title') {
            const text = activeLanguage === 'ar' ? (widget.content.textAr || widget.content.text) : (widget.content.text || widget.content.textAr);
            return (
                <div className="instruction-widget-content" style={{
                    fontFamily: widget.style.fontFamily,
                    fontSize: `${widget.style.fontSize}px`,
                    fontWeight: widget.style.fontWeight,
                    fontStyle: widget.style.italic ? 'italic' : 'normal',
                    textDecoration: widget.style.underline ? 'underline' : 'none',
                    textAlign: widget.style.textAlign,
                    color: widget.style.color,
                    direction
                }}>{text}</div>
            );
        }

        if (widget.type === 'text') {
            const text = activeLanguage === 'ar' ? (widget.content.textAr || widget.content.text) : (widget.content.text || widget.content.textAr);
            const bullets = activeLanguage === 'ar' ? (widget.content.bulletsAr || []) : (widget.content.bullets || []);
            return (
                <div className="instruction-widget-content" style={{
                    fontFamily: widget.style.fontFamily,
                    fontSize: `${widget.style.fontSize}px`,
                    fontWeight: widget.style.fontWeight,
                    fontStyle: widget.style.italic ? 'italic' : 'normal',
                    textDecoration: widget.style.underline ? 'underline' : 'none',
                    textAlign: widget.style.textAlign,
                    color: widget.style.color,
                    lineHeight: widget.style.lineHeight,
                    direction
                }}>
                    {widget.content.asBullets ? (
                        <ul className="instruction-widget-list">
                            {bullets.map((item, index) => <li key={`${widget.id}-bullet-${index}`}>{item}</li>)}
                        </ul>
                    ) : <p>{text}</p>}
                </div>
            );
        }

        if (widget.type === 'image') {
            return (
                <div className="instruction-widget-content image-widget-content">
                    {widget.content.src ? (
                        <img
                            src={widget.content.src}
                            alt={widget.content.alt || 'instruction image'}
                            style={{ width: '100%', height: '100%', objectFit: widget.style.objectFit || 'cover', borderRadius: `${widget.style.borderRadius || 0}px` }}
                        />
                    ) : <div className="widget-placeholder">Upload image</div>}
                </div>
            );
        }

        if (widget.type === 'item_block') {
            const text = activeLanguage === 'ar' ? (widget.content.textAr || widget.content.text) : (widget.content.text || widget.content.textAr);
            const dir = direction;
            const iconRight = dir === 'rtl';
            const showBox = widget.style.blockMode === 'boxed';
            return (
                <div className="instruction-widget-content item-block" style={{
                    background: showBox ? (widget.style.blockColor || '#e2e8f0') : 'transparent',
                    borderRadius: `${widget.style.borderRadius ?? 10}px`,
                    fontFamily: widget.style.fontFamily,
                    fontSize: `${widget.style.fontSize}px`,
                    fontWeight: widget.style.fontWeight,
                    fontStyle: widget.style.italic ? 'italic' : 'normal',
                    textDecoration: widget.style.underline ? 'underline' : 'none',
                    color: widget.style.color,
                    direction: dir,
                    flexDirection: 'row'
                }}>
                    <span
                        className="item-block-icon"
                        style={{
                            color: widget.style.iconColor,
                            fontSize: `${widget.style.iconSize || 24}px`,
                            order: iconRight ? 2 : 1
                        }}
                    >
                        {widget.content.useIconImage && widget.content.iconImage
                            ? <img src={widget.content.iconImage} alt="icon" className="item-block-icon-image" />
                            : (widget.content.icon || '•')}
                    </span>
                    <span
                        className="item-block-text"
                        style={{
                            order: iconRight ? 1 : 2,
                            alignItems:
                                widget.style.textVerticalAlign === 'top'
                                    ? 'flex-start'
                                    : widget.style.textVerticalAlign === 'bottom'
                                        ? 'flex-end'
                                        : 'center'
                        }}
                    >
                        {text}
                    </span>
                </div>
            );
        }

        return <div className="instruction-widget-content">Unsupported widget</div>;
    }

    return (
        <div className="instructions-builder-page">
            <div className="page-header instructions-builder-header">
                <div className="instructions-header-left">
                    <button type="button" className="back-link" onClick={() => navigate('/addons/instructions')}>
                        <ArrowLeft size={18} />
                        <span>Back</span>
                    </button>
                    <div className="instructions-top-fields">
                        <input type="text" value={formData.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Instruction name (required)" />
                        <select value={formData.clientId} onChange={(event) => updateField('clientId', event.target.value)}>
                            <option value="">Select client</option>
                            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                        </select>
                    </div>
                </div>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
            </div>

            {error && <div className="form-error">{error}</div>}
            <section className="instructions-editor-layout">
                <aside className="instructions-panel instructions-widgets-panel">
                    <h3>Widgets</h3>
                    <ul>
                        <li><button type="button" onClick={() => addWidget('title')}><CaseUpper size={16} /> <span>Title</span></button></li>
                        <li><button type="button" onClick={() => addWidget('text')}><List size={16} /> <span>Text</span></button></li>
                        <li><button type="button" onClick={() => addWidget('image')}><FileImage size={16} /> <span>Image</span></button></li>
                        <li><button type="button" onClick={() => addWidget('background')}><Frame size={16} /> <span>Background</span></button></li>
                        <li><button type="button" onClick={() => addWidget('item_block')}><Square size={16} /> <span>Item Block</span></button></li>
                    </ul>
                    <div className="lang-toggle">
                        <button type="button" className={activeLanguage === 'en' ? 'active' : ''} onClick={() => updateEditorSettings({ activeLanguage: 'en' })}>EN</button>
                        <button type="button" className={activeLanguage === 'ar' ? 'active' : ''} onClick={() => updateEditorSettings({ activeLanguage: 'ar' })}>AR</button>
                    </div>
                    <div className="preview-toggle">
                        <button type="button" className={previewMode === 'desktop' ? 'active' : ''} onClick={() => updateEditorSettings({ previewMode: 'desktop' })}>
                            <Monitor size={14} /> Desktop
                        </button>
                        <button type="button" className={previewMode === 'mobile' ? 'active' : ''} onClick={() => updateEditorSettings({ previewMode: 'mobile' })}>
                            <Smartphone size={14} /> Mobile
                        </button>
                    </div>
                    <div className="zoom-controls">
                        <button type="button" onClick={() => setCanvasZoom((prev) => clamp(Number((prev - 0.1).toFixed(2)), 0.4, 1.6))}><ZoomOut size={14} /></button>
                        <span>{Math.round(canvasZoom * 100)}%</span>
                        <button type="button" onClick={() => setCanvasZoom((prev) => clamp(Number((prev + 0.1).toFixed(2)), 0.4, 1.6))}><ZoomIn size={14} /></button>
                    </div>
                    <div className="panel-divider" />
                    <div className="page-tools-compact">
                        <h4>Canvas</h4>
                        <label className="switch-row"><span>Show Grid</span><input type="checkbox" checked={Boolean(formData.editorSettings.showGrid)} onChange={(event) => updateEditorSettings({ showGrid: event.target.checked })} /></label>
                        <label className="switch-row"><span>Snap</span><input type="checkbox" checked={Boolean(formData.editorSettings.snapToGrid)} onChange={(event) => updateEditorSettings({ snapToGrid: event.target.checked })} /></label>
                        <div className="compact-grid-2">
                            <label><span>Grid</span><input type="number" min={GRID_MIN} max={GRID_MAX} value={canvasGrid} onChange={(event) => updateEditorSettings({ gridSize: clamp(Number.parseInt(event.target.value, 10) || 16, GRID_MIN, GRID_MAX) })} /></label>
                            <label><span>Height</span><input type="number" min="600" max="6000" value={canvasHeight} onChange={(event) => { const nextHeight = clamp(Number.parseInt(event.target.value, 10) || 1600, 600, 6000); updateEditorSettings({ pageHeight: nextHeight }); updatePage({ height: nextHeight }); }} /></label>
                        </div>
                    </div>
                </aside>

                <div className="instructions-canvas-wrap">
                    <div
                        ref={canvasRef}
                        className="instructions-canvas"
                        onMouseDown={() => setSelectedWidgetId(null)}
                        style={{
                            width: `${canvasWidth}px`,
                            transform: `scale(${canvasZoom})`,
                            transformOrigin: 'top center',
                            minHeight: `${canvasHeight}px`,
                            height: `${canvasHeight}px`,
                            direction,
                            backgroundColor: formData.contentSchema.page.background.color,
                            backgroundImage: formData.contentSchema.page.background.type === 'gradient'
                                ? `linear-gradient(${formData.contentSchema.page.background.gradient?.angle ?? 135}deg, ${formData.contentSchema.page.background.gradient?.from || '#ffffff'}, ${formData.contentSchema.page.background.gradient?.to || '#dbeafe'})`
                                : formData.contentSchema.page.background.image
                                    ? `url(${formData.contentSchema.page.background.image})`
                                    : 'none',
                            backgroundSize: formData.contentSchema.page.background.image ? formData.contentSchema.page.background.size : 'auto',
                            backgroundRepeat: formData.contentSchema.page.background.repeat,
                            backgroundPosition: formData.contentSchema.page.background.position
                        }}
                    >
                        {formData.editorSettings.showGrid && (
                            <div
                                className="instructions-grid-overlay"
                                style={{ backgroundSize: `${canvasGrid}px ${canvasGrid}px` }}
                            />
                        )}
                        {widgets.length === 0 && (
                            <div className="canvas-empty">
                                <h4>Instruction Canvas</h4>
                                <p>Add widgets from the left panel.</p>
                            </div>
                        )}

                        {widgets.map((widget) => (
                            <div
                                key={widget.id}
                                className={`instruction-widget ${selectedWidgetId === widget.id ? 'selected' : ''}`}
                                style={{ left: `${widget.x}px`, top: `${widget.y}px`, width: `${widget.w}px`, height: `${widget.h}px`, zIndex: widget.z || 1 }}
                                onMouseDown={(event) => beginWidgetDrag(event, widget, 'move')}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedWidgetId(widget.id);
                                }}
                            >
                                {renderWidget(widget)}
                                {selectedWidgetId === widget.id && (
                                    <div className="widget-resize-handle" onMouseDown={(event) => beginWidgetDrag(event, widget, 'resize')} />
                                )}
                            </div>
                        ))}

                        <div className="canvas-resize-handle" onMouseDown={beginPageResize}>
                            <span>{canvasHeight}px</span>
                        </div>
                    </div>
                </div>

                <aside className="instructions-panel instructions-settings-panel">
                    <h3>Settings</h3>

                    {!selectedWidget && (
                        <>
                            <hr />
                            <h4>Background</h4>
                            <label>
                                <span>Type</span>
                                <select
                                    value={formData.contentSchema.page.background.type || 'solid'}
                                    onChange={(event) => updatePageBackground({ type: event.target.value })}
                                >
                                    <option value="solid">Solid</option>
                                    <option value="gradient">Gradient</option>
                                    <option value="image">Image</option>
                                </select>
                            </label>
                            <label><span>Color</span><input type="color" value={formData.contentSchema.page.background.color || '#ffffff'} onChange={(event) => updatePageBackground({ color: event.target.value })} /></label>
                            {(formData.contentSchema.page.background.type || 'solid') === 'gradient' && (
                                <>
                                    <label><span>Gradient From</span><input type="color" value={formData.contentSchema.page.background.gradient?.from || '#ffffff'} onChange={(event) => updatePageBackground({ gradient: { ...(formData.contentSchema.page.background.gradient || {}), from: event.target.value } })} /></label>
                                    <label><span>Gradient To</span><input type="color" value={formData.contentSchema.page.background.gradient?.to || '#dbeafe'} onChange={(event) => updatePageBackground({ gradient: { ...(formData.contentSchema.page.background.gradient || {}), to: event.target.value } })} /></label>
                                    <label><span>Gradient Angle</span><input type="number" min="0" max="360" value={formData.contentSchema.page.background.gradient?.angle ?? 135} onChange={(event) => updatePageBackground({ gradient: { ...(formData.contentSchema.page.background.gradient || {}), angle: Number.parseInt(event.target.value, 10) || 135 } })} /></label>
                                </>
                            )}
                            <label><span>Upload background</span><input type="file" accept="image/*" onChange={onUploadBackgroundImage} /></label>
                            <label>
                                <span>Size</span>
                                <select value={formData.contentSchema.page.background.size || 'cover'} onChange={(event) => updatePageBackground({ size: event.target.value })}>
                                    <option value="cover">cover</option>
                                    <option value="contain">fit/contain</option>
                                    <option value="auto">auto</option>
                                    <option value="100% 100%">stretch</option>
                                    <option value="64px 64px">tile</option>
                                </select>
                            </label>
                            <label>
                                <span>Repeat</span>
                                <select value={formData.contentSchema.page.background.repeat || 'no-repeat'} onChange={(event) => updatePageBackground({ repeat: event.target.value })}>
                                    <option value="no-repeat">no-repeat</option>
                                    <option value="repeat">repeat</option>
                                    <option value="repeat-x">repeat-x</option>
                                    <option value="repeat-y">repeat-y</option>
                                </select>
                            </label>
                            <label>
                                <span>Position</span>
                                <select value={formData.contentSchema.page.background.position || 'center center'} onChange={(event) => updatePageBackground({ position: event.target.value })}>
                                    <option value="center center">center</option>
                                    <option value="top center">top</option>
                                    <option value="bottom center">bottom</option>
                                    <option value="left center">left</option>
                                    <option value="right center">right</option>
                                </select>
                            </label>
                        </>
                    )}

                    {selectedWidget && (
                        <>
                            <hr />
                            <h4>Widget</h4>
                            <label><span>X</span><input type="number" value={selectedWidget.x} onChange={(e) => updateWidget(selectedWidget.id, { x: Number.parseInt(e.target.value, 10) || 0 })} /></label>
                            <label><span>Y</span><input type="number" value={selectedWidget.y} onChange={(e) => updateWidget(selectedWidget.id, { y: Number.parseInt(e.target.value, 10) || 0 })} /></label>
                            <label><span>Width</span><input type="number" value={selectedWidget.w} onChange={(e) => updateWidget(selectedWidget.id, { w: Math.max(80, Number.parseInt(e.target.value, 10) || 80) })} /></label>
                            <label><span>Height</span><input type="number" value={selectedWidget.h} onChange={(e) => updateWidget(selectedWidget.id, { h: Math.max(50, Number.parseInt(e.target.value, 10) || 50) })} /></label>

                            {(selectedWidget.type === 'title' || selectedWidget.type === 'text' || selectedWidget.type === 'item_block') && (
                                <>
                                    <label><span>Text (EN)</span><input type="text" value={selectedWidget.content.text || ''} onChange={(e) => updateWidget(selectedWidget.id, { content: { text: e.target.value } })} /></label>
                                    <label><span>Text (AR)</span><input type="text" value={selectedWidget.content.textAr || ''} onChange={(e) => updateWidget(selectedWidget.id, { content: { textAr: e.target.value } })} dir="rtl" /></label>

                                    <div className="typography-compact-card">
                                        <label>
                                            <span>Font Family</span>
                                            <select value={selectedWidget.style.fontFamily || 'Cairo'} onChange={(e) => updateWidget(selectedWidget.id, { style: { fontFamily: e.target.value } })}>
                                                {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
                                            </select>
                                        </label>

                                        <div className="typography-inline-row">
                                            <label>
                                                <span>Size</span>
                                                <input type="number" value={selectedWidget.style.fontSize || 24} onChange={(e) => updateWidget(selectedWidget.id, { style: { fontSize: Number.parseInt(e.target.value, 10) || 24 } })} />
                                            </label>
                                            <label>
                                                <span>Color</span>
                                                <input type="color" value={selectedWidget.style.color || '#0f172a'} onChange={(e) => updateWidget(selectedWidget.id, { style: { color: e.target.value } })} />
                                            </label>
                                            <div className="format-icon-group" aria-label="Text format">
                                                <button type="button" className={`icon-btn ${String(selectedWidget.style.fontWeight || '400') >= '600' ? 'active' : ''}`} onClick={() => updateWidget(selectedWidget.id, { style: { fontWeight: String(selectedWidget.style.fontWeight || '400') >= '600' ? '400' : '700' } })} title="Bold">
                                                    <Bold size={14} />
                                                </button>
                                                <button type="button" className={`icon-btn ${Boolean(selectedWidget.style.italic) ? 'active' : ''}`} onClick={() => updateWidget(selectedWidget.id, { style: { italic: !Boolean(selectedWidget.style.italic) } })} title="Italic">
                                                    <Italic size={14} />
                                                </button>
                                                <button type="button" className={`icon-btn ${Boolean(selectedWidget.style.underline) ? 'active' : ''}`} onClick={() => updateWidget(selectedWidget.id, { style: { underline: !Boolean(selectedWidget.style.underline) } })} title="Underline">
                                                    <Underline size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="align-icon-group" aria-label="Text align">
                                            <button type="button" className={`icon-btn ${selectedWidget.style.textAlign === 'start' || !selectedWidget.style.textAlign ? 'active' : ''}`} onClick={() => updateWidget(selectedWidget.id, { style: { textAlign: 'start' } })} title="Align start">
                                                <AlignLeft size={14} />
                                            </button>
                                            <button type="button" className={`icon-btn ${selectedWidget.style.textAlign === 'center' ? 'active' : ''}`} onClick={() => updateWidget(selectedWidget.id, { style: { textAlign: 'center' } })} title="Align center">
                                                <AlignCenter size={14} />
                                            </button>
                                            <button type="button" className={`icon-btn ${selectedWidget.style.textAlign === 'end' ? 'active' : ''}`} onClick={() => updateWidget(selectedWidget.id, { style: { textAlign: 'end' } })} title="Align end">
                                                <AlignRight size={14} />
                                            </button>
                                        </div>
                                    </div>

                                </>
                            )}

                            {selectedWidget.type === 'text' && (
                                <>
                                    <label><span>Line height</span><input type="number" step="0.05" min="1" max="2.4" value={selectedWidget.style.lineHeight || 1.45} onChange={(e) => updateWidget(selectedWidget.id, { style: { lineHeight: Number.parseFloat(e.target.value) || 1.45 } })} /></label>
                                    <label><span>Bullet list mode</span><input type="checkbox" checked={Boolean(selectedWidget.content.asBullets)} onChange={(e) => updateWidget(selectedWidget.id, { content: { asBullets: e.target.checked } })} /></label>
                                    <label><span>Bullets (EN)</span><textarea rows="4" value={Array.isArray(selectedWidget.content.bullets) ? selectedWidget.content.bullets.join('\n') : ''} onChange={(e) => updateWidget(selectedWidget.id, { content: { bullets: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } })} /></label>
                                    <label><span>Bullets (AR)</span><textarea rows="4" value={Array.isArray(selectedWidget.content.bulletsAr) ? selectedWidget.content.bulletsAr.join('\n') : ''} onChange={(e) => updateWidget(selectedWidget.id, { content: { bulletsAr: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } })} dir="rtl" /></label>
                                </>
                            )}

                            {selectedWidget.type === 'image' && (
                                <div className="compact-widget-card">
                                    <label><span>Upload</span><input type="file" accept="image/*" onChange={(e) => onUploadWidgetImage(e, selectedWidget.id, 'src')} /></label>
                                    <label><span>Image Source</span><input type="text" value={selectedWidget.content.src || ''} onChange={(e) => updateWidget(selectedWidget.id, { content: { src: e.target.value } })} /></label>
                                    <div className="compact-grid-2">
                                        <label><span>Fit</span><select value={selectedWidget.style.objectFit || 'cover'} onChange={(e) => updateWidget(selectedWidget.id, { style: { objectFit: e.target.value } })}><option value="cover">cover</option><option value="contain">contain</option><option value="fill">fill</option></select></label>
                                        <label className="switch-row"><span>Lock Ratio</span><input type="checkbox" checked={Boolean(selectedWidget.style.lockRatio)} onChange={(e) => updateWidget(selectedWidget.id, { style: { lockRatio: e.target.checked } })} /></label>
                                    </div>
                                </div>
                            )}

                            {selectedWidget.type === 'item_block' && (
                                <div className="compact-widget-card">
                                    <div className="compact-grid-2">
                                        <label><span>Icon</span><input type="text" value={selectedWidget.content.icon || '•'} onChange={(e) => updateWidget(selectedWidget.id, { content: { icon: e.target.value } })} /></label>
                                        <label><span>Mode</span><select value={selectedWidget.style.blockMode || 'boxed'} onChange={(e) => updateWidget(selectedWidget.id, { style: { blockMode: e.target.value } })}><option value="boxed">Boxed</option><option value="transparent">Transparent</option></select></label>
                                    </div>
                                    <label><span>Icon Image</span><input type="file" accept="image/*" onChange={(e) => onUploadWidgetImage(e, selectedWidget.id, 'iconImage')} /></label>
                                    <label className="switch-row"><span>Use Icon Image</span><input type="checkbox" checked={Boolean(selectedWidget.content.useIconImage)} onChange={(e) => updateWidget(selectedWidget.id, { content: { useIconImage: e.target.checked } })} /></label>
                                    <div className="compact-grid-2">
                                        <label><span>Block</span><input type="color" value={selectedWidget.style.blockColor || '#e2e8f0'} onChange={(e) => updateWidget(selectedWidget.id, { style: { blockColor: e.target.value } })} /></label>
                                        <label><span>Icon</span><input type="color" value={selectedWidget.style.iconColor || '#0f766e'} onChange={(e) => updateWidget(selectedWidget.id, { style: { iconColor: e.target.value } })} /></label>
                                    </div>
                                    <label><span>Corners</span><input type="number" min="0" max="80" value={selectedWidget.style.borderRadius ?? 10} onChange={(e) => updateWidget(selectedWidget.id, { style: { borderRadius: Number.parseInt(e.target.value, 10) || 0 } })} /></label>
                                    <label><span>Text Vertical Align</span><select value={selectedWidget.style.textVerticalAlign || 'center'} onChange={(e) => updateWidget(selectedWidget.id, { style: { textVerticalAlign: e.target.value } })}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>
                                    </div>
                            )}

                            <div className="layer-controls">
                                <button type="button" className="btn btn-secondary" onClick={() => moveSelectedLayer('down')}>
                                    <MoveDown size={14} />
                                    <span>Send Backward</span>
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={() => moveSelectedLayer('up')}>
                                    <MoveUp size={14} />
                                    <span>Bring Forward</span>
                                </button>
                            </div>

                            <button type="button" className="btn btn-danger btn-delete-widget" onClick={removeSelectedWidget}>
                                <Trash2 size={14} />
                                <span>Delete Widget</span>
                            </button>
                        </>
                    )}
                </aside>
            </section>

            {saveSuccessOpen && (
                <div className="save-modal-backdrop" role="dialog" aria-modal="true">
                    <div className="save-modal-card">
                        <h4>Saved</h4>
                        <p>Instruction design progress saved successfully.</p>
                        <button type="button" className="btn btn-primary" onClick={() => setSaveSuccessOpen(false)}>OK</button>
                    </div>
                </div>
            )}
        </div>
    );
}
