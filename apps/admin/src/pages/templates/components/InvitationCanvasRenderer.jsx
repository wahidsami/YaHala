import { MapPin } from 'lucide-react';
import QRCode from 'react-qr-code';
import api from '../../../services/api';
import { buildCanvasBackgroundStyle, normalizeLayout } from '../backgroundUtils';

function localizedText(language, valueEn, valueAr) {
    return language === 'ar' ? (valueAr || valueEn || '') : (valueEn || valueAr || '');
}

function formatDate(language, value) {
    if (!value) {
        return '';
    }

    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(value));
}

function formatTime(language, value) {
    if (!value) {
        return '';
    }

    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value));
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

function getStorageBaseUrl() {
    const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    return baseUrl.replace(/\/api\/?$/, '');
}

function resolveStorageUrl(storagePath) {
    if (!storagePath) {
        return '';
    }

    if (/^(https?:\/\/|data:|blob:|mailto:|tel:)/i.test(storagePath)) {
        return storagePath;
    }

    if (storagePath.startsWith('/storage/') || storagePath.startsWith('storage/')) {
        const normalizedPath = storagePath.startsWith('/storage/') ? storagePath : `/${storagePath}`;
        return `${getStorageBaseUrl()}${normalizedPath}`;
    }

    if (storagePath.startsWith('/')) {
        return `${window.location.origin}${storagePath}`;
    }

    return `${window.location.origin}/${storagePath}`;
}

function getWidgetContent(widget, language) {
    return widget?.content?.[language] || widget?.content?.ar || widget?.content?.en || {};
}

function getGuestPosition(recipient, content) {
    return (
        content.position ||
        recipient?.position ||
        recipient?.metadata?.position ||
        recipient?.metadata?.guestPosition ||
        ''
    ).trim();
}

function buildInvitationUrl(token) {
    if (!token) {
        return '';
    }
    return `${window.location.origin}/invite/${token}`;
}

function getWidgetFrameStyle(widget, index = 0) {
    const geometry = widget?.geometry || {};
    const left = Number.isFinite(Number(geometry.x)) ? Number(geometry.x) : 20;
    const top = Number.isFinite(Number(geometry.y)) ? Number(geometry.y) : 20;
    const width = Number.isFinite(Number(geometry.w)) ? Number(geometry.w) : Number.isFinite(Number(geometry.width)) ? Number(geometry.width) : 280;
    const height = Number.isFinite(Number(geometry.h)) ? Number(geometry.h) : Number.isFinite(Number(geometry.height)) ? Number(geometry.height) : 80;
    const zIndex = Number.isFinite(Number(geometry.zIndex)) ? Number(geometry.zIndex) : index + 1;

    return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex
    };
}

function getCanvasWidgets(coverTemplate) {
    const sections = coverTemplate?.sections || {};
    const preferredOrder = ['header', 'body', 'footer'];
    const orderedSections = [
        ...preferredOrder
            .filter((sectionId) => sections?.[sectionId])
            .map((sectionId) => sections[sectionId]),
        ...Object.entries(sections)
            .filter(([sectionId]) => !preferredOrder.includes(sectionId))
            .map(([, section]) => section)
    ];

    return orderedSections.flatMap((section) => section.widgets || []);
}

export function computeEffectiveCanvasHeight(layout, widgets = []) {
    const savedHeight = Math.max(640, Number(layout?.height) || 640);
    const widgetBottom = widgets.reduce((max, widget) => {
        const geometry = widget?.geometry || {};
        const y = Number.isFinite(Number(geometry.y)) ? Number(geometry.y) : 20;
        const h = Number.isFinite(Number(geometry.h))
            ? Number(geometry.h)
            : (Number.isFinite(Number(geometry.height)) ? Number(geometry.height) : 80);
        return Math.max(max, y + h);
    }, 0);

    return Math.max(savedHeight, widgetBottom + 24);
}

