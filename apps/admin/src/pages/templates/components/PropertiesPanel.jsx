import { useState } from 'react';
import { Plus, Trash2, AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react';
import { RULE_CONDITIONS, RULE_ACTIONS, FONT_FAMILIES } from '../widgetConfig';
import {
    BACKGROUND_TYPES,
    GRADIENT_TYPES,
    normalizeLayout
} from '../backgroundUtils';
import {
    BACKGROUND_EFFECT_LIBRARY,
    buildBackgroundEffectThumbnailStyle,
    createBackgroundEffectFromDefinition,
    getBackgroundEffectDefinition
} from '../backgroundEffectCatalog';
import PageSettingsPanel from './PageSettingsPanel';
import './PropertiesPanel.css';

function loadImageDimensions(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Unable to load image'));
        image.src = src;
    });
}

export default function PropertiesPanel({ widget, activeLanguage, onUpdate, designData, onUpdateDesign }) {
    const [activeTab, setActiveTab] = useState('content');
    const [effectSearch, setEffectSearch] = useState('');

    // PAGE SETTINGS (When no widget selected)
    if (!widget) {
        return <PageSettingsPanel designData={designData} onUpdateDesign={onUpdateDesign} />;

        const layout = normalizeLayout(designData.layout || {});

        const updateLayout = (updates) => {
            onUpdateDesign({
                ...designData,
                layout: normalizeLayout({ ...layout, ...updates })
            });
        };

        const updateGradient = (key, value) => {
            updateLayout({
                backgroundType: 'gradient',
                backgroundGradient: {
                    ...layout.backgroundGradient,
                    [key]: value
                }
            });
        };

        const updateEffect = (effectId, updates) => {
            updateLayout({
                backgroundEffects: layout.backgroundEffects.map((effect) => (
                    effect.id === effectId ? { ...effect, ...updates } : effect
                ))
            });
        };

        const addEffect = () => {
            updateLayout({
                backgroundEffects: [...layout.backgroundEffects, createBackgroundEffectFromDefinition('grain')]
            });
        };

        const addGalleryEffect = (effectType) => {
            updateLayout({
                backgroundEffects: [...layout.backgroundEffects, createBackgroundEffectFromDefinition(effectType)]
            });
        };

        const copyInstallCommand = async (command) => {
            if (!command || !navigator?.clipboard) {
                return;
            }

            try {
                await navigator.clipboard.writeText(command);
            } catch (error) {
                console.error('Failed to copy install command:', error);
            }
        };

        const filteredEffects = BACKGROUND_EFFECT_LIBRARY.filter((effectDef) => {
            const query = effectSearch.trim().toLowerCase();
            if (!query) return true;

            const haystack = [
                effectDef.label,
                effectDef.description,
                effectDef.group,
                ...(effectDef.tags || []),
                effectDef.installCommand || ''
            ].join(' ').toLowerCase();

            return haystack.includes(query);
        });

        const currentBackgroundType = layout.backgroundType || 'solid';

        const removeEffect = (effectId) => {
            updateLayout({
                backgroundEffects: layout.backgroundEffects.filter((effect) => effect.id !== effectId)
            });
        };

        const setBackgroundType = (value) => {
            if (value === 'gradient') {
                updateLayout({
                    backgroundType: 'gradient',
                    backgroundGradient: layout.backgroundGradient || {
                        type: 'linear',
                        angle: 135,
                        from: layout.backgroundColor || '#ffffff',
                        to: '#dbeafe',
                        middle: ''
                    }
                });
                return;
            }

            if (value === 'image') {
                updateLayout({ backgroundType: 'image' });
                return;
            }

            updateLayout({ backgroundType: 'solid' });
        };

        return (
            <div className="properties-panel">
                <div className="panel-header">
                    <h3>Page Settings</h3>
                </div>
                <div className="panel-content">
                    <div className="style-tab">
                        <div className="form-group">
                            <label>Background Type</label>
                            <select
                                value={layout.backgroundType || 'solid'}
                                onChange={(e) => setBackgroundType(e.target.value)}
                            >
                                {BACKGROUND_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {layout.backgroundType !== 'image' && (
                            <div className="form-group">
                                <label>Background Color</label>
                                <input
                                    type="color"
                                    value={layout.backgroundColor || '#ffffff'}
                                    onChange={(e) => updateLayout({ backgroundColor: e.target.value })}
                                />
                            </div>
                        )}

                        {layout.backgroundType === 'gradient' && (
                            <>
                                <div className="form-group">
                                    <label>Gradient Type</label>
                                    <select
                                        value={layout.backgroundGradient?.type || 'linear'}
                                        onChange={(e) => updateGradient('type', e.target.value)}
                                    >
                                        {GRADIENT_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group-row">
                                    <div className="form-group tiny">
                                        <label>From</label>
                                        <input
                                            type="color"
                                            value={layout.backgroundGradient?.from || '#ffffff'}
                                            onChange={(e) => updateGradient('from', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group tiny">
                                        <label>To</label>
                                        <input
                                            type="color"
                                            value={layout.backgroundGradient?.to || '#dbeafe'}
                                            onChange={(e) => updateGradient('to', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Middle Color</label>
                                    <input
                                        type="color"
                                        value={layout.backgroundGradient?.middle || '#ffffff'}
                                        onChange={(e) => updateGradient('middle', e.target.value)}
                                    />
                                </div>

                                {(layout.backgroundGradient?.type || 'linear') !== 'radial' && (
                                    <div className="form-group">
                                        <label>Angle</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="360"
                                            value={layout.backgroundGradient?.angle ?? 135}
                                            onChange={(e) => updateGradient('angle', parseInt(e.target.value, 10))}
                                        />
                                    </div>
                                )}

                                {(layout.backgroundGradient?.type || 'linear') === 'radial' && (
                                    <div className="form-group">
                                        <label>Radial Position</label>
                                        <select
                                            value={layout.backgroundGradient?.position || 'center'}
                                            onChange={(e) => updateGradient('position', e.target.value)}
                                        >
                                            <option value="center">Center</option>
                                            <option value="top">Top</option>
                                            <option value="bottom">Bottom</option>
                                            <option value="left">Left</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        {layout.backgroundType === 'image' && (
                            <>
                                <div className="form-group">
                                    <label>Background Image URL</label>
                                    <input
                                        type="url"
                                        value={layout.backgroundImage || ''}
                                        onChange={(e) => updateLayout({
                                            backgroundType: 'image',
                                            backgroundImage: e.target.value
                                        })}
                                        placeholder="https://..."
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Or Upload Background</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (event) => {
                                                    updateLayout({
                                                        backgroundType: 'image',
                                                        backgroundImage: event.target.result
                                                    });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </div>

                                {layout.backgroundImage && (
                                    <div className="form-group">
                                        <label>Background Size</label>
                                        <select
                                            value={layout.backgroundSize || 'cover'}
                                            onChange={(e) => updateLayout({ backgroundSize: e.target.value })}
                                        >
                                            <option value="cover">Cover (Fill)</option>
                                            <option value="contain">Contain (Fit)</option>
                                            <option value="100% 100%">Stretch</option>
                                            <option value="auto">Auto</option>
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="background-effects-section">
                            <div className="background-effects-header">
                                <div>
                                    <label>Background Effects Gallery</label>
                                    <p className="info-text">Pick a preset from thumbnails, then tune its controls below.</p>
                                </div>
                                <button type="button" className="add-effect-btn" onClick={addEffect}>
                                    + Add Grain
                                </button>
                            </div>

                            <div className="effects-gallery-toolbar">
                                <input
                                    type="search"
                                    value={effectSearch}
                                    onChange={(e) => setEffectSearch(e.target.value)}
                                    placeholder="Search effects, tags, or install command..."
                                />
                                <span className="effects-gallery-count">{filteredEffects.length} effects</span>
                            </div>

                            <div className="effects-gallery-grid">
                                {filteredEffects.map((effectDef) => {
                                    const isActive = (layout.backgroundEffects || []).some((effect) => effect.type === effectDef.id);
                                    const isCompatible = !effectDef.compatibility?.length || effectDef.compatibility.includes(currentBackgroundType);

                                    return (
                                        <div
                                            key={effectDef.id}
                                            className={`effect-gallery-card ${isActive ? 'active' : ''}`}
                                            role="button"
                                            tabIndex={0}
                                            aria-disabled={!isCompatible}
                                            onClick={() => {
                                                if (isCompatible) {
                                                    addGalleryEffect(effectDef.id);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if ((e.key === 'Enter' || e.key === ' ') && isCompatible) {
                                                    e.preventDefault();
                                                    addGalleryEffect(effectDef.id);
                                                }
                                            }}
                                        >
                                            <div
                                                className="effect-gallery-thumb"
                                                style={buildBackgroundEffectThumbnailStyle(effectDef.id)}
                                            >
                                                <span className="effect-gallery-badge">
                                                    {effectDef.kind === 'native' ? 'Built-in' : effectDef.group}
                                                </span>
                                                {!isCompatible && (
                                                    <span className="effect-gallery-badge compatibility-badge">No match</span>
                                                )}
                                            </div>
                                            <div className="effect-gallery-body">
                                                <strong>{effectDef.label}</strong>
                                                <p>{effectDef.description}</p>
                                                <div className="effect-gallery-tags">
                                                    {(effectDef.tags || []).slice(0, 3).map((tag) => (
                                                        <span key={tag} className="effect-tag">{tag}</span>
                                                    ))}
                                                </div>
                                                <div className="effect-gallery-meta">
                                                    <span className="effect-gallery-install">
                                                        {effectDef.installCommand || 'Ready to use'}
                                                    </span>
                                                    {effectDef.installCommand && (
                                                        <button
                                                            type="button"
                                                            className="copy-command-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                copyInstallCommand(effectDef.installCommand);
                                                            }}
                                                        >
                                                            Copy
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {(layout.backgroundEffects || []).length === 0 ? (
                                <div className="empty-effects">No background effects added yet.</div>
                            ) : (
                                <div className="effects-list">
                                    {layout.backgroundEffects.map((effect) => {
                                        const effectDefinition = getBackgroundEffectDefinition(effect.type);
                                        const effectSettings = effect.settings || {};

                                        const resolveEffectValue = (key) => (
                                            effectSettings[key]
                                            ?? effect[key]
                                            ?? effectDefinition.defaults?.[key]
                                            ?? ''
                                        );

                                        const updateEffectValue = (key, value) => {
                                            updateEffect(effect.id, {
                                                [key]: value,
                                                settings: {
                                                    ...effectSettings,
                                                    [key]: value
                                                }
                                            });
                                        };

                                        return (
                                            <div key={effect.id} className="effect-card">
                                                <div className="effect-card-header">
                                                    <div className="effect-card-title">
                                                        <select
                                                            value={effect.type}
                                                            onChange={(e) => {
                                                                const nextDefinition = getBackgroundEffectDefinition(e.target.value);
                                                                updateEffect(effect.id, {
                                                                    ...createBackgroundEffectFromDefinition(nextDefinition.id),
                                                                    id: effect.id
                                                                });
                                                            }}
                                                        >
                                                            {BACKGROUND_EFFECT_LIBRARY.map((type) => (
                                                                <option key={type.id} value={type.id}>
                                                                    {type.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <span className="effect-card-source">
                                                            {effectDefinition.kind === 'native' ? 'Built-in' : effectDefinition.group}
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="delete-effect-btn"
                                                        onClick={() => removeEffect(effect.id)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                {effectDefinition.installCommand && (
                                                    <div className="effect-install-note">
                                                        <span>Install:</span>
                                                        <code>{effectDefinition.installCommand}</code>
                                                    </div>
                                                )}

                                                <div className="effect-controls-grid">
                                                    {effectDefinition.controls.map((control) => {
                                                        const value = resolveEffectValue(control.key);

                                                if (control.type === 'select') {
                                                    return (
                                                        <div className="form-group" key={control.key}>
                                                                    <label>{control.label}</label>
                                                                    <select
                                                                        value={value}
                                                                        onChange={(e) => updateEffectValue(control.key, e.target.value)}
                                                                    >
                                                                        {(control.options || []).map((option) => (
                                                                            <option key={option} value={option}>
                                                                                {option}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                        );
                                                    }

                                                    if (control.type === 'checkbox') {
                                                        return (
                                                            <label className="checkbox-option effect-checkbox" key={control.key}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={Boolean(value)}
                                                                    onChange={(e) => updateEffectValue(control.key, e.target.checked)}
                                                                />
                                                                <span>{control.label}</span>
                                                            </label>
                                                        );
                                                    }

                                                    if (control.type === 'color') {
                                                        return (
                                                            <div className="form-group" key={control.key}>
                                                                    <label>{control.label}</label>
                                                                    <input
                                                                        type="color"
                                                                        value={value || '#ffffff'}
                                                                        onChange={(e) => updateEffectValue(control.key, e.target.value)}
                                                                    />
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div className="form-group" key={control.key}>
                                                                <label>{control.label}</label>
                                                                <input
                                                                    type="range"
                                                                    min={control.min}
                                                                    max={control.max}
                                                                    step={control.step || 1}
                                                                    value={value}
                                                                    onChange={(e) => {
                                                                        const nextValue = control.step && control.step < 1
                                                                            ? parseFloat(e.target.value)
                                                                            : parseInt(e.target.value, 10);
                                                                        updateEffectValue(control.key, nextValue);
                                                                    }}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // WIDGET SETTINGS
    function updateContent(key, value) {
        const newContent = {
            ...widget.content,
            [activeLanguage]: {
                ...(widget.content?.[activeLanguage] || {}),
                [key]: value
            }
        };
        onUpdate({ content: newContent });
    }

    function updateStyle(key, value) {
        onUpdate({ style: { ...widget.style, [key]: value } });
    }

    function updateGeometry(key, value) {
        const currentGeometry = widget.geometry || { x: 0, y: 0, w: 100, h: 100 };
        const parsedValue = parseInt(value, 10) || 0;
        const aspectRatio = widget.config?.aspectRatio || (currentGeometry.h ? currentGeometry.w / currentGeometry.h : 1);
        const newGeo = { ...currentGeometry, [key]: parsedValue };

        if ((widget.type === 'logo' || widget.type === 'qr_code') && aspectRatio > 0) {
            if (key === 'w') {
                newGeo.h = Math.max(1, Math.round(parsedValue / aspectRatio));
            } else if (key === 'h') {
                newGeo.w = Math.max(1, Math.round(parsedValue * aspectRatio));
            }
        }

        onUpdate({ geometry: newGeo });
    }

    async function handleLogoUpload(file) {
        if (!file) {
            return;
        }

        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Unable to read image'));
                reader.readAsDataURL(file);
            });

            const { width, height } = await loadImageDimensions(dataUrl);
            const aspectRatio = width && height ? width / height : 1;
            const baseGeometry = widget.geometry || { x: 20, y: 20, w: 280, h: 80 };

            const sharedContent = {
                ...(widget.content || {}),
                ar: {
                    ...(widget.content?.ar || {}),
                    url: dataUrl,
                    alt: file.name || 'Logo'
                },
                en: {
                    ...(widget.content?.en || {}),
                    url: dataUrl,
                    alt: file.name || 'Logo'
                }
            };

            onUpdate({
                content: sharedContent,
                geometry: {
                    ...baseGeometry,
                    w: width || baseGeometry.w,
                    h: height || baseGeometry.h
                },
                style: {
                    ...(widget.style || {}),
                    padding: 0,
                    backgroundColor: 'transparent'
                },
                config: {
                    ...(widget.config || {}),
                    aspectRatio,
                    lockAspectRatio: true
                }
            });
        } catch (error) {
            console.error('Failed to load logo:', error);
        }
    }

    async function handleLogoUrlChange(url) {
        const sharedContent = {
            ...(widget.content || {}),
            ar: {
                ...(widget.content?.ar || {}),
                url,
                alt: widget.content?.ar?.alt || 'Logo'
            },
            en: {
                ...(widget.content?.en || {}),
                url,
                alt: widget.content?.en?.alt || 'Logo'
            }
        };

        if (!url) {
            onUpdate({ content: sharedContent });
            return;
        }

        try {
            const { width, height } = await loadImageDimensions(url);
            const aspectRatio = width && height ? width / height : 1;
            const currentGeometry = widget.geometry || { x: 20, y: 20, w: 280, h: 80 };

            onUpdate({
                content: sharedContent,
                geometry: {
                    ...currentGeometry,
                    w: width || currentGeometry.w,
                    h: height || currentGeometry.h
                },
                style: {
                    ...(widget.style || {}),
                    padding: 0,
                    backgroundColor: 'transparent'
                },
                config: {
                    ...(widget.config || {}),
                    aspectRatio,
                    lockAspectRatio: true
                }
            });
        } catch (error) {
            onUpdate({ content: sharedContent });
        }
    }

    function addRule() {
        const newRule = {
            id: Date.now().toString(),
            action: 'hide',
            conditionLogic: 'and',
            conditions: [{ id: Date.now().toString() + '_c', type: 'time', operator: 'after_event_end', value: null }]
        };
        onUpdate({ rules: [...(widget.rules || []), newRule] });
    }

    function updateRule(ruleId, updates) {
        const newRules = widget.rules.map(r => r.id === ruleId ? { ...r, ...updates } : r);
        onUpdate({ rules: newRules });
    }

    function deleteRule(ruleId) {
        onUpdate({ rules: widget.rules.filter(r => r.id !== ruleId) });
    }

    function addCondition(ruleId) {
        const newRules = widget.rules.map(rule => {
            if (rule.id === ruleId) {
                return {
                    ...rule,
                    conditions: [...rule.conditions, { id: Date.now().toString(), type: 'time', operator: 'after_event_end', value: null }]
                };
            }
            return rule;
        });
        onUpdate({ rules: newRules });
    }

    function updateCondition(ruleId, conditionId, updates) {
        const newRules = widget.rules.map(rule => {
            if (rule.id === ruleId) {
                return {
                    ...rule,
                    conditions: rule.conditions.map(c => c.id === conditionId ? { ...c, ...updates } : c)
                };
            }
            return rule;
        });
        onUpdate({ rules: newRules });
    }

    function deleteCondition(ruleId, conditionId) {
        const newRules = widget.rules.map(rule => {
            if (rule.id === ruleId) {
                return { ...rule, conditions: rule.conditions.filter(c => c.id !== conditionId) };
            }
            return rule;
        });
        onUpdate({ rules: newRules });
    }

    const content = widget.content?.[activeLanguage] || {};
    const geo = widget.geometry || { x: 0, y: 0, w: 0, h: 0 };

    return (
        <div className="properties-panel">
            <div className="panel-header">
                <h3>{widget.type.replace('_', ' ')}</h3>
                <span className="lang-indicator">{activeLanguage.toUpperCase()}</span>
            </div>

            <div className="panel-tabs">
                <button className={activeTab === 'content' ? 'active' : ''} onClick={() => setActiveTab('content')}>Content</button>
                <button className={activeTab === 'style' ? 'active' : ''} onClick={() => setActiveTab('style')}>Style</button>
                <button className={activeTab === 'rules' ? 'active' : ''} onClick={() => setActiveTab('rules')}>Rules</button>
            </div>

            <div className="panel-content">
                {activeTab === 'content' && (
                    <div className="content-tab">
                        {/* Geometry Inputs in Content Tab (or style, but content is fine for quick access) */}
                        <div className="form-group-row">
                            <div className="form-group tiny">
                                <label>X</label>
                                <input type="number" value={geo.x} onChange={e => updateGeometry('x', e.target.value)} />
                            </div>
                            <div className="form-group tiny">
                                <label>Y</label>
                                <input type="number" value={geo.y} onChange={e => updateGeometry('y', e.target.value)} />
                            </div>
                            <div className="form-group tiny">
                                <label>W</label>
                                <input type="number" value={geo.w} onChange={e => updateGeometry('w', e.target.value)} />
                            </div>
                            <div className="form-group tiny">
                                <label>H</label>
                                <input type="number" value={geo.h} onChange={e => updateGeometry('h', e.target.value)} />
                            </div>
                        </div>
                        <hr className="divider" />

                        {widget.type === 'text' && (
                            <div className="form-group">
                                <label>Text Content</label>
                                <textarea
                                    value={content.text || ''}
                                    onChange={(e) => updateContent('text', e.target.value)}
                                    rows={4}
                                    dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
                                    className="text-content-input"
                                />

                                <div className="typography-toolbar mt-3">
                                    <div className="toolbar-row">
                                        <div className="form-group tiny">
                                            <label>Font Family</label>
                                            <select
                                                value={widget.style?.fontFamily || 'Noto Sans Arabic'}
                                                onChange={(e) => updateStyle('fontFamily', e.target.value)}
                                                className="font-select"
                                            >
                                                {FONT_FAMILIES.map(font => (
                                                    <option key={font.value} value={font.value}>{font.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="toolbar-row">
                                        <div className="form-group tiny">
                                            <label>Size</label>
                                            <input
                                                type="number"
                                                value={widget.style?.fontSize || 16}
                                                onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
                                            />
                                        </div>
                                        <div className="form-group tiny">
                                            <label>Color</label>
                                            <div className="color-field-wrapper">
                                                <input
                                                    type="color"
                                                    value={widget.style?.color || '#000000'}
                                                    onChange={(e) => updateStyle('color', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            className={`style-btn ${widget.style?.fontWeight === 'bold' ? 'active' : ''}`}
                                            onClick={() => updateStyle('fontWeight', widget.style?.fontWeight === 'bold' ? 'normal' : 'bold')}
                                            title="Bold"
                                        >
                                            <Bold size={16} />
                                        </button>
                                    </div>

                                    <div className="toolbar-row alignment-group">
                                        <button
                                            className={`style-btn ${widget.style?.textAlign === 'start' ? 'active' : ''}`}
                                            onClick={() => updateStyle('textAlign', 'start')}
                                            title="Align Start"
                                        >
                                            <AlignLeft size={16} />
                                        </button>
                                        <button
                                            className={`style-btn ${(!widget.style?.textAlign || widget.style?.textAlign === 'center') ? 'active' : ''}`}
                                            onClick={() => updateStyle('textAlign', 'center')}
                                            title="Align Center"
                                        >
                                            <AlignCenter size={16} />
                                        </button>
                                        <button
                                            className={`style-btn ${widget.style?.textAlign === 'end' ? 'active' : ''}`}
                                            onClick={() => updateStyle('textAlign', 'end')}
                                            title="Align End"
                                        >
                                            <AlignRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {widget.type === 'image' && (
                            <>
                                <div className="form-group">
                                    <label>Image URL</label>
                                    <input
                                        type="url"
                                        value={content.url || ''}
                                        onChange={(e) => updateContent('url', e.target.value)}
                                        placeholder="https://example.com/image.jpg"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Or Upload Image</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (event) => {
                                                    updateContent('url', event.target.result);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </div>
                                {content.url && (
                                    <div className="image-preview">
                                        <img src={content.url} alt="Preview" />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Alt Text</label>
                                    <input
                                        type="text"
                                        value={content.alt || ''}
                                        onChange={(e) => updateContent('alt', e.target.value)}
                                        dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
                                    />
                                </div>
                            </>
                        )}
                        {widget.type === 'logo' && (
                            <>
                                <div className="form-group">
                                    <label>Logo URL</label>
                                    <input
                                        type="url"
                                        value={content.url || ''}
                                        onChange={(e) => handleLogoUrlChange(e.target.value)}
                                        placeholder="https://example.com/logo.png"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Or Upload Logo</label>
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                handleLogoUpload(file);
                                            }
                                        }}
                                    />
                                </div>
                                {content.url && (
                                    <div className="image-preview logo-preview">
                                        <img src={content.url} alt={content.alt || 'Logo preview'} />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Alt Text</label>
                                    <input
                                        type="text"
                                        value={content.alt || ''}
                                        onChange={(e) => {
                                            const alt = e.target.value;
                                            const sharedContent = {
                                                ...(widget.content || {}),
                                                ar: { ...(widget.content?.ar || {}), alt },
                                                en: { ...(widget.content?.en || {}), alt }
                                            };
                                            onUpdate({ content: sharedContent });
                                        }}
                                    />
                                </div>
                                <p className="info-text">Logo size is locked to the imported aspect ratio.</p>
                            </>
                        )}
                        {widget.type === 'event_details' && (
                            <>
                                <label className="checkbox-option">
                                    <input
                                        type="checkbox"
                                        checked={content.showDate !== false}
                                        onChange={(e) => updateContent('showDate', e.target.checked)}
                                    />
                                    <span>Show Date</span>
                                </label>
                                <label className="checkbox-option">
                                    <input
                                        type="checkbox"
                                        checked={content.showTime !== false}
                                        onChange={(e) => updateContent('showTime', e.target.checked)}
                                    />
                                    <span>Show Time</span>
                                </label>
                                <label className="checkbox-option">
                                    <input
                                        type="checkbox"
                                        checked={content.showVenue !== false}
                                        onChange={(e) => updateContent('showVenue', e.target.checked)}
                                    />
                                    <span>Show Venue</span>
                                </label>
                            </>
                        )}
                        {widget.type === 'guest_name' && (
                            <div className="form-group">
                                <label>Prefix</label>
                                <input
                                    type="text"
                                    value={content.prefix || ''}
                                    onChange={(e) => updateContent('prefix', e.target.value)}
                                    dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
                                />
                                <label className="mt-3">Name Placeholder (Builder preview)</label>
                                <input
                                    type="text"
                                    value={content.placeholderName || ''}
                                    onChange={(e) => updateContent('placeholderName', e.target.value)}
                                    dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
                                    placeholder={activeLanguage === 'ar' ? 'اسم الضيف' : 'Guest Name'}
                                />
                                <label className="mt-3">Position Placeholder (Builder preview)</label>
                                <input
                                    type="text"
                                    value={content.placeholderPosition || ''}
                                    onChange={(e) => updateContent('placeholderPosition', e.target.value)}
                                    dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
                                    placeholder={activeLanguage === 'ar' ? 'المسمى الوظيفي' : 'Position / Job Title'}
                                />
                                <div className="typography-toolbar mt-3">
                                    <div className="toolbar-row">
                                        <div className="form-group tiny">
                                            <label>Font Family</label>
                                            <select
                                                value={widget.style?.fontFamily || 'Noto Sans Arabic'}
                                                onChange={(e) => updateStyle('fontFamily', e.target.value)}
                                                className="font-select"
                                            >
                                                {FONT_FAMILIES.map(font => (
                                                    <option key={font.value} value={font.value}>{font.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="toolbar-row">
                                        <div className="form-group tiny">
                                            <label>Name Size</label>
                                            <input
                                                type="number"
                                                value={widget.style?.guestNameFontSize || widget.style?.fontSize || 16}
                                                onChange={(e) => {
                                                    const nextValue = parseInt(e.target.value, 10) || 16;
                                                    onUpdate({
                                                        style: {
                                                            ...(widget.style || {}),
                                                            fontSize: nextValue,
                                                            guestNameFontSize: nextValue
                                                        }
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div className="form-group tiny">
                                            <label>Position Size</label>
                                            <input
                                                type="number"
                                                value={widget.style?.guestPositionFontSize || Math.max(12, (widget.style?.guestNameFontSize || widget.style?.fontSize || 16) - 3)}
                                                onChange={(e) => updateStyle('guestPositionFontSize', parseInt(e.target.value, 10) || 13)}
                                            />
                                        </div>
                                        <div className="form-group tiny">
                                            <label>Color</label>
                                            <div className="color-field-wrapper">
                                                <input
                                                    type="color"
                                                    value={widget.style?.color || '#000000'}
                                                    onChange={(e) => updateStyle('color', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            className={`style-btn ${widget.style?.fontWeight === 'bold' ? 'active' : ''}`}
                                            onClick={() => updateStyle('fontWeight', widget.style?.fontWeight === 'bold' ? 'normal' : 'bold')}
                                            title="Bold"
                                        >
                                            <Bold size={16} />
                                        </button>
                                    </div>

                                    <div className="toolbar-row alignment-group">
                                        <button
                                            className={`style-btn ${widget.style?.textAlign === 'start' ? 'active' : ''}`}
                                            onClick={() => updateStyle('textAlign', 'start')}
                                            title="Align Start"
                                        >
                                            <AlignLeft size={16} />
                                        </button>
                                        <button
                                            className={`style-btn ${(!widget.style?.textAlign || widget.style?.textAlign === 'center') ? 'active' : ''}`}
                                            onClick={() => updateStyle('textAlign', 'center')}
                                            title="Align Center"
                                        >
                                            <AlignCenter size={16} />
                                        </button>
                                        <button
                                            className={`style-btn ${widget.style?.textAlign === 'end' ? 'active' : ''}`}
                                            onClick={() => updateStyle('textAlign', 'end')}
                                            title="Align End"
                                        >
                                            <AlignRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {widget.type === 'qr_code' && (
                            <>
                                <div className="form-group">
                                    <label>Label</label>
                                    <input
                                        type="text"
                                        value={content.label || ''}
                                        onChange={(e) => updateContent('label', e.target.value)}
                                        dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
                                    />
                                </div>
                                <div className="form-group-row">
                                    <div className="form-group tiny">
                                        <label>QR Color</label>
                                        <input
                                            type="color"
                                            value={content.qrColor || widget.style?.color || '#111827'}
                                            onChange={(e) => updateContent('qrColor', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group tiny">
                                        <label>QR Background</label>
                                        <input
                                            type="color"
                                            value={content.qrBackground || widget.style?.backgroundColor || '#ffffff'}
                                            onChange={(e) => updateContent('qrBackground', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                        {widget.type === 'voice_recorder' && (
                            <>
                                <div className="form-group">
                                    <label>Label</label>
                                    <input
                                        type="text"
                                        value={content.label || ''}
                                        onChange={(e) => updateContent('label', e.target.value)}
                                        dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Max Duration (seconds)</label>
                                    <input
                                        type="number"
                                        value={content.maxDuration || 60}
                                        onChange={(e) => updateContent('maxDuration', parseInt(e.target.value))}
                                    />
                                </div>
                            </>
                        )}
                        {widget.type === 'text_submission' && (
                            <>
                                <div className="form-group">
                                    <label>Label</label>
                                    <input
                                        type="text"
                                        value={content.label || ''}
                                        onChange={(e) => updateContent('label', e.target.value)}
                                        dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Placeholder</label>
                                    <input
                                        type="text"
                                        value={content.placeholder || ''}
                                        onChange={(e) => updateContent('placeholder', e.target.value)}
                                        dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}
                                    />
                                </div>
                            </>
                        )}
                        {widget.type === 'survey' && (
                            <p className="info-text">Configure survey questions in advanced settings</p>
                        )}
                    </div>
                )}

                {activeTab === 'style' && (
                    <div className="style-tab">
                        <div className="form-group">
                            <label>Font Size</label>
                            <input
                                type="number"
                                value={widget.style?.fontSize || 16}
                                onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Text Align</label>
                            <select
                                value={widget.style?.textAlign || 'center'}
                                onChange={(e) => updateStyle('textAlign', e.target.value)}
                            >
                                <option value="start">Start</option>
                                <option value="center">Center</option>
                                <option value="end">End</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Text Color</label>
                            <input
                                type="color"
                                value={widget.style?.color || '#000000'}
                                onChange={(e) => updateStyle('color', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Background</label>
                            <input
                                type="color"
                                value={widget.style?.backgroundColor || '#ffffff'}
                                onChange={(e) => updateStyle('backgroundColor', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Padding</label>
                            <input
                                type="number"
                                value={widget.style?.padding ?? 16}
                                onChange={(e) => updateStyle('padding', parseInt(e.target.value))}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'rules' && (
                    <div className="rules-tab">
                        {(widget.rules || []).map(rule => (
                            <div key={rule.id} className="rule-card">
                                <div className="rule-header">
                                    <select
                                        value={rule.action}
                                        onChange={(e) => updateRule(rule.id, { action: e.target.value })}
                                    >
                                        {RULE_ACTIONS.map(a => (
                                            <option key={a.action} value={a.action}>{a.label}</option>
                                        ))}
                                    </select>
                                    <span>this widget when:</span>
                                    <button className="delete-rule" onClick={() => deleteRule(rule.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {rule.conditions.map((condition, idx) => (
                                    <div key={condition.id} className="condition-row">
                                        {idx > 0 && (
                                            <select
                                                className="logic-select"
                                                value={rule.conditionLogic}
                                                onChange={(e) => updateRule(rule.id, { conditionLogic: e.target.value })}
                                            >
                                                <option value="and">AND</option>
                                                <option value="or">OR</option>
                                            </select>
                                        )}
                                        <select
                                            value={`${condition.type}.${condition.operator}`}
                                            onChange={(e) => {
                                                const [type, operator] = e.target.value.split('.');
                                                updateCondition(rule.id, condition.id, { type, operator, value: null });
                                            }}
                                        >
                                            {RULE_CONDITIONS.map(c => (
                                                <option key={`${c.type}.${c.operator}`} value={`${c.type}.${c.operator}`}>
                                                    {c.label}
                                                </option>
                                            ))}
                                        </select>
                                        {RULE_CONDITIONS.find(c => c.type === condition.type && c.operator === condition.operator)?.hasValue && (
                                            <select
                                                value={condition.value || ''}
                                                onChange={(e) => updateCondition(rule.id, condition.id, { value: e.target.value })}
                                            >
                                                <option value="">Select...</option>
                                                {RULE_CONDITIONS.find(c => c.type === condition.type && c.operator === condition.operator)?.values?.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                        )}
                                        {rule.conditions.length > 1 && (
                                            <button className="delete-condition" onClick={() => deleteCondition(rule.id, condition.id)}>
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                <button className="add-condition" onClick={() => addCondition(rule.id)}>
                                    + Add Condition
                                </button>
                            </div>
                        ))}

                        <button className="add-rule" onClick={addRule}>
                            <Plus size={16} />
                            <span>Add Rule</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
