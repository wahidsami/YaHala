import { useEffect, useMemo, useRef, useState } from 'react';
import { X, AlertCircle, MapPin } from 'lucide-react';
import api from '../../../services/api';
import { buildCanvasBackgroundStyle, normalizeLayout } from '../backgroundUtils';
import InvitationCanvasRenderer from './InvitationCanvasRenderer';
import BubbleBackground from './BubbleBackground';
import GravityStarsBackground from './GravityStarsBackground';
import StarsBackground from './StarsBackground';
import FireworksBackground from './FireworksBackground';
import HexagonBackground from './HexagonBackground';
import PrismBackground from './PrismBackground';
import DarkVeilBackground from './DarkVeilBackground';
import LightPillarBackground from './LightPillarBackground';
import SilkBackground from './SilkBackground';
import { buildBubbleRuntimeProps, buildDarkVeilRuntimeProps, buildFireworksRuntimeProps, buildGravityStarsRuntimeProps, buildHexagonRuntimeProps, buildLightPillarRuntimeProps, buildPrismRuntimeProps, buildSilkRuntimeProps, buildStarsRuntimeProps } from '../backgroundEffectCatalog';
import './PreviewSimulator.css';
import '../../public-invitations/PublicInvitationPage.css';

function resolveEffectValue(effect, key, fallback) {
    const value = effect?.settings?.[key] ?? effect?.[key] ?? fallback;
    return value;
}

function resolvePreviewAssetUrl(assetPath) {
    if (!assetPath) {
        return '';
    }

    if (/^(https?:\/\/|data:|blob:|mailto:|tel:)/i.test(assetPath)) {
        return assetPath;
    }

    if (assetPath.startsWith('/storage/') || assetPath.startsWith('storage/')) {
        const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const origin = baseUrl.replace(/\/api\/?$/, '');
        const normalizedPath = assetPath.startsWith('/storage/') ? assetPath : `/${assetPath}`;
        return `${origin}${normalizedPath}`;
    }

    if (assetPath.startsWith('/')) {
        return `${window.location.origin}${assetPath}`;
    }

    return `${window.location.origin}/${assetPath}`;
}