function getPublicRuleContext(project, recipient) {
    const metadata = recipient?.metadata || {};
    const rawScanStatus = metadata.attendance_status || metadata.check_in_status;
    const scanState = rawScanStatus === 'attended' || rawScanStatus === 'checked_in'
        ? 'checked_in'
        : 'not_scanned';
    const now = Date.now();
    const eventStart = project?.event?.start_datetime ? new Date(project.event.start_datetime).getTime() : null;
    const eventEnd = project?.event?.end_datetime ? new Date(project.event.end_datetime).getTime() : null;
    let timeState = 'before_event';

    if (Number.isFinite(eventStart) && Number.isFinite(eventEnd)) {
        if (now >= eventEnd) {
            timeState = 'after_event';
        } else if (now >= eventStart) {
            timeState = 'during_event';
        }
    }

    return {
        timeState,
        scanState,
        eventType: project?.event?.event_type || '',
        guestGroup: metadata.guestGroup || metadata.guest_group || 'regular'
    };
}

function evaluateWidgetCondition(condition, context) {
    const key = `${condition?.type}.${condition?.operator}`;

    switch (key) {
        case 'time.before_event_start':
            return context.timeState === 'before_event';
        case 'time.during_event':
            return context.timeState === 'during_event';
        case 'time.after_event_end':
            return context.timeState === 'after_event';
        case 'scan.checked_in':
            return context.scanState === 'checked_in';
        case 'scan.not_scanned':
            return context.scanState === 'not_scanned';
        case 'event.type_is':
            return context.eventType === condition.value;
        case 'guest.group_is':
            return context.guestGroup === condition.value;
        default:
            return false;
    }
}

function isWidgetVisible(widget, context) {
    if (typeof widget?._visible === 'boolean') {
        return widget._visible;
    }

    const rules = Array.isArray(widget?.rules) ? widget.rules : [];
    if (!rules.length) {
        return true;
    }

    for (const rule of rules) {
        const conditions = Array.isArray(rule?.conditions) ? rule.conditions : [];
        if (!conditions.length) {
            continue;
        }

        const results = conditions.map((condition) => evaluateWidgetCondition(condition, context));
        const matched = rule.conditionLogic === 'or'
            ? results.some(Boolean)
            : results.every(Boolean);

        if (matched) {
            return rule.action !== 'hide';
        }
    }

    return true;
}

