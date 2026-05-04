import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Loader2, Sparkles, MapPin, X } from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { normalizeLayout } from '../templates/backgroundUtils';
import InvitationCanvasRenderer from '../templates/components/InvitationCanvasRenderer';
import './PublicInvitationPage.css';

const COPY = {
    en: {
        invitation: 'Invitation',
        welcomeBack: 'Welcome',
        hostedBy: 'Hosted by',
        eventDetails: 'Event details',
        language: 'Language',
        overview: 'Overview',
        cover: 'Cover',
        rsvp: 'RSVP',
        poll: 'Poll',
        questionnaire: 'Questionnaire',
        quiz: 'Quiz',
        competition: 'Competition',
        terms: 'Terms',
        custom: 'Custom',
        attendance: 'Will you attend?',
        attending: 'Attending',
        notAttending: 'Not attending',
        maybe: 'Maybe',
        guestCount: 'Guest count',
        notes: 'Notes',
        notesPlaceholder: 'Add a short note for the host',
        submit: 'Submit RSVP',
        submitting: 'Submitting...',
        confirmAttendance: 'Confirm attendance',
        close: 'Close',
        thanksTitle: 'Thanks for confirming',
        thanksCopy: 'Your response has been saved. The host has been notified.',
        openCard: 'Open invitation',
        copyLink: 'Copy link',
        interactiveSoon: 'Interactive page',
        interactiveSoonCopy: 'This tab is ready for future questionnaire, quiz, competition, and terms modules.',
        vote: 'Vote',
        results: 'Results',
        resultsHidden: 'Results are hidden until the configured reveal time.',
        pollAnonymous: 'Anonymous poll',
        pollNamed: 'Named poll',
        pollMultiple: 'Multiple choice',
        singleChoice: 'Single choice',
        loginRequired: 'Login required',
        guestAccess: 'Guest access',
        totalVotes: 'Total votes',
        maxVotesPerUser: 'votes per user',
        resultsTiming: 'Results timing',
        resultsImmediately: 'Immediately',
        resultsAfterVote: 'After voting',
        resultsAfterEnd: 'After poll ends',
        resultsHiddenLabel: 'Hidden',
        noPollOptions: 'No poll options have been configured yet.',
        pollUnavailable: 'This poll is not available for voting yet.',
        pollVotingClosed: 'Voting is closed for this poll.',
        pollVoteSuccess: 'Your vote has been recorded.',
        selectAtLeastOne: 'Please select at least one option.',
        copied: 'Link copied'
    },
    ar: {
        invitation: 'دعوة',
        welcomeBack: 'مرحباً',
        hostedBy: 'يستضيفه',
        eventDetails: 'تفاصيل الفعالية',
        language: 'اللغة',
        overview: 'نظرة عامة',
        cover: 'الغلاف',
        rsvp: 'تأكيد الحضور',
        poll: 'استطلاع',
        questionnaire: 'الاستبيان',
        quiz: 'الاختبار',
        competition: 'المسابقة',
        terms: 'الشروط',
        custom: 'محتوى مخصص',
        attendance: 'هل ستحضر؟',
        attending: 'سأحضر',
        notAttending: 'لن أحضر',
        maybe: 'ربما',
        guestCount: 'عدد الضيوف',
        notes: 'ملاحظات',
        notesPlaceholder: 'أضف ملاحظة قصيرة للمضيف',
        submit: 'إرسال الرد',
        submitting: 'جاري الإرسال...',
        confirmAttendance: 'تأكيد الحضور',
        close: 'إغلاق',
        thanksTitle: 'شكراً لتأكيدك',
        thanksCopy: 'تم حفظ ردك وسيتم إشعار المضيف.',
        openCard: 'فتح الدعوة',
        copyLink: 'نسخ الرابط',
        interactiveSoon: 'صفحة تفاعلية',
        interactiveSoonCopy: 'هذه الصفحة جاهزة لاحقاً للاستبيان والاختبار والمسابقات والشروط.',
        vote: 'صوّت',
        results: 'النتائج',
        resultsHidden: 'النتائج مخفية حتى وقت الإظهار المحدد.',
        pollAnonymous: 'استطلاع مجهول',
        pollNamed: 'استطلاع معروف',
        pollMultiple: 'تعدد الاختيارات',
        singleChoice: 'اختيار واحد',
        loginRequired: 'يتطلب تسجيل الدخول',
        guestAccess: 'وصول الضيوف',
        totalVotes: 'إجمالي الأصوات',
        maxVotesPerUser: 'أصوات لكل مستخدم',
        resultsTiming: 'توقيت النتائج',
        resultsImmediately: 'فوراً',
        resultsAfterVote: 'بعد التصويت',
        resultsAfterEnd: 'بعد انتهاء الاستطلاع',
        resultsHiddenLabel: 'مخفية',
        noPollOptions: 'لم يتم إعداد أي خيارات للاستطلاع بعد.',
        pollUnavailable: 'هذا الاستطلاع غير متاح للتصويت حالياً.',
        pollVotingClosed: 'تم إغلاق التصويت لهذا الاستطلاع.',
        pollVoteSuccess: 'تم تسجيل صوتك بنجاح.',
        selectAtLeastOne: 'الرجاء اختيار خيار واحد على الأقل.',
        copied: 'تم نسخ الرابط'
    }
};