export default function PreviewSimulator({ templateId, templateHash, designData, onClose }) {
    const previewCanvasBaseWidth = 360;
    const [context, setContext] = useState({
        timeState: 'before_event',
        scanState: 'not_scanned',
        language: 'ar',
        guestGroup: 'regular',
        eventType: 'wedding'
    });
    const [previewResult, setPreviewResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const previewViewportRef = useRef(null);
    const [previewViewport, setPreviewViewport] = useState({ width: 0, height: 0 });
    const previewLayout = normalizeLayout(previewResult?.layout || designData?.layout || {});
    const previewVersionHash = previewResult?.design_data_hash || templateHash || '';
    const previewCanvasHeight = Math.max(640, Number(previewLayout.height) || 640);

    useEffect(() => {
        const element = previewViewportRef.current;
        if (!element) {
            return undefined;
        }

        const updateViewport = () => {
            setPreviewViewport({
                width: element.clientWidth || 0,
                height: element.clientHeight || 0
            });
        };

        updateViewport();

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(updateViewport);
            observer.observe(element);

            return () => observer.disconnect();
        }

        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, [previewResult, designData]);

    const previewFitScale = useMemo(() => {
        const viewportWidth = previewViewport.width || 0;
        const viewportHeight = previewViewport.height || 0;
        if (!viewportWidth || !viewportHeight) {
            return 1;
        }

        const horizontalScale = (viewportWidth - 16) / previewCanvasBaseWidth;
        const verticalScale = (viewportHeight - 16) / previewCanvasHeight;
        return Math.min(1, horizontalScale, verticalScale);
    }, [previewCanvasHeight, previewViewport.height, previewViewport.width]);

    const previewScaledWidth = previewCanvasBaseWidth * previewFitScale;
    const previewScaledHeight = previewCanvasHeight * previewFitScale;

    async function runPreview() {
        setLoading(true);
        try {
            // If template saved, use API
            if (templateId && templateId !== 'new') {
                const response = await api.post(`/admin/templates/${templateId}/preview`, context);
                setPreviewResult(response.data.data);
            } else {
                // Client-side evaluation for unsaved templates
                const result = evaluateLocally(designData, context);
                setPreviewResult(result);
            }
        } catch (error) {
            console.error('Preview failed:', error);
        } finally {
            setLoading(false);
        }
    }

    function evaluateLocally(design, ctx) {
        const result = { context: ctx, sections: {}, debug: [], layout: normalizeLayout(design.layout || {}) };

        for (const [sectionId, section] of Object.entries(design.sections || {})) {
            result.sections[sectionId] = {
                widgets: (section.widgets || []).map(widget => {
                    const { visible, reason } = evaluateWidgetRules(widget, ctx);
                    result.debug.push({ widgetId: widget.id, widgetType: widget.type, visible, reason });
                    return { ...widget, _visible: visible, _reason: reason };
                })
            };
        }
        return result;
    }

    function evaluateWidgetRules(widget, ctx) {
        const rules = widget.rules || [];
        if (rules.length === 0) {
            return { visible: true, reason: 'No rules (always visible)' };
        }

        for (const rule of rules) {
            const conditions = rule.conditions || [];
            if (conditions.length === 0) continue;

            const results = conditions.map(c => evaluateCondition(c, ctx));
            const conditionsMet = rule.conditionLogic === 'or' ? results.some(r => r) : results.every(r => r);

            if (conditionsMet) {
                const condDesc = conditions.map(c => `${c.type}.${c.operator}`).join(` ${rule.conditionLogic.toUpperCase()} `);
                return { visible: rule.action !== 'hide', reason: `${rule.action.toUpperCase()}: ${condDesc}` };
            }
        }
        return { visible: true, reason: 'No matching rules (default visible)' };
    }

    function evaluateCondition(condition, ctx) {
        const key = `${condition.type}.${condition.operator}`;
        switch (key) {
            case 'time.before_event_start': return ctx.timeState === 'before_event';
            case 'time.during_event': return ctx.timeState === 'during_event';
            case 'time.after_event_end': return ctx.timeState === 'after_event';
            case 'scan.checked_in': return ctx.scanState === 'checked_in';
            case 'scan.not_scanned': return ctx.scanState === 'not_scanned';
            case 'event.type_is': return ctx.eventType === condition.value;
            case 'guest.group_is': return ctx.guestGroup === condition.value;
            default: return false;
        }
    }

    function getOrderedSections(sections) {
        const preferredOrder = ['header', 'body', 'footer'];
        const ordered = preferredOrder
            .filter((sectionId) => sections?.[sectionId])
            .map((sectionId) => [sectionId, sections[sectionId]]);

        for (const [sectionId, section] of Object.entries(sections || {})) {
            if (!preferredOrder.includes(sectionId)) {
                ordered.push([sectionId, section]);
            }
        }

        return ordered;
    }

    function getPreviewWidgets(widgets = []) {
        return [...widgets]
            .map((widget, index) => ({ widget, index }))
            .sort((left, right) => {
                const leftY = Number(left.widget.geometry?.y ?? 0);
                const rightY = Number(right.widget.geometry?.y ?? 0);

                if (leftY !== rightY) {
                    return leftY - rightY;
                }

                const leftX = Number(left.widget.geometry?.x ?? 0);
                const rightX = Number(right.widget.geometry?.x ?? 0);

                if (leftX !== rightX) {
                    return leftX - rightX;
                }

                return left.index - right.index;
            })
            .map(({ widget }) => widget);
    }

    function renderPreviewEffect(effect) {
        if (effect.previewVariant === 'bubble') {
            const bubbleProps = buildBubbleRuntimeProps(effect);

            return (
                <BubbleBackground
                    key={effect.id}
                    {...bubbleProps}
                />
            );
        }

        if (effect.previewVariant === 'fireworks') {
            const fireworksProps = buildFireworksRuntimeProps(effect);

            return (
                <FireworksBackground
                    key={effect.id}
                    {...fireworksProps}
                />
            );
        }

        if (effect.previewVariant === 'gravity-stars') {
            const gravityStarsProps = buildGravityStarsRuntimeProps(effect);

            return (
                <GravityStarsBackground
                    key={effect.id}
                    {...gravityStarsProps}
                />
            );
        }

        if (effect.previewVariant === 'hexagon') {
            const hexagonProps = buildHexagonRuntimeProps(effect);

            return (
                <HexagonBackground
                    key={effect.id}
                    {...hexagonProps}
                />
            );
        }

        if (effect.previewVariant === 'stars') {
            const starsProps = buildStarsRuntimeProps(effect);

            return (
                <StarsBackground
                    key={effect.id}
                    {...starsProps}
                />
            );
        }

        if (effect.previewVariant === 'prism') {
            const prismProps = buildPrismRuntimeProps(effect);

            return (
                <PrismBackground
                    key={effect.id}
                    {...prismProps}
                />
            );
        }

        if (effect.previewVariant === 'dark-veil') {
            const darkVeilProps = buildDarkVeilRuntimeProps(effect);

            return (
                <DarkVeilBackground
                    key={effect.id}
                    {...darkVeilProps}
                />
            );
        }

        if (effect.previewVariant === 'light-pillar') {
            const lightPillarProps = buildLightPillarRuntimeProps(effect);

            return (
                <LightPillarBackground
                    key={effect.id}
                    {...lightPillarProps}
                />
            );
        }

        if (effect.previewVariant === 'silk') {
            const silkProps = buildSilkRuntimeProps(effect);

            return (
                <SilkBackground
                    key={effect.id}
                    {...silkProps}
                />
            );
        }

        return (
            <div
                key={effect.id}
                className={`preview-effect preview-effect-${effect.previewVariant || effect.type}`}
                style={{
                    '--effect-opacity': resolveEffectValue(effect, 'opacity', 0.18),
                    '--effect-speed': `${Math.max(1, Number(resolveEffectValue(effect, 'speed', 30)) || 1)}s`,
                    '--effect-amount': `${Math.max(0, Number(resolveEffectValue(effect, 'amount', 40)) || 0)}`,
                    '--effect-color': resolveEffectValue(effect, 'color', '#ffffff')
                }}
            />
        );
    }

    return (
        <div className="preview-overlay">
            <div className="preview-modal">
                <div className="preview-header">
                    <div className="preview-header-title">
                        <h2>Preview Simulator</h2>
                        {previewVersionHash && (
                            <span className="preview-version-chip" title={previewVersionHash}>
                                v {previewVersionHash.slice(0, 8)}
                            </span>
                        )}
                    </div>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="preview-body">
                    <div className="context-controls">
                        <h3>Simulation Context</h3>

                        <div className="control-group">
                            <label>Time State</label>
                            <div className="radio-group">
                                {['before_event', 'during_event', 'after_event'].map(t => (
                                    <label key={t} className="radio-option">
                                        <input
                                            type="radio"
                                            name="timeState"
                                            value={t}
                                            checked={context.timeState === t}
                                            onChange={(e) => setContext(prev => ({ ...prev, timeState: e.target.value }))}
                                        />
                                        <span>{t.replace('_', ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="control-group">
                            <label>Scan Status</label>
                            <div className="radio-group">
                                {['not_scanned', 'checked_in'].map(s => (
                                    <label key={s} className="radio-option">
                                        <input
                                            type="radio"
                                            name="scanState"
                                            value={s}
                                            checked={context.scanState === s}
                                            onChange={(e) => setContext(prev => ({ ...prev, scanState: e.target.value }))}
                                        />
                                        <span>{s.replace('_', ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="control-group">
                            <label>Language</label>
                            <select value={context.language} onChange={(e) => setContext(prev => ({ ...prev, language: e.target.value }))}>
                                <option value="ar">Arabic (RTL)</option>
                                <option value="en">English (LTR)</option>
                            </select>
                        </div>

                        <div className="control-group">
                            <label>Guest Group</label>
                            <select value={context.guestGroup} onChange={(e) => setContext(prev => ({ ...prev, guestGroup: e.target.value }))}>
                                <option value="regular">Regular</option>
                                <option value="vip">VIP</option>
                                <option value="family">Family</option>
                            </select>
                        </div>

                        <button className="run-preview-btn" onClick={runPreview} disabled={loading}>
                            {loading ? 'Evaluating...' : 'Run Preview / Refresh'}
                        </button>

                        <div className="debug-summary">
                            <h4>Debug Log</h4>
                            {!previewResult ? (
                                <p className="empty-debug">Run preview to see logs</p>
                            ) : (
                                <div className="debug-tiny-list">
                                    {previewResult.debug.map((item, idx) => (
                                        <div key={idx} className={`tiny-item ${item.visible ? 'visible' : 'hidden'}`}>
                                            <span className="tiny-icon">{item.visible ? '✓' : '✗'}</span>
                                            <span className="tiny-text">{item.widgetType}: {item.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="visual-preview-area" ref={previewViewportRef}>
                        {!previewResult ? (
                            <div className="preview-placeholder">
                                <AlertCircle size={48} className="placeholder-icon" />
                                <p>Click "Run Preview" to generate the invitation card visual based on the current context.</p>
                            </div>
                        ) : (
                            <div
                                className="preview-fit-shell"
                                style={{
                                    width: `${previewScaledWidth}px`,
                                    height: `${previewScaledHeight}px`
                                }}
                            >
                                <div
                                    className="preview-fit-stage"
                                    style={{
                                        width: `${previewCanvasBaseWidth}px`,
                                        height: `${previewCanvasHeight}px`,
                                        transform: `scale(${previewFitScale})`
                                    }}
                                >
                                    <InvitationCanvasRenderer
                                        project={{
                                            cover_template_snapshot: previewResult,
                                            event: previewResult?.event || designData?.event || null
                                        }}
                                        recipient={{
                                            public_token: null,
                                            display_name: context.language === 'ar' ? 'ضيف تجريبي' : 'Preview Guest',
                                            display_name_ar: 'ضيف تجريبي',
                                            metadata: {}
                                        }}
                                        language={context.language}
                                        hasRsvpPage={false}
                                        rsvpCompleted={false}
                                        onOpenRsvp={() => {}}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatEventLocation(event) {
    const venue = event?.venue || '';
    const address = [
        event?.address_street,
        event?.address_district,
        event?.address_city,
        event?.address_region,
        event?.address_building_number && `Bldg ${event.address_building_number}`,
        event?.address_additional_number && `Addl ${event.address_additional_number}`,
        event?.address_unit_number && `Unit ${event.address_unit_number}`,
        event?.address_postal_code && `P.O. ${event.address_postal_code}`
    ].filter(Boolean).join(', ');

    if (venue && address) {
        return { venue, address };
    }

    if (address) {
        return { venue: address, address: '' };
    }

    return { venue, address: '' };
}

function getGuestPosition(content) {
    return (content.position || '').trim();
}

function PreviewWidget({ widget, context, eventData }) {
    const content = widget.content?.[context.language] || widget.content?.ar || widget.content?.en || widget.content || {};
    const isLogoWidget = widget.type === 'logo';
    const style = {
        textAlign: widget.style?.textAlign,
        color: widget.style?.color,
        backgroundColor: widget.style?.backgroundColor,
        padding: isLogoWidget ? 0 : widget.style?.padding ? `${widget.style.padding}px` : undefined,
        fontSize: widget.style?.fontSize ? `${widget.style.fontSize}px` : undefined,
        fontWeight: widget.style?.fontWeight,
        fontFamily: widget.style?.fontFamily,
    };

    switch (widget.type) {
        case 'text':
            return <div style={style} className="preview-widget text-widget">{content.text || 'Sample Text'}</div>;

        case 'image':
            return (
                <div style={style} className="preview-widget image-widget">
                    {content.url ? (
                        <img src={resolvePreviewAssetUrl(content.url)} alt={content.alt || 'Widget'} style={{ maxWidth: '100%', height: 'auto' }} />
                    ) : (
                        <div className="image-placeholder">Image</div>
                    )}
                </div>
            );

        case 'logo':
            return (
                <div style={style} className="preview-widget image-widget">
                    {content.url ? (
                        <img src={resolvePreviewAssetUrl(content.url)} alt={content.alt || 'Logo'} style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }} />
                    ) : (
                        <div className="image-placeholder">Logo</div>
                    )}
                </div>
            );

        case 'event_details':
            {
                const eventLocation = formatEventLocation(eventData);

                return (
                    <div style={style} className="preview-widget details-widget">
                        {(content.showDate !== false || content.showTime !== false) && (
                            <div className="detail-row detail-row-inline">
                                <span>
                                    {[
                                        content.showDate !== false ? (eventData ? '20 Oct 2025' : '20 Oct 2025') : null,
                                        content.showTime !== false ? (eventData ? '18:00 PM' : '18:00 PM') : null
                                    ].filter(Boolean).join(' · ')}
                                </span>
                            </div>
                        )}
                        {(content.showVenue !== false) && (
                            eventData?.location_mode !== 'manual' && eventData?.google_map_url ? (
                                <a className="detail-row detail-row-link" href={eventData.google_map_url} target="_blank" rel="noreferrer">
                                    <MapPin size={16} />
                                    <span>{eventLocation.venue || 'Open in Google Maps'}</span>
                                </a>
                            ) : (
                                <div className="detail-row detail-row-stack">
                                    <MapPin size={16} />
                                    <div>
                                        <span>{eventLocation.venue || 'Venue not set'}</span>
                                        {eventLocation.address && <small>{eventLocation.address}</small>}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                );
            }

        case 'guest_name':
            {
                const guestPosition = getGuestPosition(content);

                return (
                    <div style={style} className="preview-widget guest-widget">
                        {content.prefix && <span className="guest-prefix" style={{ font: 'inherit', color: 'inherit' }}>{content.prefix} </span>}
                        <span className="guest-name" style={{ font: 'inherit', color: 'inherit' }}>John Doe</span>
                        {guestPosition && <span className="guest-position" style={{ font: 'inherit', color: 'inherit' }}>{guestPosition}</span>}
                    </div>
                );
            }

        case 'response':
            return (
                <div style={style} className="preview-widget response-widget">
                    <button className="response-btn" type="button" style={{ font: 'inherit' }}>
                        {content.label || 'Confirm attendance'}
                    </button>
                </div>
            );

        case 'qr_code':
            return (
                <div style={style} className="preview-widget qr-widget">
                    {content.label && <div className="qr-label">{content.label}</div>}
                    <div className="qr-placeholder">QR CODE</div>
                </div>
            );

        case 'voice_recorder':
            return (
                <div style={style} className="preview-widget voice-widget">
                    {content.label && <div className="voice-label">{content.label}</div>}
                    <button className="voice-btn">🎤 Record Voice</button>
                    <div className="voice-note">Max: {content.maxDuration || 60}s</div>
                </div>
            );

        case 'text_submission':
            return (
                <div style={style} className="preview-widget submission-widget">
                    {content.label && <div className="submission-label">{content.label}</div>}
                    <textarea className="submission-input" placeholder={content.placeholder || 'Type here...'} disabled></textarea>
                </div>
            );

        case 'survey':
            return (
                <div style={style} className="preview-widget survey-widget">
                    <div className="survey-question">Do you need transportation?</div>
                    <div className="survey-options">
                        <label><input type="radio" disabled /> Yes</label>
                        <label><input type="radio" disabled /> No</label>
                    </div>
                </div>
            );

        case 'calendar_links':
            return (
                <div style={style} className="preview-widget calendar-widget">
                    <button className="cal-btn">Add to Calendar</button>
                </div>
            );

        case 'location_map':
            return (
                <div style={style} className="preview-widget map-widget">
                    <button className="map-btn">📍 Open Location Map</button>
                </div>
            );
        case 'instructions_link':
            return (
                <div style={style} className="preview-widget map-widget">
                    <button className="map-btn">📘 {content.label || 'Instructions'}</button>
                </div>
            );

        default:
            return <div className="preview-widget unknown">Unknown Widget: {widget.type}</div>;
    }
}