export function InvitationWidgetPreview({ widget, language, project, recipient, mode = 'public', hasRsvpPage = false, rsvpCompleted = false, onOpenRsvp }) {
    const content = getWidgetContent(widget, language);
    const isLogoWidget = widget.type === 'logo';
    const style = {
        textAlign: widget?.style?.textAlign,
        color: widget?.style?.color,
        backgroundColor: widget?.type === 'qr_code' ? undefined : widget?.style?.backgroundColor,
        padding: isLogoWidget ? 0 : widget?.style?.padding ? `${widget.style.padding}px` : undefined,
        fontSize: widget?.style?.fontSize ? `${widget.style.fontSize}px` : undefined,
        fontWeight: widget?.style?.fontWeight,
        borderRadius: widget?.style?.borderRadius ? `${widget.style.borderRadius}px` : undefined,
        fontFamily: widget?.style?.fontFamily
    };

    switch (widget.type) {
        case 'text':
            return (
                <div style={style} className="preview-widget text-widget">
                    {content.text || localizedText(language, 'Text block', 'كتلة نصية')}
                </div>
            );
        case 'image':
            return (
                <div style={style} className="preview-widget image-widget">
                    {content.url ? (
                        <img src={resolveStorageUrl(content.url)} alt={content.alt || 'Widget'} style={{ maxWidth: '100%', height: 'auto' }} />
                    ) : (
                        <div className="image-placeholder">Image</div>
                    )}
                </div>
            );
        case 'logo':
            return (
                <div style={style} className="preview-widget image-widget">
                    {content.url ? (
                        <img src={resolveStorageUrl(content.url)} alt={content.alt || 'Logo'} style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }} />
                    ) : (
                        <div className="image-placeholder">Logo</div>
                    )}
                </div>
            );
        case 'event_details': {
            const eventLocation = formatEventLocation(project?.event);

            return (
                <div style={style} className="preview-widget details-widget">
                    {(content.showDate !== false || content.showTime !== false) && (
                        <div className="detail-row detail-row-inline">
                                <span>
                                    {[
                                        content.showDate !== false ? formatDate(language, project?.event?.start_datetime) : null,
                                        content.showTime !== false ? formatTime(language, project?.event?.start_datetime) : null
                                    ].filter(Boolean).join(' · ')}
                                </span>
                            </div>
                        )}
                        {(content.showVenue !== false) && (
                            project?.event?.location_mode !== 'manual' && project?.event?.google_map_url ? (
                                <a
                                    className="detail-row detail-row-link"
                                    href={project.event.google_map_url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                <MapPin size={16} />
                                <span>{eventLocation.venue || localizedText(language, 'Open in Google Maps', 'افتح على خرائط جوجل')}</span>
                            </a>
                        ) : (
                            <div className="detail-row detail-row-stack">
                                <MapPin size={16} />
                                <div>
                                    <span>{eventLocation.venue || localizedText(language, 'Venue not set', 'لم يتم تحديد المكان')}</span>
                                    {eventLocation.address && <small>{eventLocation.address}</small>}
                                </div>
                            </div>
                        )
                    )}
                </div>
            );
        }
        case 'guest_name': {
            const guestPosition = getGuestPosition(recipient, content);
            const guestLabel = mode === 'builder'
                ? localizedText(language, 'Guest Name', 'اسم الضيف')
                : localizedText(language, recipient.display_name, recipient.display_name_ar);

            return (
                <div style={style} className="preview-widget guest-widget">
                    <span className="guest-prefix" style={{ font: 'inherit', color: 'inherit' }}>{content.prefix || localizedText(language, 'Welcome', 'مرحباً')} </span>
                    <span className="guest-name" style={{ font: 'inherit', color: 'inherit' }}>{guestLabel}</span>
                    {guestPosition && <span className="guest-position" style={{ font: 'inherit', color: 'inherit' }}>{guestPosition}</span>}
                </div>
            );
        }
        case 'response': {
            const label = content.label || localizedText(language, 'Confirm attendance', 'تأكيد الحضور');

            if (mode !== 'builder' && (!hasRsvpPage || rsvpCompleted || recipient?.overall_status === 'responded')) {
                return null;
            }

            return (
                <div style={style} className="preview-widget response-widget">
                    <button
                        type="button"
                        className="response-btn"
                        style={{ font: 'inherit' }}
                        onClick={mode === 'public' ? onOpenRsvp : undefined}
                    >
                        {label}
                    </button>
                </div>
            );
        }
        case 'qr_code': {
            const invitationUrl = mode === 'builder' ? '' : buildInvitationUrl(recipient.public_token);
            const qrColor = content?.qrColor || widget?.style?.color || '#111827';
            const qrBackground = content?.qrBackground || widget?.style?.backgroundColor || '#ffffff';

            return (
                <div style={style} className="preview-widget qr-widget">
                    {content.label && <div className="qr-label">{content.label}</div>}
                    <div className="qr-artwork">
                        {invitationUrl ? (
                            <QRCode
                                value={invitationUrl}
                                size={256}
                                fgColor={qrColor}
                                bgColor={qrBackground}
                                level="M"
                                className="qr-image"
                            />
                        ) : (
                            <div className="qr-placeholder">QR CODE</div>
                        )}
                    </div>
                    {mode !== 'builder' && recipient.public_token ? <small className="qr-token">{recipient.public_token}</small> : null}
                </div>
            );
        }
        case 'voice_recorder':
            return (
                <div style={style} className="preview-widget voice-widget">
                    {content.label && <div className="voice-label">{content.label}</div>}
                    <button className="voice-btn" type="button">🎤 Record Voice</button>
                    <div className="voice-note">Max: {content.maxDuration || 60}s</div>
                </div>
            );
        case 'text_submission':
            return (
                <div style={style} className="preview-widget submission-widget">
                    {content.label && <div className="submission-label">{content.label}</div>}
                    <textarea className="submission-input" placeholder={content.placeholder || 'Type here...'} disabled />
                </div>
            );
        case 'survey':
            return (
                <div style={style} className="preview-widget survey-widget">
                    <div className="survey-question">{content.label || localizedText(language, 'Interactive module', 'وحدة تفاعلية')}</div>
                    <div className="survey-options">
                        <label><input type="radio" disabled /> {localizedText(language, 'Yes', 'نعم')}</label>
                        <label><input type="radio" disabled /> {localizedText(language, 'No', 'لا')}</label>
                    </div>
                </div>
            );
        case 'calendar_links':
            return (
                <div style={style} className="preview-widget calendar-widget">
                    <button className="cal-btn" type="button">Add to Calendar</button>
                </div>
            );
        case 'location_map':
            return (
                <div style={style} className="preview-widget map-widget">
                    <button className="map-btn" type="button">📍 Open Location Map</button>
                </div>
            );
        default:
            return (
                <div style={style} className="preview-widget unknown">
                    {widget.type.replace('_', ' ')}
                </div>
            );
    }
}

