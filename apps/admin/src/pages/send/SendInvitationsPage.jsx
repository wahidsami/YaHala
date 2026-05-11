import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ArrowUpRight,
    CalendarDays,
    Check,
    ChevronRight,
    Clock3,
    Copy,
    Eye,
    Link2,
    Mail,
    MessageCircleMore,
    Search,
    Send,
    Sparkles,
    Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import './SendInvitationsPage.css';

const CHANNELS = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircleMore, accent: 'green' },
    { id: 'email', label: 'Email', icon: Mail, accent: 'rose' },
    { id: 'sms', label: 'SMS', icon: MessageCircleMore, accent: 'sand' },
    { id: 'link', label: 'Public Link', icon: Link2, accent: 'lavender' }
];

const AUDIENCES = [
    { id: 'newly_added', en: 'Newly Added', ar: 'المضافة حديثاً', hintEn: 'Draft recipients who have not been sent yet.', hintAr: 'مستلمون بحالة مسودة لم يتم الإرسال لهم بعد.' },
    { id: 'failed', en: 'Failed Only', ar: 'الفاشلة فقط', hintEn: 'Retry only failed deliveries.', hintAr: 'أعد المحاولة فقط للحالات الفاشلة.' },
    { id: 'sent_not_opened', en: 'Sent, Not Opened', ar: 'أُرسلت ولم تُفتح', hintEn: 'Guests who received the invite but have not opened it.', hintAr: 'ضيوف استلموا الدعوة لكن لم يفتحوها بعد.' },
    { id: 'opened_not_responded', en: 'Opened, No Response', ar: 'فُتحت دون رد', hintEn: 'Guests who opened the invite but still need follow-up.', hintAr: 'ضيوف فتحوا الدعوة وما زالوا بحاجة إلى متابعة.' },
    { id: 'custom_selected', en: 'Custom Selection', ar: 'اختيار مخصص', hintEn: 'Pick specific recipients already assigned to this event.', hintAr: 'اختر مستلمين محددين مرتبطين بهذه الفعالية.' }
];

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function formatEventDate(dateString, language) {
    if (!dateString) {
        return '';
    }
    const locale = language?.startsWith('ar') ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(new Date(dateString));
}

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
}

function insertAtCursor(value, token, inputRef) {
    const input = inputRef.current;
    if (!input) {
        return `${value}${token}`;
    }
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    return `${value.slice(0, start)}${token}${value.slice(end)}`;
}

function buildDefaultMessage(channel, i18n, event) {
    const eventName = localize(
        i18n,
        event?.name || 'your event',
        event?.name_ar || event?.name || 'فعاليتكم'
    );

    if (channel === 'email') {
        return localize(
            i18n,
            `Hello {{guest_name}},\n\nYou are invited to ${eventName}.\nOpen your invitation here: {{event_link}}\n\nWe would love to celebrate with you.`,
            `مرحباً {{guest_name}}،\n\nيسرنا دعوتك إلى ${eventName}.\nافتح دعوتك من هنا: {{event_link}}\n\nيسعدنا حضورك ومشاركتك الاحتفال.`
        );
    }

    if (channel === 'sms') {
        return localize(
            i18n,
            `Hi {{guest_name}}, you're invited to ${eventName}. Open your invite here: {{event_link}}`,
            `مرحباً {{guest_name}}، تمت دعوتك إلى ${eventName}. افتح الدعوة من هنا: {{event_link}}`
        );
    }

    if (channel === 'link') {
        return localize(
            i18n,
            `Share this invitation link with {{guest_name}}: {{event_link}}`,
            `شارك رابط الدعوة هذا مع {{guest_name}}: {{event_link}}`
        );
    }

    return localize(
        i18n,
        `Hi {{guest_name}},\n\nYou’re invited to ${eventName}.\nSee the invitation details here: {{event_link}}`,
        `مرحباً {{guest_name}}،\n\nتمت دعوتك إلى ${eventName}.\nيمكنك مشاهدة تفاصيل الدعوة هنا: {{event_link}}`
    );
}