const PAGE_LABELS = {
    cover: { en: 'Cover', ar: 'الغلاف' },
    rsvp: { en: 'RSVP', ar: 'تأكيد الحضور' },
    poll: { en: 'Poll', ar: 'استطلاع' },
    questionnaire: { en: 'Questionnaire', ar: 'الاستبيان' },
    quiz: { en: 'Quiz', ar: 'الاختبار' },
    competition: { en: 'Competition', ar: 'المسابقة' },
    terms: { en: 'Terms', ar: 'الشروط' },
    custom: { en: 'Custom', ar: 'محتوى مخصص' }
};

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
        recipient.position ||
        recipient.metadata?.position ||
        recipient.metadata?.guestPosition ||
        ''
    ).trim();
}

function getWidgetStyle(widget) {
    return {
        color: widget?.style?.color,
        backgroundColor: widget?.style?.backgroundColor,
        textAlign: widget?.style?.textAlign || 'center',
        fontSize: widget?.style?.fontSize ? `${widget.style.fontSize}px` : undefined,
        padding: widget?.style?.padding ? `${widget.style.padding}px` : undefined,
        borderRadius: widget?.style?.borderRadius ? `${widget.style.borderRadius}px` : undefined,
        fontFamily: widget?.style?.fontFamily
    };
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

function buildQrImageUrl(token) {
    if (!token) {
        return null;
    }

    const invitationUrl = `${window.location.origin}/invite/${token}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=384x384&margin=24&data=${encodeURIComponent(invitationUrl)}`;
}

function WidgetPreview({ widget, language, project, recipient }) {
    const content = getWidgetContent(widget, language);
    const isLogoWidget = widget.type === 'logo';
    const style = {
        textAlign: widget?.style?.textAlign,
        color: widget?.style?.color,
        backgroundColor: widget?.style?.backgroundColor,
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
                        <img src={content.url} alt={content.alt || 'Widget'} style={{ maxWidth: '100%', height: 'auto' }} />
                    ) : (
                        <div className="image-placeholder">Image</div>
                    )}
                </div>
            );
        case 'logo':
            return (
                <div style={style} className="preview-widget image-widget">
                    {content.url ? (
                        <img src={content.url} alt={content.alt || 'Logo'} style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }} />
                    ) : (
                        <div className="image-placeholder">Logo</div>
                    )}
                </div>
            );
        case 'event_details': {
            const eventLocation = formatEventLocation(project.event);

            return (
                <div style={style} className="preview-widget details-widget">
                    {(content.showDate !== false || content.showTime !== false) && (
                        <div className="detail-row detail-row-inline">
                            <span>
                                {[
                                    content.showDate !== false ? formatDate(language, project.event?.start_datetime) : null,
                                    content.showTime !== false ? formatTime(language, project.event?.start_datetime) : null
                                ].filter(Boolean).join(' · ')}
                            </span>
                        </div>
                    )}
                    {(content.showVenue !== false) && (
                        project.event?.location_mode !== 'manual' && project.event?.google_map_url ? (
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

            return (
                <div style={style} className="preview-widget guest-widget">
                    <span className="guest-prefix" style={{ font: 'inherit', color: 'inherit' }}>{content.prefix || localizedText(language, 'Welcome', 'مرحباً')} </span>
                    <span className="guest-name" style={{ font: 'inherit', color: 'inherit' }}>{localizedText(language, recipient.display_name, recipient.display_name_ar)}</span>
                    {guestPosition && <span className="guest-position" style={{ font: 'inherit', color: 'inherit' }}>{guestPosition}</span>}
                </div>
            );
        }
        case 'qr_code': {
            const qrImageUrl = buildQrImageUrl(recipient.public_token);

            return (
                <div style={style} className="preview-widget qr-widget">
                    {content.label && <div className="qr-label">{content.label}</div>}
                    {qrImageUrl ? (
                        <img src={qrImageUrl} alt="Invitation QR Code" className="qr-image" />
                    ) : (
                        <div className="qr-placeholder">QR CODE</div>
                    )}
                    <small className="qr-token">{recipient.public_token}</small>
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

function CoverPreview({ project, recipient, language, hasRsvpPage, rsvpCompleted, onOpenRsvp }) {
    const coverTemplate = project.cover_template_snapshot || project.cover_template?.design_data;
    const layout = normalizeLayout(coverTemplate?.layout || {});
    const canvasWidgets = getCanvasWidgets(coverTemplate);
    const canvasHeight = Math.max(640, Number(layout.height) || 640);

    if (!canvasWidgets.length) {
        return (
            <div className="fallback-cover">
                <span className="eyebrow">{localizedText(language, COPY[language].invitation, COPY[language].invitation)}</span>
                <h2>{localizedText(language, project.name, project.name_ar)}</h2>
                <p className="fallback-subtitle">{localizedText(language, project.event?.name, project.event?.name_ar)}</p>

                <div className="fallback-meta">
                    <div>
                        <span>{COPY[language].hostedBy}</span>
                        <strong>{localizedText(language, project.client?.name, project.client?.name_ar)}</strong>
                    </div>
                    <div>
                        <span>{COPY[language].eventDetails}</span>
                        <strong>{formatDate(language, project.event?.start_datetime)}</strong>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="template-preview template-canvas">
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

                    {canvasWidgets.map((widget, index) => (
                        <div
                            key={widget.id || `${widget.type}-${index}`}
                            className="public-widget-frame"
                            style={getWidgetFrameStyle(widget, index)}
                        >
                            <WidgetPreview
                                widget={widget}
                                language={language}
                                project={project}
                                recipient={recipient}
                            />
                        </div>
                    ))}
                </div>
            </div>
            {hasRsvpPage && !rsvpCompleted && (
                <div className="card-action-row">
                    <button type="button" className="rsvp-launch-btn rsvp-launch-inline" onClick={onOpenRsvp}>
                        {localizedText(language, COPY[language].confirmAttendance, COPY[language].confirmAttendance)}
                    </button>
                </div>
            )}
        </div>
    );
}

function RsvpPanel({ token, invitation, language, sessionToken, setSessionToken, onSubmitted }) {
    const copy = COPY[language];
    const [attendance, setAttendance] = useState('attending');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [submittedData, setSubmittedData] = useState(null);

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const response = await api.post(
                `/public/invitations/${token}/rsvp`,
                {
                    sessionToken,
                    language,
                    attendance,
                    notes
                },
                { skipAuthRefresh: true }
            );

            const nextSession = response.data?.data?.sessionToken || sessionToken;
            if (nextSession && nextSession !== sessionToken) {
                setSessionToken(nextSession);
                window.localStorage.setItem(`rawaj-public-session:${token}`, nextSession);
            }

            setSubmittedData(response.data.data);
            onSubmitted?.(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit RSVP');
        } finally {
            setSubmitting(false);
        }
    }

    if (submittedData) {
        return (
            <div className="rsvp-success">
                <div className="success-icon">
                    <CheckCircle2 size={28} />
                </div>
                <h3>{copy.thanksTitle}</h3>
                <p>{copy.thanksCopy}</p>
                <div className="success-summary">
                    <span>{COPY[language].attendance}</span>
                    <strong>{submittedData.attendance}</strong>
                </div>
            </div>
        );
    }

    return (
        <form className="rsvp-form" onSubmit={handleSubmit}>
            <div className="form-block">
                <label>{copy.attendance}</label>
                <div className="choice-grid">
                    {[
                        { value: 'attending', label: copy.attending },
                        { value: 'not_attending', label: copy.notAttending },
                        { value: 'maybe', label: copy.maybe }
                    ].map((choice) => (
                        <button
                            key={choice.value}
                            type="button"
                            className={`choice-card ${attendance === choice.value ? 'selected' : ''}`}
                            onClick={() => setAttendance(choice.value)}
                        >
                            {choice.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="form-block">
                <label htmlFor="notes">{copy.notes}</label>
                <textarea
                    id="notes"
                    rows="4"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={copy.notesPlaceholder}
                />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button className="submit-btn" type="submit" disabled={submitting}>
                {submitting ? <Loader2 size={18} className="spinner" /> : <ChevronRight size={18} />}
                <span>{submitting ? copy.submitting : copy.submit}</span>
            </button>
        </form>
    );
}

function PollPanel({ language, page, token, sessionToken, setSessionToken }) {
    const copy = COPY[language];
    const snapshot = page?.settings?.addon_snapshot || page?.settings?.poll_snapshot || {};
    const [pollState, setPollState] = useState(snapshot);
    const [selectedOptionIds, setSelectedOptionIds] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        setPollState(snapshot);
        setSelectedOptionIds([]);
        setSubmitting(false);
        setError('');
        setSubmitted(false);
    }, [snapshot.poll_id, page?.id]);

    const options = Array.isArray(pollState.options)
        ? [...pollState.options].sort((left, right) => (left.sort_order || 0) - (right.sort_order || 0))
        : [];
    const totalVotes = options.reduce((sum, option) => sum + (Number(option.votes_count) || 0), 0);
    const pollEnded = pollState.status === 'ended'
        || (pollState.end_date && !Number.isNaN(new Date(pollState.end_date).getTime()) && new Date(pollState.end_date).getTime() < Date.now());
    const canVote = pollState.status === 'published' && !pollEnded;
    const showResults = pollState.show_results_mode === 'immediately'
        || (submitted && pollState.show_results_mode === 'after_vote')
        || (pollState.show_results_mode === 'after_end' && pollEnded);
    const resultsModeLabel = {
        immediately: copy.resultsImmediately,
        after_vote: copy.resultsAfterVote,
        after_end: copy.resultsAfterEnd,
        hidden: copy.resultsHiddenLabel
    }[pollState.show_results_mode] || pollState.show_results_mode || copy.resultsAfterVote;
    const title = localizedText(language, page.title || pollState.title || copy.poll, page.title_ar || pollState.title_ar || copy.poll);
    const subtitle = localizedText(language, page.description || pollState.subtitle || '', page.description_ar || pollState.subtitle_ar || '');
    const primaryColor = pollState.theme_settings?.primary_color || pollState.theme_settings?.primaryColor || '#946FA7';
    const secondaryColor = pollState.theme_settings?.secondary_color || pollState.theme_settings?.secondaryColor || '#FF9D00';
    const isMultiple = Boolean(pollState.allow_multiple_choice);

    function toggleOption(optionId) {
        setError('');
        setSelectedOptionIds((current) => {
            if (isMultiple) {
                if (current.includes(optionId)) {
                    return current.filter((item) => item !== optionId);
                }
                return [...current, optionId];
            }

            return current[0] === optionId ? [] : [optionId];
        });
    }

    async function handleVote() {
        if (!selectedOptionIds.length) {
            setError(copy.selectAtLeastOne);
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const response = await api.post(
                `/public/invitations/${token}/pages/${page.page_key}/vote`,
                {
                    optionIds: selectedOptionIds,
                    language,
                    sessionToken: sessionToken || undefined
                },
                { skipAuthRefresh: true }
            );

            const nextPoll = response.data?.data?.poll;
            if (nextPoll) {
                setPollState(nextPoll);
            }
            const nextSessionToken = response.data?.data?.sessionToken;
            if (nextSessionToken) {
                setSessionToken?.(nextSessionToken);
                window.localStorage.setItem(`rawaj-public-session:${token}`, nextSessionToken);
            }
            setSubmitted(true);
        } catch (voteError) {
            setError(voteError.response?.data?.message || copy.pollUnavailable);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="module-panel module-panel-poll" style={{ '--poll-primary': primaryColor, '--poll-secondary': secondaryColor }}>
            <div className="panel-header">
                <span className="eyebrow">{copy.poll}</span>
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>

            <div className="poll-shell">
                <div className="poll-summary">
                    <div className="poll-summary-card">
                        <span className="poll-summary-label">{copy.results}</span>
                        <strong>{showResults ? totalVotes : '—'}</strong>
                        <small>{showResults ? `${totalVotes} ${copy.totalVotes}` : copy.resultsHidden}</small>
                    </div>
                    <div className="poll-summary-card">
                        <span className="poll-summary-label">{pollState.poll_mode === 'anonymous' ? copy.pollAnonymous : copy.pollNamed}</span>
                        <strong>{isMultiple ? copy.pollMultiple : copy.singleChoice}</strong>
                        <small>{pollState.require_login ? copy.loginRequired : copy.guestAccess}</small>
                    </div>
                    <div className="poll-summary-card">
                        <span className="poll-summary-label">{copy.resultsTiming}</span>
                        <strong>{resultsModeLabel}</strong>
                        <small>{pollState.max_votes_per_user || 1} {copy.maxVotesPerUser}</small>
                    </div>
                </div>

                <div className="poll-options-list">
                    {options.length === 0 ? (
                        <div className="poll-empty-state">{copy.noPollOptions}</div>
                    ) : (
                        options.map((option, index) => {
                            const votes = Number(option.votes_count) || 0;
                            const percent = showResults && totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                            const optionLabel = localizedText(language, option.text || `${copy.poll} ${index + 1}`, option.text_ar || option.text || `${copy.poll} ${index + 1}`);
                            const checked = selectedOptionIds.includes(option.id);
                            return (
                                <button
                                    key={option.id || `${option.sort_order}-${index}`}
                                    type="button"
                                    className={`poll-option-row ${checked ? 'selected' : ''}`}
                                    onClick={() => canVote && !submitted && toggleOption(option.id)}
                                    disabled={!canVote || submitting || submitted}
                                >
                                    <div className="poll-option-media" aria-hidden="true">
                                        {option.image_path ? (
                                            <img src={resolveStorageUrl(option.image_path)} alt="" />
                                        ) : option.icon_path ? (
                                            <img src={resolveStorageUrl(option.icon_path)} alt="" />
                                        ) : (
                                            <span className="poll-option-fallback">{index + 1}</span>
                                        )}
                                    </div>

                                    <div className="poll-option-copy">
                                        <strong>{optionLabel}</strong>
                                        {option.text_ar && option.text && option.text_ar !== option.text && (
                                            <span>{option.text_ar}</span>
                                        )}
                                        {showResults && (
                                            <div className="poll-progress" aria-hidden="true">
                                                <span style={{ width: `${percent}%` }} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="poll-option-stats">
                                        <strong>{showResults ? `${percent}%` : (checked ? '✓' : copy.vote)}</strong>
                                        <small>{showResults ? `${votes} ${copy.totalVotes.toLowerCase()}` : `${pollState.poll_mode === 'anonymous' ? copy.pollAnonymous : copy.pollNamed}`}</small>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {error && <div className="form-error">{error}</div>}

                {submitted && !showResults && (
                    <div className="status-banner success">{copy.pollVoteSuccess}</div>
                )}

                {canVote ? (
                    <button type="button" className="submit-btn poll-cta" onClick={handleVote} disabled={submitting || !selectedOptionIds.length || submitted}>
                        <span>{submitting ? copy.submitting : copy.vote}</span>
                    </button>
                ) : (
                    <div className="poll-empty-state">
                        {pollEnded ? copy.pollVotingClosed : copy.pollUnavailable}
                    </div>
                )}
            </div>
        </div>
    );
}

function PlaceholderPanel({ language, page }) {
    const copy = COPY[language];

    return (
        <div className="placeholder-panel">
            <span className="eyebrow">{copy.interactiveSoon}</span>
            <h3>{localizedText(language, page.title || PAGE_LABELS[page.page_type]?.en || page.page_type, page.title_ar || PAGE_LABELS[page.page_type]?.ar || page.page_type)}</h3>
            <p>{page.description || page.description_ar || copy.interactiveSoonCopy}</p>

            <div className="placeholder-chips">
                {(page.modules || []).map((module) => (
                    <span key={module.id} className="chip">
                        {localizedText(language, module.title || module.module_type, module.title_ar || module.module_type)}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function PublicInvitationPage() {
    const { token } = useParams();
    const { language, setLanguage } = useLanguage();
    const guestViewportRef = useRef(null);
    const [invitation, setInvitation] = useState(null);
    const [pages, setPages] = useState([]);
    const [activeLanguage, setActiveLanguage] = useState(language);
    const [activePageKey, setActivePageKey] = useState('cover');
    const [loading, setLoading] = useState(true);
    const [submittingOpen, setSubmittingOpen] = useState(false);
    const [showRsvpModal, setShowRsvpModal] = useState(false);
    const [rsvpCompleted, setRsvpCompleted] = useState(false);
    const [sessionToken, setSessionToken] = useState(() => {
        if (typeof window === 'undefined') {
            return null;
        }
        return window.localStorage.getItem(`rawaj-public-session:${token}`);
    });
    const [guestViewport, setGuestViewport] = useState({ width: 0, height: 0 });
    const [error, setError] = useState(null);
    const invitationReady = Boolean(invitation);

    function applyInvitationPayload(payload, syncLanguage = false) {
        setInvitation(payload);
        setPages(payload.pages || []);
        setRsvpCompleted(payload.recipient?.overall_status === 'responded');

        if (syncLanguage) {
            const resolvedLanguage = payload.language || payload.project?.default_language || 'ar';
            setActiveLanguage(resolvedLanguage);
            setLanguage(resolvedLanguage);
        }
    }

    useEffect(() => {
        let mounted = true;

        async function fetchInvitation() {
            setLoading(true);
            setError(null);

            try {
                const response = await api.get(`/public/invitations/${token}`, { skipAuthRefresh: true });

                if (!mounted) {
                    return;
                }

                applyInvitationPayload(response.data.data, true);
            } catch (err) {
                if (!mounted) {
                    return;
                }
                setError(err.response?.data?.message || 'Invitation not found');
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchInvitation();

        return () => {
            mounted = false;
        };
    }, [setLanguage, token]);

    useEffect(() => {
        if (!invitationReady) {
            return undefined;
        }

        let cancelled = false;

        async function refreshInvitation() {
            try {
                const response = await api.get(`/public/invitations/${token}`, { skipAuthRefresh: true });
                if (!cancelled) {
                    applyInvitationPayload(response.data.data, false);
                }
            } catch {
                // Best-effort refresh so the open page can reflect check-in changes.
            }
        }

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                refreshInvitation();
            }
        }

        const intervalId = window.setInterval(refreshInvitation, 10000);
        window.addEventListener('focus', refreshInvitation);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            window.removeEventListener('focus', refreshInvitation);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [invitationReady, token]);

    useEffect(() => {
        if (!invitation || submittingOpen) {
            return;
        }

        const storedSession = window.localStorage.getItem(`rawaj-public-session:${token}`);
        if (storedSession) {
            setSessionToken(storedSession);
        }

        setSubmittingOpen(true);
        api.post(
            `/public/invitations/${token}/open`,
            {
                sessionToken: storedSession || sessionToken,
                language: activeLanguage
            },
            { skipAuthRefresh: true }
        )
            .then((response) => {
                const nextToken = response.data.data.sessionToken;
                if (nextToken) {
                    window.localStorage.setItem(`rawaj-public-session:${token}`, nextToken);
                    setSessionToken(nextToken);
                }
            })
            .catch(() => {
                // Public open tracking is best-effort.
            });
    }, [activeLanguage, invitation, sessionToken, submittingOpen, token]);

    useEffect(() => {
        if (language !== activeLanguage) {
            setLanguage(activeLanguage);
        }
    }, [activeLanguage, language, setLanguage]);

    useEffect(() => {
        const element = guestViewportRef.current;
        if (!element) {
            return undefined;
        }

        const updateViewport = () => {
            setGuestViewport({
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
    }, [invitation]);

    const hasRsvpPage = pages.some((page) => page.page_type === 'rsvp' && page.is_enabled);
    const copy = COPY[activeLanguage];
    const coverLayout = useMemo(() => normalizeLayout(invitation?.project?.cover_template_snapshot?.layout || invitation?.project?.cover_template?.design_data?.layout || {}), [invitation?.project?.cover_template_snapshot?.layout, invitation?.project?.cover_template?.design_data?.layout]);
    const canvasBaseWidth = 360;
    const canvasHeight = Math.max(640, Number(coverLayout.height) || 640);
    const fitScale = useMemo(() => {
        const viewportWidth = guestViewport.width || 0;
        const viewportHeight = guestViewport.height || 0;

        if (!viewportWidth || !viewportHeight) {
            return 1;
        }

        const horizontalScale = (viewportWidth - 16) / canvasBaseWidth;
        const verticalScale = (viewportHeight - 16) / canvasHeight;
        return Math.min(1, horizontalScale, verticalScale);
    }, [canvasHeight, guestViewport.height, guestViewport.width]);
    const scaledWidth = canvasBaseWidth * fitScale;
    const scaledHeight = canvasHeight * fitScale;

    if (loading) {
        return (
            <div className="public-invitation-shell">
                <div className="public-loader">
                    <Loader2 size={30} className="spinner" />
                    <span>{copy?.invitation || 'Loading...'}</span>
                </div>
            </div>
        );
    }

    if (error || !invitation) {
        return (
            <div className="public-invitation-shell error-state">
                <div className="error-card">
                    <Sparkles size={28} />
                    <h1>Invitation unavailable</h1>
                    <p>{error || 'The invitation link could not be loaded.'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="public-invitation-shell public-guest-page" dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'}>
            <main className="guest-invitation-view" ref={guestViewportRef}>
                <div
                    className="guest-fit-shell"
                    style={{
                        width: `${scaledWidth}px`,
                        height: `${scaledHeight}px`
                    }}
                >
                    <div
                        className="guest-fit-stage"
                        style={{
                            width: `${canvasBaseWidth}px`,
                            height: `${canvasHeight}px`,
                            transform: `scale(${fitScale})`
                        }}
                    >
                        <InvitationCanvasRenderer
                            project={invitation.project}
                            recipient={invitation.recipient}
                            language={activeLanguage}
                            hasRsvpPage={hasRsvpPage}
                            rsvpCompleted={rsvpCompleted}
                            onOpenRsvp={() => setShowRsvpModal(true)}
                        />
                    </div>
                </div>

            {showRsvpModal && hasRsvpPage && !rsvpCompleted && (
                <div className="rsvp-modal-overlay" role="presentation" onClick={() => setShowRsvpModal(false)}>
                    <div className="rsvp-modal" role="dialog" aria-modal="true" aria-label={copy.confirmAttendance} onClick={(event) => event.stopPropagation()}>
                        <div className="rsvp-modal-header">
                            <div>
                                <span className="eyebrow">{copy.rsvp}</span>
                                <h3>{copy.confirmAttendance}</h3>
                            </div>
                            <button type="button" className="rsvp-modal-close" onClick={() => setShowRsvpModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <RsvpPanel
                            token={token}
                            invitation={invitation}
                            language={activeLanguage}
                            sessionToken={sessionToken}
                            setSessionToken={setSessionToken}
                            onSubmitted={() => {
                                setRsvpCompleted(true);
                                setShowRsvpModal(false);
                                setInvitation((prev) => (prev ? {
                                    ...prev,
                                    recipient: {
                                        ...prev.recipient,
                                        overall_status: 'responded'
                                    }
                                } : prev));
                            }}
                        />
                        <div className="rsvp-modal-actions">
                            <button type="button" className="ghost-link" onClick={() => setShowRsvpModal(false)}>
                                {copy.close}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </main>
        </div>
    );
}