export default function InvitationCanvasRenderer({
    project,
    recipient,
    language,
    hasRsvpPage,
    rsvpCompleted,
    onOpenRsvp,
    minCanvasHeight = 0
}) {
    const coverTemplate = project.cover_template_snapshot || project.cover_template?.design_data;
    const layout = normalizeLayout(coverTemplate?.layout || {});
    const canvasWidgets = getCanvasWidgets(coverTemplate);
    const publicRuleContext = getPublicRuleContext(project, recipient);
    const visibleWidgets = canvasWidgets.filter((widget) => isWidgetVisible(widget, publicRuleContext));
    const computedCanvasHeight = computeEffectiveCanvasHeight(layout, visibleWidgets);
    const canvasHeight = Math.max(computedCanvasHeight, Number(minCanvasHeight) || 0);
    const inlineResponseWidget = canvasWidgets.some((widget) => widget.type === 'response');

    if (!visibleWidgets.length) {
        return null;
    }

    return (
        <div className="invitation-canvas-view invitation-canvas">
            <div className="template-canvas-stage">
                <div
                    className="public-invite-canvas public-canvas-stage"
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                    style={{
                        ...buildCanvasBackgroundStyle(layout),
                        height: `${canvasHeight}px`
                    }}
                >
                    <div className="preview-effects-layer" aria-hidden="true">
                        {Array.isArray(layout.backgroundEffects) && layout.backgroundEffects.map((effect) => (
                            <div
                                key={effect.id}
                                className={`preview-effect preview-effect-${effect.previewVariant || effect.type}`}
                                style={{
                                    '--effect-opacity': effect.opacity ?? 0.18,
                                    '--effect-speed': `${Math.max(1, Number(effect.speed) || 1)}s`,
                                    '--effect-amount': `${Math.max(0, Number(effect.amount) || 0)}`,
                                    '--effect-color': effect.color || '#ffffff'
                                }}
                            />
                        ))}
                    </div>

                    {visibleWidgets.map((widget, index) => (
                        <div
                            key={widget.id || `${widget.type}-${index}`}
                            className="public-widget-frame"
                            style={getWidgetFrameStyle(widget, index)}
                        >
                            <InvitationWidgetPreview
                                widget={widget}
                                language={language}
                                project={project}
                                recipient={recipient}
                                hasRsvpPage={hasRsvpPage}
                                rsvpCompleted={rsvpCompleted}
                                onOpenRsvp={onOpenRsvp}
                                mode="public"
                            />
                        </div>
                    ))}
                </div>
            </div>
            {hasRsvpPage && !inlineResponseWidget && !rsvpCompleted && (
                <div className="card-action-row">
                    <button type="button" className="rsvp-launch-btn rsvp-launch-inline" onClick={onOpenRsvp}>
                        {localizedText(language, 'Confirm attendance', 'تأكيد الحضور')}
                    </button>
                </div>
            )}
        </div>
    );
}