function AudienceCard({ audience, count, isActive, i18n, onSelect }) {
    return (
        <button type="button" className={`send-audience-card ${isActive ? 'is-active' : ''}`} onClick={() => onSelect(audience.id)}>
            <strong>{localize(i18n, audience.en, audience.ar)}</strong>
            <span>{formatNumber(count)}</span>
        </button>
    );
}

function PreviewShell({ channel, title, subtitle, previewMessage, eventLine, ctaLabel }) {
    if (channel === 'email') {
        return (
            <div className="send-preview-shell send-preview-shell--email">
                <div className="send-preview-shell__frame">
                    <div className="send-preview-shell__emailbar">
                        <strong>{title}</strong>
                        <small>{subtitle}</small>
                    </div>
                    <div className="send-preview-shell__mailcard">
                        <span className="send-preview-shell__label">Subject</span>
                        <strong>{title}</strong>
                        <small>{eventLine}</small>
                        <div className="send-preview-shell__body">
                            {previewMessage.split('\n').map((line) => (
                                <p key={line}>{line}</p>
                            ))}
                        </div>
                        <button type="button">{ctaLabel}</button>
                    </div>
                </div>
            </div>
        );
    }

    if (channel === 'link') {
        return (
            <div className="send-preview-shell send-preview-shell--link">
                <div className="send-preview-shell__frame">
                    <div className="send-preview-shell__linkcard">
                        <span className="send-preview-shell__label">Share preview</span>
                        <strong>{title}</strong>
                        <small>{eventLine}</small>
                        <div className="send-preview-shell__body">
                            {previewMessage.split('\n').map((line) => (
                                <p key={line}>{line}</p>
                            ))}
                        </div>
                        <div className="send-preview-shell__linkpill">https://yahala.app/invite/...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`send-preview-shell send-preview-shell--chat send-preview-shell--${channel}`}>
            <div className="send-preview-shell__frame">
                <div className="send-preview-shell__chatbar">
                    <strong>{title}</strong>
                    <small>{subtitle}</small>
                </div>
                <div className="send-preview-shell__bubble">
                    {previewMessage.split('\n').map((line) => (
                        <p key={line}>{line}</p>
                    ))}
                </div>
                <div className="send-preview-shell__invitecard">
                    <span>{eventLine}</span>
                    <strong>{ctaLabel}</strong>
                </div>
            </div>
        </div>
    );
}

export default function SendInvitationsPage() {
    const { i18n } = useTranslation();
    const messageRef = useRef(null);
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [eventDetails, setEventDetails] = useState(null);
    const [summary, setSummary] = useState(null);
    const [guestRows, setGuestRows] = useState([]);
    const [recipientSearch, setRecipientSearch] = useState('');
    const [selectedRecipients, setSelectedRecipients] = useState([]);
    const [channel, setChannel] = useState('whatsapp');
    const [audience, setAudience] = useState('newly_added');
    const [message, setMessage] = useState('');
    const [messageTouched, setMessageTouched] = useState(false);
    const [scheduleMode, setScheduleMode] = useState('now');
    const [scheduledFor, setScheduledFor] = useState('');
    const [loading, setLoading] = useState(true);
    const [workspaceLoading, setWorkspaceLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;

        async function loadEvents() {
            setLoading(true);
            try {
                const response = await api.get('/admin/events?page=1&pageSize=200');
                if (!mounted) {
                    return;
                }
                const rows = response.data?.data || [];
                setEvents(rows);
                if (!selectedEventId && rows.length) {
                    setSelectedEventId(rows[0].id);
                }
            } catch (loadError) {
                console.error('Failed to load events for send workspace:', loadError);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadEvents();
        return () => {
            mounted = false;
        };
    }, [selectedEventId]);

    useEffect(() => {
        if (!selectedEventId) {
            return;
        }

        let mounted = true;

        async function loadEventWorkspace() {
            setWorkspaceLoading(true);
            setError('');

            const [eventRes, summaryRes, guestsRes] = await Promise.allSettled([
                api.get(`/admin/events/${selectedEventId}`),
                api.get(`/admin/events/${selectedEventId}/invitation-summary`),
                api.get(`/admin/events/${selectedEventId}/guest-directory?page=1&pageSize=100&status=all`)
            ]);

            if (!mounted) {
                return;
            }

            if (eventRes.status === 'fulfilled') {
                setEventDetails(eventRes.value.data?.data || null);
            } else {
                setEventDetails(null);
            }

            if (summaryRes.status === 'fulfilled') {
                setSummary(summaryRes.value.data?.data || null);
            } else {
                setSummary(null);
            }

            if (guestsRes.status === 'fulfilled') {
                setGuestRows(guestsRes.value.data?.data || []);
            } else {
                setGuestRows([]);
            }

            setSelectedRecipients([]);
            setWorkspaceLoading(false);
        }

        loadEventWorkspace();
        return () => {
            mounted = false;
        };
    }, [selectedEventId]);

    const activeEvent = useMemo(
        () => events.find((event) => event.id === selectedEventId) || eventDetails,
        [eventDetails, events, selectedEventId]
    );

    useEffect(() => {
        if (messageTouched) {
            return;
        }

        setMessage(buildDefaultMessage(channel, i18n, activeEvent));
    }, [activeEvent, channel, i18n, messageTouched]);

    const selectableRecipients = useMemo(() => {
        const query = recipientSearch.trim().toLowerCase();
        return guestRows
            .filter((row) => row.recipient_id)
            .filter((row) => {
                if (!query) {
                    return true;
                }

                return [row.name, row.email, row.organization, row.mobile_number]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(query));
            });
    }, [guestRows, recipientSearch]);

    const selectedRecipientRows = useMemo(
        () => selectableRecipients.filter((row) => selectedRecipients.includes(row.recipient_id)),
        [selectableRecipients, selectedRecipients]
    );

    const totals = summary?.totals || {};
    const totalRecipients = Number(totals.recipients || 0);
    const totalQueued = Number(totals.queued || 0);
    const totalSent = Number(totals.sent || 0);
    const totalDelivered = Number(totals.delivered || 0);
    const totalOpened = Number(totals.opened || 0);
    const totalResponded = Number(totals.responded || 0);
    const totalFailed = Number(totals.failed || 0);
    const totalDraft = Math.max(0, totalRecipients - totalQueued - totalSent - totalDelivered - totalOpened - totalResponded - totalFailed);

    const audienceCounts = {
        newly_added: totalDraft,
        failed: totalFailed,
        sent_not_opened: totalSent + totalDelivered,
        opened_not_responded: totalOpened,
        custom_selected: selectedRecipients.length
    };

    const recipientCount = audience === 'custom_selected'
        ? selectedRecipients.length
        : audienceCounts[audience] || 0;

    const selectionNote = audience === 'custom_selected'
        ? localize(
            i18n,
            `${selectedRecipients.length} recipients selected from this event.`,
            `تم تحديد ${selectedRecipients.length} مستلمين من هذه الفعالية.`
        )
        : localize(
            i18n,
            `${recipientCount} recipients match this audience.`,
            `يوجد ${recipientCount} مستلمين مطابقين لهذا الجمهور.`
        );

    const performanceCards = [
        {
            id: 'draft',
            label: localize(i18n, 'Ready to send', 'جاهزة للإرسال'),
            value: totalDraft,
            tone: 'peach'
        },
        {
            id: 'opened',
            label: localize(i18n, 'Opened', 'فُتحت'),
            value: totalOpened,
            tone: 'lavender'
        },
        {
            id: 'responded',
            label: localize(i18n, 'Responded', 'استجابوا'),
            value: totalResponded,
            tone: 'mint'
        },
        {
            id: 'failed',
            label: localize(i18n, 'Failed', 'فشلت'),
            value: totalFailed,
            tone: 'ink'
        }
    ];
    function toggleRecipient(recipientId) {
        setSelectedRecipients((current) => (
            current.includes(recipientId)
                ? current.filter((id) => id !== recipientId)
                : [...current, recipientId]
        ));
    }

    function toggleVisibleRecipients() {
        const visibleIds = selectableRecipients.map((row) => row.recipient_id);
        const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRecipients.includes(id));

        if (allVisibleSelected) {
            setSelectedRecipients((current) => current.filter((id) => !visibleIds.includes(id)));
            return;
        }

        setSelectedRecipients((current) => Array.from(new Set([...current, ...visibleIds])));
    }

    async function handleCopyPreview() {
        try {
            await navigator.clipboard.writeText(message);
            setNotice(localize(i18n, 'Preview copy saved to your clipboard.', 'تم حفظ نص المعاينة في الحافظة.'));
        } catch (copyError) {
            console.error('Failed to copy preview message:', copyError);
        }
    }

    async function handleSend() {
        if (!selectedEventId) {
            return;
        }

        setSending(true);
        setError('');
        setNotice('');

        try {
            const payload = { audience };
            if (audience === 'custom_selected') {
                payload.recipientIds = selectedRecipients;
            }
            if (scheduleMode === 'scheduled' && scheduledFor) {
                payload.scheduledFor = new Date(scheduledFor).toISOString();
            }

            const response = await api.post(`/admin/events/${selectedEventId}/send-invitations`, payload);
            const queued = response.data?.data?.summary?.queued || 0;
            const sent = response.data?.data?.summary?.sent || 0;
            const failed = response.data?.data?.summary?.failed || 0;
            setNotice(localize(i18n, `Done. ${queued} queued, ${sent} sent, ${failed} failed.`, `تمت العملية. ${queued} في الانتظار، ${sent} أُرسلت، ${failed} فشلت.`));
        } catch (sendError) {
            console.error('Failed to send invitations:', sendError);
            setError(sendError.response?.data?.message || localize(i18n, 'We could not send invitations for this event yet.', 'تعذر إرسال الدعوات لهذه الفعالية حالياً.'));
        } finally {
            setSending(false);
        }
    }

    const previewMessage = message
        .replaceAll('{{guest_name}}', localize(i18n, 'Guest', 'الضيف'))
        .replaceAll('{{event_link}}', 'https://yahala.app/invite/...');

    const eventTitle = activeEvent
        ? localize(i18n, activeEvent.name || 'Event', activeEvent.name_ar || activeEvent.name || 'فعالية')
        : localize(i18n, 'Choose an event', 'اختر فعالية');
    const eventLine = activeEvent
        ? `${formatEventDate(activeEvent.start_datetime, i18n.language)} • ${localize(i18n, activeEvent.venue || 'Venue to be confirmed', activeEvent.venue_ar || activeEvent.venue || 'سيتم تأكيد المكان')}`
        : localize(i18n, 'Date and venue preview will appear here.', 'سيظهر هنا تاريخ الفعالية ومكانها.');
    const previewTitle = channel === 'email'
        ? localize(i18n, `${eventTitle} invitation`, `دعوة ${eventTitle}`)
        : eventTitle;
    const previewSubtitle = channel === 'link'
        ? localize(i18n, 'Public share preview', 'معاينة رابط المشاركة')
        : localize(i18n, `${formatNumber(recipientCount)} recipients`, `${formatNumber(recipientCount)} مستلمين`);
    const ctaLabel = channel === 'email'
        ? localize(i18n, 'Open invitation', 'افتح الدعوة')
        : channel === 'link'
            ? localize(i18n, 'Copy link', 'نسخ الرابط')
            : localize(i18n, 'View invite', 'عرض الدعوة');

    return (
        <div className="send-page send-page-redesign">
            <section className="send-page__hero">
                <div className="send-page__hero-copy">
                    <span className="send-page__eyebrow">{localize(i18n, 'Delivery workspace', 'مساحة الإرسال')}</span>
                    <h1 className="hub-display-title">{localize(i18n, 'Send your invites', 'أرسل دعواتك')}</h1>
                    <p>{localize(i18n, 'Choose the event, narrow the audience, check the delivery posture, then send or schedule in one clean flow.', 'اختر الفعالية وحدد الجمهور وراجع حالة الإرسال ثم أرسل أو جدول العملية ضمن مسار واحد واضح.')}</p>
                </div>

                <div className="send-page__hero-select">
                    <label htmlFor="sendEvent">{localize(i18n, 'Event', 'الفعالية')}</label>
                    <select id="sendEvent" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} disabled={loading}>
                        {events.map((event) => (
                            <option key={event.id} value={event.id}>
                                {localize(i18n, event.name || 'Untitled event', event.name_ar || event.name || 'فعالية')}
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            <div className="send-page__layout">
                <section className="send-card send-card--composer">
                    <div className="send-card__body">
                        <div className="send-event-summary">
                            <div>
                                <span className="send-mini-label">{localize(i18n, 'Selected event', 'الفعالية المحددة')}</span>
                                <strong>{eventTitle}</strong>
                                <small>{eventLine}</small>
                            </div>

                            <div className="send-event-summary__actions">
                                {selectedEventId && (
                                    <Link to={`/events/${selectedEventId}`} className="send-inline-link">
                                        <span>{localize(i18n, 'Open event workspace', 'فتح مساحة الفعالية')}</span>
                                        <ArrowUpRight size={15} />
                                    </Link>
                                )}
                                {summary?.projectId && (
                                    <Link to={`/invitation-projects/${summary.projectId}`} className="send-inline-link">
                                        <span>{localize(i18n, 'Open invitation project', 'فتح مشروع الدعوة')}</span>
                                        <ArrowUpRight size={15} />
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="send-channel-row">
                            {CHANNELS.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button key={item.id} type="button" className={`send-channel send-channel--${item.accent} ${channel === item.id ? 'is-active' : ''}`} onClick={() => setChannel(item.id)}>
                                        <Icon size={17} />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="send-performance-grid send-performance-grid--compact">
                            {performanceCards.map((card) => (
                                <article key={card.id} className={`send-performance-card send-performance-card--${card.tone}`}>
                                    <span>{card.label}</span>
                                    <strong>{formatNumber(card.value)}</strong>
                                </article>
                            ))}
                        </div>

                        <div className="send-field-block">
                            <div className="send-section-header">
                                <div>
                                    <span className="send-label">{localize(i18n, 'Audience', 'الجمهور')}</span>
                                    <p>{localize(i18n, 'Choose who should receive this run.', 'اختر من يجب أن يستلم هذه الدفعة.')}</p>
                                </div>
                                <div className="send-selection-chip">
                                    <Users size={15} />
                                    <span>{selectionNote}</span>
                                </div>
                            </div>

                            <div className="send-audience-grid">
                                {AUDIENCES.map((item) => (
                                    <AudienceCard
                                        key={item.id}
                                        audience={item}
                                        count={audienceCounts[item.id]}
                                        isActive={audience === item.id}
                                        i18n={i18n}
                                        onSelect={setAudience}
                                    />
                                ))}
                            </div>
                        </div>

                        {audience === 'custom_selected' && (
                            <div className="send-recipient-picker">
                                <div className="send-recipient-picker__head">
                                    <div>
                                        <strong>{localize(i18n, 'Custom recipients', 'مستلمون مخصصون')}</strong>
                                        <span>{localize(i18n, 'Choose from recipients already assigned to this event.', 'اختر من المستلمين المرتبطين بهذه الفعالية بالفعل.')}</span>
                                    </div>
                                    <button type="button" className="send-inline-link" onClick={toggleVisibleRecipients}>
                                        <span>{localize(i18n, 'Toggle visible', 'تبديل الظاهر')}</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>

                                <div className="send-recipient-picker__search">
                                    <Search size={16} />
                                    <input
                                        type="text"
                                        value={recipientSearch}
                                        onChange={(event) => setRecipientSearch(event.target.value)}
                                        placeholder={localize(i18n, 'Search recipients...', 'ابحث عن المستلمين...')}
                                    />
                                </div>

                                <div className="send-recipient-picker__list">
                                    {selectableRecipients.length === 0 ? (
                                        <div className="send-recipient-picker__empty">{localize(i18n, 'No invitation recipients are available yet for this event.', 'لا يوجد مستلمون متاحون لهذه الفعالية حتى الآن.')}</div>
                                    ) : (
                                        selectableRecipients.map((row) => (
                                            <label key={row.recipient_id} className={`send-recipient-row ${selectedRecipients.includes(row.recipient_id) ? 'is-selected' : ''}`}>
                                                <input type="checkbox" checked={selectedRecipients.includes(row.recipient_id)} onChange={() => toggleRecipient(row.recipient_id)} />
                                                <span>
                                                    <strong>{row.name}</strong>
                                                    <small>{row.email || row.mobile_number || row.organization || ''}</small>
                                                </span>
                                            </label>
                                        ))
                                    )}
                                </div>

                                {selectedRecipientRows.length > 0 && (
                                    <div className="send-selected-strip">
                                        <span>{localize(i18n, 'Selected', 'المحدد')}</span>
                                        <div className="send-selected-strip__chips">
                                            {selectedRecipientRows.slice(0, 6).map((row) => (
                                                <button key={row.recipient_id} type="button" onClick={() => toggleRecipient(row.recipient_id)}>
                                                    <span>{row.name}</span>
                                                    <Check size={13} />
                                                </button>
                                            ))}
                                            {selectedRecipientRows.length > 6 && (
                                                <span className="send-selected-strip__more">+{selectedRecipientRows.length - 6}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="send-field-block send-field-block--message">
                            <div className="send-section-header">
                                <div>
                                    <span className="send-label">{localize(i18n, 'Preview copy', 'نص المعاينة')}</span>
                                    <p>{localize(i18n, 'Use this to shape tone and merge tags. Final delivery still uses the linked invitation project content.', 'استخدم هذا لتشكيل النبرة ووسوم الدمج. أما المحتوى النهائي فيعتمد على مشروع الدعوة المرتبط.')}</p>
                                </div>
                                <button type="button" className="send-inline-link" onClick={() => {
                                    setMessage(buildDefaultMessage(channel, i18n, activeEvent));
                                    setMessageTouched(false);
                                }}>
                                    <Sparkles size={15} />
                                    <span>{localize(i18n, 'Use suggested copy', 'استخدم النص المقترح')}</span>
                                </button>
                            </div>

                            <div className="send-merge-tags">
                                {['{{guest_name}}', '{{event_link}}'].map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => {
                                            setMessageTouched(true);
                                            setMessage((current) => insertAtCursor(current, tag, messageRef));
                                        }}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>

                            <div className="send-message-layout">
                                <textarea
                                    ref={messageRef}
                                    className="send-message-textarea"
                                    value={message}
                                    onChange={(event) => {
                                        setMessageTouched(true);
                                        setMessage(event.target.value);
                                    }}
                                    rows={6}
                                />

                                <div className="send-attachment-card">
                                    <div className="send-attachment-card__art" />
                                    <div className="send-attachment-card__body">
                                        <span>{localize(i18n, 'Invitation card', 'Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„Ø¯Ø¹ÙˆØ©')}</span>
                                        <strong>{eventTitle}</strong>
                                        <small>{eventLine}</small>
                                        <button type="button">{localize(i18n, 'View details & RSVP', 'Ø¹Ø±Ø¶ Ø§Ù„ØªÙØ§ØµÙŠÙ„ ÙˆØ§Ù„Ø±Ø¯')}</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="send-schedule-card">
                            <div className="send-section-header">
                                <div>
                                    <span className="send-label">{localize(i18n, 'When to send', 'متى يتم الإرسال')}</span>
                                    <p>{localize(i18n, 'Send immediately or line this campaign up for later.', 'أرسل الآن أو قم بجدولة الحملة لوقت لاحق.')}</p>
                                </div>
                                <div className="send-chip-row">
                                    <button type="button" className={`send-filter-chip ${scheduleMode === 'now' ? 'is-active' : ''}`} onClick={() => setScheduleMode('now')}>
                                        {localize(i18n, 'Send now', 'أرسل الآن')}
                                    </button>
                                    <button type="button" className={`send-filter-chip ${scheduleMode === 'scheduled' ? 'is-active' : ''}`} onClick={() => setScheduleMode('scheduled')}>
                                        {localize(i18n, 'Schedule', 'جدولة')}
                                    </button>
                                </div>
                            </div>

                            {scheduleMode === 'scheduled' && (
                                <label className="send-schedule-input">
                                    <CalendarDays size={16} />
                                    <input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
                                </label>
                            )}
                        </div>

                        {error && <div className="form-error">{error}</div>}
                        {notice && <div className="status-banner success">{notice}</div>}
                    </div>

                    <div className="send-footer">
                        <div className="send-footer__count">
                            <Users size={16} />
                            <span>{localize(i18n, `This run will target ${recipientCount} recipients`, `ستستهدف هذه الدفعة ${recipientCount} مستلمين`)}</span>
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary send-footer__button"
                            disabled={sending || workspaceLoading || !selectedEventId || recipientCount === 0 || (audience === 'custom_selected' && selectedRecipients.length === 0)}
                            onClick={handleSend}
                        >
                            <Send size={16} />
                            <span>
                                {sending
                                    ? localize(i18n, 'Sending...', 'جاري الإرسال...')
                                    : scheduleMode === 'scheduled'
                                        ? localize(i18n, `Schedule ${recipientCount} invites`, `جدولة ${recipientCount} دعوات`)
                                        : localize(i18n, `Send ${recipientCount} invites`, `أرسل ${recipientCount} دعوات`)}
                            </span>
                        </button>
                    </div>
                </section>

                <aside className="send-preview-card">
                    <div className="send-preview-card__body">
                        <div className="send-preview-card__header">
                            <div>
                                <span className="send-mini-label">{localize(i18n, 'Live preview', 'معاينة مباشرة')}</span>
                                <h2>{localize(i18n, 'Campaign feel', 'إحساس الحملة')}</h2>
                            </div>
                            <button type="button" className="send-inline-link" onClick={handleCopyPreview}>
                                <Copy size={15} />
                                <span>{localize(i18n, 'Copy preview text', 'نسخ نص المعاينة')}</span>
                            </button>
                        </div>

                        <div className="send-preview-device">
                            <PreviewShell
                                channel={channel}
                                title={previewTitle}
                                subtitle={previewSubtitle}
                                previewMessage={previewMessage}
                                eventLine={eventLine}
                                ctaLabel={ctaLabel}
                            />
                        </div>

                        <div className="send-preview-card__meta send-preview-card__meta--compact">
                            <div className="send-preview-card__meta-item">
                                <Clock3 size={16} />
                                <div>
                                    <strong>{scheduleMode === 'scheduled' && scheduledFor ? formatEventDate(scheduledFor, i18n.language) : localize(i18n, 'Send immediately', 'إرسال فوري')}</strong>
                                    <span>{localize(i18n, 'Delivery timing', 'توقيت الإرسال')}</span>
                                </div>
                            </div>
                            <div className="send-preview-card__meta-item">
                                <Eye size={16} />
                                <div>
                                    <strong>{formatNumber(totalOpened)} / {formatNumber(totalRecipients)}</strong>
                                    <span>{localize(i18n, 'Opened so far', 'تم فتحها حتى الآن')}</span>
                                </div>
                            </div>
                            <div className="send-preview-card__meta-item">
                                <AlertCircle size={16} />
                                <div>
                                    <strong>{formatNumber(totalFailed)}</strong>
                                    <span>{localize(i18n, 'Failed deliveries', 'عمليات الإرسال الفاشلة')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="send-preview-card__note">
                            {localize(i18n, 'This workspace chooses the audience and timing. Advanced delivery tracing and deeper invitation content configuration still live inside the event workspace and invitation project.', 'هذه المساحة تختار الجمهور والتوقيت. أما تتبع التسليم المتقدم وتكوين محتوى الدعوة التفصيلي فما زالا داخل مساحة الفعالية ومشروع الدعوة.')}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
