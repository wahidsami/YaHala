import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Save, Eye, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import WidgetPalette from './components/WidgetPalette';
import BuilderCanvas from './components/BuilderCanvas';
import PropertiesPanel from './components/PropertiesPanel';
import { createDefaultWidget, WIDGET_TYPES } from './widgetConfig';
import { normalizeLayout } from './backgroundUtils';
import './TemplateBuilderPage.css';
function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

const DEFAULT_TEMPLATE = {
    layout: {
        direction: 'rtl',
        backgroundType: 'solid',
        backgroundColor: '#ffffff',
        backgroundImage: '',
        backgroundSize: 'cover',
        backgroundGradient: {
            type: 'linear',
            angle: 135,
            from: '#ffffff',
            to: '#dbeafe',
            middle: ''
        },
        backgroundEffects: []
    },
    styles: { primaryColor: '#22c55e', fontFamily: 'Noto Sans Arabic', baseFontSize: 16 },
    // We now use 'body' as the main absolute canvas
    sections: {
        body: { widgets: [] }
    }
};

export default function TemplateBuilderPage() {
    const { i18n } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const [template, setTemplate] = useState(null);
    const [designData, setDesignData] = useState(DEFAULT_TEMPLATE);
    const [selectedWidget, setSelectedWidget] = useState(null);
    const [activeLanguage, setActiveLanguage] = useState('ar');
    const [isSaving, setIsSaving] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const [templateName, setTemplateName] = useState('');
    const [templateHash, setTemplateHash] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    useEffect(() => {
        if (id && id !== 'new') {
            fetchTemplate();
            return;
        }

        setTemplate(null);
        setDesignData(DEFAULT_TEMPLATE);
        setSelectedWidget(null);
        setTemplateName('');
        setTemplateHash('');
    }, [id]);

    async function fetchTemplate() {
        try {
            const response = await api.get(`/admin/templates/${id}`);
            setTemplate(response.data.data);
            setDesignData({
                ...DEFAULT_TEMPLATE,
                ...response.data.data.design_data,
                layout: {
                    ...DEFAULT_TEMPLATE.layout,
                    ...normalizeLayout(response.data.data.design_data?.layout)
                }
            });
            setTemplateName(response.data.data.name);
            setTemplateHash(response.data.data.design_data_hash || '');
        } catch (error) {
            console.error('Failed to fetch template:', error);
        }
    }

    function handleDragStart(event) {
        setActiveId(event.active.id);
    }

    function handleDragEnd(event) {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        // If dragging from palette (adding new widget)
        if (active.data.current?.fromPalette) {
            const widgetType = active.data.current.widgetType;
            const targetSection = over.data.current?.sectionId || 'body';

            const newWidget = createDefaultWidget(widgetType);

            // Calculate drop position
            let initialGeometry = { x: 20, y: 20, w: 280, h: 80 }; // Fallback

            const canvasEl = document.querySelector('.canvas-device');
            if (canvasEl && active.rect.current?.translated) {
                const canvasRect = canvasEl.getBoundingClientRect();
                const dropRect = active.rect.current.translated;

                // Calculate relative position
                let relativeX = dropRect.left - canvasRect.left;
                let relativeY = dropRect.top - canvasRect.top;

                // Snap to grid (10px)
                relativeX = Math.round(relativeX / 10) * 10;
                relativeY = Math.round(relativeY / 10) * 10;

                // Ensure it's somewhat within bounds (optional, but good for UX)
                // We'll allow partial overhang but ensure it's not totally lost
                // Canvas is 360 wide.
                // If x is -200, it's lost. Clamp to -width/2 to width-width/2
                // But user wants "exactly where dragged". Let's trust the calculation mostly, 
                // but maybe fix if it's way off due to scroll issues (though clientRect handles scroll).

                initialGeometry = {
                    ...newWidget.geometry,
                    x: relativeX,
                    y: relativeY
                };
            } else {
                // Fallback if generic drop
                const existingCount = designData.sections[targetSection]?.widgets.length || 0;
                initialGeometry = {
                    ...newWidget.geometry,
                    x: 20 + (existingCount * 10) % 100,
                    y: 20 + (existingCount * 10) % 200
                };
            }

            newWidget.geometry = initialGeometry;

            // Enforce aspect ratio for QR Code on Drop
            if (newWidget.type === 'qr_code') {
                newWidget.geometry.h = newWidget.geometry.w;
                newWidget.config = {
                    ...(newWidget.config || {}),
                    aspectRatio: 1,
                    lockAspectRatio: true
                };
            }

            setDesignData(prev => ({
                ...prev,
                sections: {
                    ...prev.sections,
                    [targetSection]: {
                        ...prev.sections[targetSection],
                        widgets: [...prev.sections[targetSection].widgets, newWidget]
                    }
                }
            }));

            setSelectedWidget(newWidget);
            return;
        }

        // We no longer use DndKit for reordering existing widgets because we use absolute positioning.
        // The dragging of existing widgets is handled by BuilderCanvas internal DnD.
        // So we don't need the 'arrayMove' block anymore for the main canvas.
    }

    function updateWidget(widgetId, updates) {
        setDesignData(prev => {
            const newSections = { ...prev.sections };

            for (const sectionId of Object.keys(newSections)) {
                newSections[sectionId] = {
                    ...newSections[sectionId],
                    widgets: newSections[sectionId].widgets.map(w =>
                        w.id === widgetId ? { ...w, ...updates } : w
                    )
                };
            }

            return { ...prev, sections: newSections };
        });

        if (selectedWidget?.id === widgetId) {
            setSelectedWidget(prev => ({ ...prev, ...updates }));
        }
    }

    function deleteWidget(widgetId) {
        setDesignData(prev => {
            const newSections = { ...prev.sections };

            for (const sectionId of Object.keys(newSections)) {
                newSections[sectionId] = {
                    ...newSections[sectionId],
                    widgets: newSections[sectionId].widgets.filter(w => w.id !== widgetId)
                };
            }

            return { ...prev, sections: newSections };
        });

        if (selectedWidget?.id === widgetId) {
            setSelectedWidget(null);
        }
    }

    function handlePreview() {
        const previewState = {
            templateId: id,
            templateName,
            templateHash,
            activeLanguage,
            designData
        };

        navigate(`/templates/${id || 'new'}/preview`, { state: previewState });
    }

    async function handleSave() {
        setIsSaving(true);
        try {
            const normalizedName = templateName.trim();

            if (!normalizedName) {
                window.alert(localize(i18n, 'Please enter a template name before saving.', 'يرجى إدخال اسم القالب قبل الحفظ.'));
                return;
            }

            if (id && id !== 'new') {
                const response = await api.put(`/admin/templates/${id}`, {
                    name: normalizedName,
                    designData
                });
                setTemplateHash(response.data.data.design_data_hash || '');
            } else {
                const response = await api.post('/admin/templates', {
                    name: normalizedName,
                    category: 'custom',
                    designData
                });
                setTemplateHash(response.data.data.design_data_hash || '');
                navigate(`/templates/${response.data.data.id}`, { replace: true });
                return;
            }
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="template-builder-page">
            <div className="builder-header">
                <div className="header-left">
                    <button className="btn-icon" onClick={() => navigate('/library')}>
                        <ArrowLeft size={20} />
                    </button>
                    <input
                        type="text"
                        className="template-name-input"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder={localize(i18n, 'Template Name', 'اسم القالب')}
                    />
                    {templateHash && (
                        <span className="template-version-chip" title={templateHash}>
                            v {templateHash.slice(0, 8)}
                        </span>
                    )}
                </div>
                <div className="header-actions">
                    <div className="lang-toggle">
                        <button className={activeLanguage === 'ar' ? 'active' : ''} onClick={() => setActiveLanguage('ar')}>عربي</button>
                        <button className={activeLanguage === 'en' ? 'active' : ''} onClick={() => setActiveLanguage('en')}>EN</button>
                    </div>
                    <button className="btn btn-secondary" onClick={handlePreview}>
                        <Eye size={18} />
                        <span>{localize(i18n, 'Preview', 'معاينة')}</span>
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                        <Save size={18} />
                        <span>{isSaving ? localize(i18n, 'Saving...', 'جارٍ الحفظ...') : localize(i18n, 'Save', 'حفظ')}</span>
                    </button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="builder-layout">
                    <WidgetPalette />

                    <BuilderCanvas
                        sections={designData.sections}
                        selectedWidget={selectedWidget}
                        onSelectWidget={setSelectedWidget}
                        onUpdateWidget={updateWidget}
                        onDeleteWidget={deleteWidget}
                        activeLanguage={activeLanguage}
                        designData={designData}
                        onUpdateDesign={setDesignData}
                    />

                    <PropertiesPanel
                        widget={selectedWidget}
                        activeLanguage={activeLanguage}
                        designData={designData}
                        onUpdateDesign={setDesignData}
                        onUpdate={(updates) => selectedWidget && updateWidget(selectedWidget.id, updates)}
                    />
                </div>

                <DragOverlay>
                    {activeId && (
                        <div className="drag-overlay-widget">
                            {WIDGET_TYPES.find(w => w.type === activeId)?.label || activeId}
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

        </div>
    );
}
