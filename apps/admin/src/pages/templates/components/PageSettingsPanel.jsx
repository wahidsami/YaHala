import { useEffect, useRef, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { BACKGROUND_TYPES, GRADIENT_TYPES, normalizeLayout } from '../backgroundUtils';
import {
    BACKGROUND_EFFECT_LIBRARY,
    buildBackgroundEffectThumbnailStyle,
    createBackgroundEffectFromDefinition,
    getBackgroundEffectDefinition
} from '../backgroundEffectCatalog';

function buildEffectDraft(effect) {
    const definition = getBackgroundEffectDefinition(effect.type);
    const settings = effect.settings || {};
    const draft = {};

    for (const control of definition.controls || []) {
        draft[control.key] =
            settings[control.key]
            ?? effect[control.key]
            ?? definition.defaults?.[control.key]
            ?? (control.type === 'checkbox' ? false : '');
    }

    return draft;
}

export default function PageSettingsPanel({ designData, onUpdateDesign }) {
    const [pageTab, setPageTab] = useState('background');
    const [selectedEffectId, setSelectedEffectId] = useState(null);
    const [effectDraft, setEffectDraft] = useState(null);
    const hasSeededSelectionRef = useRef(false);

    if (!designData) {
        return <div className="properties-panel empty">Loading...</div>;
    }

    const layout = normalizeLayout(designData.layout || {});
    const backgroundEffects = layout.backgroundEffects || [];
    const selectedEffect = backgroundEffects.find((effect) => effect.id === selectedEffectId) || null;
    const selectedEffectDefinition = selectedEffect ? getBackgroundEffectDefinition(selectedEffect.type) : null;
    const currentBackgroundType = layout.backgroundType || 'solid';

    const getCompatibleBackgroundType = (effectDef, fallbackType = 'solid') => {
        const compatibility = effectDef?.compatibility || [];

        if (!compatibility.length) {
            return fallbackType;
        }

        if (compatibility.includes(currentBackgroundType)) {
            return currentBackgroundType;
        }

        return compatibility[0] || fallbackType;
    };

    useEffect(() => {
        if (!backgroundEffects.length) {
            setSelectedEffectId(null);
            setEffectDraft(null);
            hasSeededSelectionRef.current = false;
            return;
        }

        if (!selectedEffectId && !hasSeededSelectionRef.current) {
            const firstEffect = backgroundEffects[0];
            setSelectedEffectId(firstEffect.id);
            setEffectDraft(buildEffectDraft(firstEffect));
            hasSeededSelectionRef.current = true;
        }
    }, [backgroundEffects, selectedEffectId]);

    const updateLayout = (updates) => {
        onUpdateDesign({
            ...designData,
            layout: normalizeLayout({ ...layout, ...updates })
        });
    };

    const updateLiveSelectedEffect = (effectId, effectUpdates) => {
        const nextEffects = backgroundEffects.map((effect) => {
            if (effect.id !== effectId) return effect;

            const nextSettings = {
                ...(effect.settings || {}),
                ...effectUpdates
            };

            return {
                ...effect,
                ...effectUpdates,
                settings: nextSettings
            };
        });

        onUpdateDesign({
            ...designData,
            layout: normalizeLayout({
                ...layout,
                backgroundEffects: nextEffects
            })
        });
    };

    const setBackgroundType = (value) => {
        if (value === 'gradient') {
            updateLayout({
                backgroundType: 'gradient',
                backgroundImage: '',
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

        updateLayout({
            backgroundType: 'solid',
            backgroundImage: ''
        });
    };

    const clearBackgroundImage = () => {
        updateLayout({
            backgroundType: 'solid',
            backgroundImage: '',
            backgroundSize: 'cover'
        });
    };

    const removeEffectById = (effectId) => {
        updateLayout({
            backgroundEffects: backgroundEffects.filter((effect) => effect.id !== effectId)
        });

        if (selectedEffectId === effectId) {
            setSelectedEffectId(null);
            setEffectDraft(null);
        }
    };

    const removeAllEffects = () => {
        updateLayout({ backgroundEffects: [] });
        setSelectedEffectId(null);
        setEffectDraft(null);
        hasSeededSelectionRef.current = false;
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

    const addEffect = () => {
        const nextEffect = createBackgroundEffectFromDefinition('grain');
        updateLayout({
            backgroundEffects: [...backgroundEffects, nextEffect]
        });
        setSelectedEffectId(nextEffect.id);
        setEffectDraft(buildEffectDraft(nextEffect));
        setPageTab('effects');
    };

    const applyEffect = (effectType) => {
        const effectDef = getBackgroundEffectDefinition(effectType);
        const existingEffect = [...backgroundEffects].reverse().find((effect) => effect.type === effectType);
        const nextBackgroundType = getCompatibleBackgroundType(effectDef);

        if (existingEffect) {
            if (nextBackgroundType !== currentBackgroundType) {
                updateLayout({
                    backgroundType: nextBackgroundType,
                    ...(nextBackgroundType === 'solid' ? { backgroundImage: '' } : {})
                });
            }
            setSelectedEffectId(existingEffect.id);
            setEffectDraft(buildEffectDraft(existingEffect));
            setPageTab('effects');
            return;
        }

        const nextEffect = createBackgroundEffectFromDefinition(effectType);
        updateLayout({
            backgroundType: nextBackgroundType,
            ...(nextBackgroundType === 'solid' ? { backgroundImage: '' } : {}),
            backgroundEffects: [...backgroundEffects, nextEffect]
        });
        setSelectedEffectId(nextEffect.id);
        setEffectDraft(buildEffectDraft(nextEffect));
        setPageTab('effects');
    };

    const selectEffect = (effect) => {
        const effectDef = getBackgroundEffectDefinition(effect.type);
        const nextBackgroundType = getCompatibleBackgroundType(effectDef);

        if (nextBackgroundType !== currentBackgroundType) {
            updateLayout({
                backgroundType: nextBackgroundType,
                ...(nextBackgroundType === 'solid' ? { backgroundImage: '' } : {})
            });
        }

        setSelectedEffectId(effect.id);
        setEffectDraft(buildEffectDraft(effect));
        setPageTab('effects');
    };

    const saveSelectedEffect = () => {
        if (!selectedEffect || !effectDraft) return;

        updateLayout({
            backgroundEffects: backgroundEffects.map((effect) => (
                effect.id === selectedEffect.id
                    ? {
                        ...effect,
                        ...effectDraft,
                        settings: { ...(effect.settings || {}), ...effectDraft }
                    }
                    : effect
            ))
        });
    };

    const removeSelectedEffect = () => {
        if (!selectedEffect) return;

        updateLayout({
            backgroundEffects: backgroundEffects.filter((effect) => effect.id !== selectedEffect.id)
        });
        setSelectedEffectId(null);
        setEffectDraft(null);
    };

    const resolveEffectValue = (key) => (
        effectDraft?.[key]
        ?? selectedEffect?.settings?.[key]
        ?? selectedEffect?.[key]
        ?? selectedEffectDefinition?.defaults?.[key]
        ?? ''
    );

    const updateEffectDraft = (key, value) => {
        const nextDraft = {
            ...(effectDraft || {}),
            [key]: value
        };

        setEffectDraft(nextDraft);
        if (selectedEffect) {
            updateLiveSelectedEffect(selectedEffect.id, nextDraft);
        }
    };

    const backgroundTab = (
        <div className="page-settings-tab-panel">
            <div className="form-group">
                <label>Background Type</label>
                <select value={layout.backgroundType || 'solid'} onChange={(e) => setBackgroundType(e.target.value)}>
                    {BACKGROUND_TYPES.map((type) => (
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
                        <select value={layout.backgroundGradient?.type || 'linear'} onChange={(e) => updateGradient('type', e.target.value)}>
                            {GRADIENT_TYPES.map((type) => (
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
                            onChange={(e) => updateLayout({ backgroundType: 'image', backgroundImage: e.target.value })}
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
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    updateLayout({
                                        backgroundType: 'image',
                                        backgroundImage: event.target.result
                                    });
                                };
                                reader.readAsDataURL(file);
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

                    <button type="button" className="clear-background-btn" onClick={clearBackgroundImage}>
                        Remove Background Image
                    </button>
                </>
            )}

            <label className="checkbox-option page-settings-grid-toggle">
                <input
                    type="checkbox"
                    checked={layout.showGrid !== false}
                    onChange={(e) => updateLayout({ showGrid: e.target.checked })}
                />
                <span>Show Grid Overlay</span>
            </label>
        </div>
    );

    const effectsTab = (
        <div className="effects-tab-shell">
            <div className="effects-gallery-panel">
                <div className="effects-gallery-header">
                    <div>
                        <label>Background Effects Gallery</label>
                        <p className="info-text">Pick a preset from thumbnails, then tune its controls below.</p>
                    </div>
                    <div className="effects-gallery-actions">
                        <button type="button" className="add-effect-btn" onClick={addEffect}>
                            + Add Grain
                        </button>
                        <button
                            type="button"
                            className="clear-effects-btn"
                            onClick={removeAllEffects}
                            disabled={!backgroundEffects.length}
                        >
                            Remove All
                        </button>
                    </div>
                </div>

                <div className="effects-gallery-scroll">
                    <div className="effects-gallery-grid effects-gallery-grid--compact">
                        {BACKGROUND_EFFECT_LIBRARY.map((effectDef) => {
                            const appliedEffect = [...backgroundEffects].reverse().find((effect) => effect.type === effectDef.id);
                            const isApplied = Boolean(appliedEffect);
                            const isSelected = selectedEffectId === appliedEffect?.id;
                            const isCompatible = !effectDef.compatibility?.length || effectDef.compatibility.includes(currentBackgroundType);

                            return (
                                <div
                                    key={effectDef.id}
                                    className={`effect-gallery-card ${isApplied ? 'active' : ''}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        if (isApplied && appliedEffect) {
                                            selectEffect(appliedEffect);
                                        } else {
                                            applyEffect(effectDef.id);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            if (isApplied && appliedEffect) {
                                                selectEffect(appliedEffect);
                                            } else {
                                                applyEffect(effectDef.id);
                                            }
                                        }
                                    }}
                                >
                                    <div className="effect-gallery-thumb effect-gallery-thumb--square" style={buildBackgroundEffectThumbnailStyle(effectDef.id)}>
                                        <span className="effect-gallery-name">{effectDef.label}</span>
                                        {isApplied && appliedEffect && (
                                            <button
                                                type="button"
                                                className="effect-gallery-remove-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeEffectById(appliedEffect.id);
                                                }}
                                                title="Remove effect"
                                                aria-label="Remove effect"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="effect-gallery-apply-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isApplied && appliedEffect) {
                                                    selectEffect(appliedEffect);
                                                } else {
                                                    applyEffect(effectDef.id);
                                                }
                                            }}
                                        >
                                            {isSelected ? 'Selected' : isApplied ? 'Edit' : 'Apply'}
                                        </button>
                                        {!isCompatible && (
                                            <span className="effect-gallery-compatibility-note">
                                                Will switch background
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="effects-tab-divider" aria-hidden="true">
                <span>Selected effect</span>
            </div>

            <div className="selected-effect-panel">
                <div className="selected-effect-header">
                    <div>
                        <strong>{selectedEffectDefinition?.label || 'Effect settings'}</strong>
                        <p>
                            {selectedEffect
                                ? 'Adjust the selected effect, then save your changes.'
                                : 'Select an applied effect from the gallery to edit its settings.'}
                        </p>
                    </div>
                    <div className="selected-effect-actions">
                        <button
                            type="button"
                            className="effect-save-btn"
                            onClick={saveSelectedEffect}
                            disabled={!selectedEffect || !effectDraft}
                            title="Save effect"
                            aria-label="Save effect"
                        >
                            <Save size={14} />
                        </button>
                        <button
                            type="button"
                            className="effect-remove-btn"
                            onClick={removeSelectedEffect}
                            disabled={!selectedEffect}
                            title="Remove effect"
                            aria-label="Remove effect"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {selectedEffect && selectedEffectDefinition ? (
                    <>
                        <div className="selected-effect-banner">
                            <span className="selected-effect-banner-label">Editing</span>
                            <strong>{selectedEffectDefinition.label}</strong>
                        </div>

                        <div className="effect-controls-grid effect-controls-grid--compact">
                            {selectedEffectDefinition.controls.map((control) => {
                                const value = resolveEffectValue(control.key);

                                if (control.type === 'select') {
                                    return (
                                        <div className="form-group" key={control.key}>
                                            <label>{control.label}</label>
                                            <select
                                                value={value}
                                                onChange={(e) => updateEffectDraft(control.key, e.target.value)}
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
                                                onChange={(e) => updateEffectDraft(control.key, e.target.checked)}
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
                                                onChange={(e) => updateEffectDraft(control.key, e.target.value)}
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
                                                updateEffectDraft(control.key, nextValue);
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="selected-effect-empty">
                        Select an applied effect to edit its settings.
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="properties-panel">
            <div className="panel-header">
                <h3>Page Settings</h3>
            </div>
            <div className="panel-content page-settings-content">
                <div className="settings-tabs">
                    <button type="button" className={pageTab === 'background' ? 'active' : ''} onClick={() => setPageTab('background')}>
                        Background
                    </button>
                    <button type="button" className={pageTab === 'effects' ? 'active' : ''} onClick={() => setPageTab('effects')}>
                        Effects
                    </button>
                </div>

                {pageTab === 'background' ? backgroundTab : effectsTab}
            </div>
        </div>
    );
}
