import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Link2, Mail, MessageCircleMore, Send, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import './SendInvitationsPage.css';

const CHANNELS = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircleMore },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'sms', label: 'SMS', icon: MessageCircleMore },
    { id: 'link', label: 'Public Link', icon: Link2 }
];

const AUDIENCES = [
    { id: 'newly_added', en: 'Newly Added', ar: 'المضافة حديثًا' },
    { id: 'failed', en: 'Failed Only', ar: 'الفاشلة فقط' },
    { id: 'sent_not_opened', en: 'Sent, Not Opened', ar: 'أُرسلت ولم تُفتح' },
    { id: 'opened_not_responded', en: 'Opened, No Response', ar: 'فُتحت دون رد' },
    { id: 'custom_selected', en: 'Custom Selection', ar: 'اختيار مخصص' }
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

function insertAtCursor(value, token, inputRef) {
    const input = inputRef.current;
    if (!input) {
        return `${value}${token}`;
    }
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    return `${value.slice(0, start)}${token}${value.slice(end)}`;
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
    const [message, setMessage] = useState('Hi {{guest_name}},\n\nYou’re invited to celebrate with us.\nSee the invitation details here: {{event_link}}');
    const [scheduleMode, setScheduleMode] = useState('now');
    const [scheduledFor, setScheduledFor] = useState('');
    const [loading, setLoading] = useState(true);
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

    const selectableRecipients = useMemo(() => {
        const query = recipientSearch.trim().toLowerCase();
        return guestRows
            .filter((row) => row.recipient_id)
            .filter((row) => {
                if (!query) {
                    return true;
                }
                return [row.name, row.email, row.organization]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(query));
            });
    }, [guestRows, recipientSearch]);

    const recipientCount = audience === 'custom_selected'
        ? selectedRecipients.length
        : summary?.totals?.recipients || 0;

    function toggleRecipient(recipientId) {
        setSelectedRecipients((current) => (
            current.includes(recipientId)
                ? current.filter((id) => id !== recipientId)
                : [...current, recipientId]
        ));
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
        .replace('{{guest_name}}', localize(i18n, 'Guest', 'الضيف'))
        .replace('{{event_link}}', 'https://yahala.app/invite/...');

    return (
        <div className="send-page">
            <section className="send-page__hero">
                <div>
                    <h1 className="hub-display-title">{localize(i18n, 'Send your invites', 'أرسل دعواتك')}</h1>
                    <p>{localize(i18n, 'Pick an event, choose an audience, preview the message, then send.', 'اختر الفعالية والجمهور ثم عاين الرسالة وأرسلها.')}</p>
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
                <section className="send-card">
                    <div className="send-channel-row">
                        {CHANNELS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button key={item.id} type="button" className={`send-channel ${channel === item.id ? 'is-active' : ''}`} onClick={() => setChannel(item.id)}>
                                    <Icon size={17} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="send-field-block">
                        <span className="send-label">{localize(i18n, 'Audience', 'الجمهور')}</span>
                        <div className="send-chip-row">
                            {AUDIENCES.map((item) => (
                                <button key={item.id} type="button" className={`send-filter-chip ${audience === item.id ? 'is-active' : ''}`} onClick={() => setAudience(item.id)}>
                                    {localize(i18n, item.en, item.ar)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {audience === 'custom_selected' && (
                        <div className="send-recipient-picker">
                            <div className="send-recipient-picker__head">
                                <Users size={16} />
                                <span>{localize(i18n, 'Choose recipients already linked to this event', 'اختر المستلمين المرتبطين بهذه الفعالية')}</span>
                            </div>
                            <input
                                type="text"
                                value={recipientSearch}
                                onChange={(event) => setRecipientSearch(event.target.value)}
                                placeholder={localize(i18n, 'Search recipients...', 'ابحث عن المستلمين...')}
                            />
                            <div className="send-recipient-picker__list">
                                {selectableRecipients.length === 0 ? (
                                    <div className="send-recipient-picker__empty">{localize(i18n, 'No invitation recipients available yet.', 'لا يوجد مستلمون متاحون بعد.')}</div>
                                ) : (
                                    selectableRecipients.map((row) => (
                                        <label key={row.recipient_id} className="send-recipient-row">
                                            <input type="checkbox" checked={selectedRecipients.includes(row.recipient_id)} onChange={() => toggleRecipient(row.recipient_id)} />
                                            <span>
                                                <strong>{row.name}</strong>
                                                <small>{row.email || row.mobile_number || row.organization || ''}</small>
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <div className="send-field-block">
                        <span className="send-label">{localize(i18n, 'Message', 'الرسالة')}</span>
                        <div className="send-merge-tags">
                            {['{{guest_name}}', '{{event_link}}'].map((tag) => (
                                <button key={tag} type="button" onClick={() => setMessage((current) => insertAtCursor(current, tag, messageRef))}>
                                    {tag}
                                </button>
                            ))}
                        </div>
                        <textarea
                            ref={messageRef}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            rows={8}
                        />
                    </div>

                    <div className="send-schedule-row">
                        <span className="send-label">{localize(i18n, 'When to send', 'متى يتم الإرسال')}</span>
                        <div className="send-chip-row">
                            <button type="button" className={`send-filter-chip ${scheduleMode === 'now' ? 'is-active' : ''}`} onClick={() => setScheduleMode('now')}>
                                {localize(i18n, 'Send now', 'أرسل الآن')}
                            </button>
                            <button type="button" className={`send-filter-chip ${scheduleMode === 'scheduled' ? 'is-active' : ''}`} onClick={() => setScheduleMode('scheduled')}>
                                {localize(i18n, 'Schedule', 'جدولة')}
                            </button>
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

                    <div className="send-footer">
                        <div className="send-footer__count">
                            <Users size={16} />
                            <span>{localize(i18n, `Will reach ${recipientCount} recipients`, `سيصل إلى ${recipientCount} مستلم`)}</span>
                        </div>
                        <button type="button" className="btn btn-primary send-footer__button" disabled={sending || (audience === 'custom_selected' && selectedRecipients.length === 0)} onClick={handleSend}>
                            <Send size={16} />
                            <span>{sending ? localize(i18n, 'Sending...', 'جاري الإرسال...') : localize(i18n, `Send ${recipientCount} invites`, `أرسل ${recipientCount} دعوات`)}</span>
                        </button>
                    </div>
                </section>

                <aside className="send-preview-card">
                    <div className="send-preview-card__phone">
                        <div className="send-preview-card__header">
                            <strong>{channel === 'email' ? 'Email' : channel === 'link' ? 'Public Link' : channel === 'sms' ? 'SMS' : 'WhatsApp'}</strong>
                            <small>{activeEvent ? localize(i18n, activeEvent.name || 'Event', activeEvent.name_ar || activeEvent.name || 'فعالية') : localize(i18n, 'Choose an event', 'اختر فعالية')}</small>
                        </div>
                        <div className="send-preview-bubble">
                            {previewMessage.split('\n').map((line) => (
                                <p key={line}>{line}</p>
                            ))}
                        </div>
                        <div className="send-preview-card__invite">
                            <span>{localize(i18n, 'Invitation card', 'بطاقة الدعوة')}</span>
                            <strong>{activeEvent ? localize(i18n, activeEvent.name || 'Event', activeEvent.name_ar || activeEvent.name || 'فعالية') : localize(i18n, 'Select an event', 'اختر فعالية')}</strong>
                            <small>{activeEvent ? `${formatEventDate(activeEvent.start_datetime, i18n.language)} • ${localize(i18n, activeEvent.venue || 'Venue to be confirmed', activeEvent.venue_ar || activeEvent.venue || 'سيتم تأكيد المكان')}` : localize(i18n, 'Date and venue preview will appear here.', 'سيظهر هنا تاريخ الفعالية ومكانها.')}</small>
                        </div>
                    </div>

                    <div className="send-preview-card__note">
                        {localize(i18n, 'Sending uses the event’s current invitation project setup. Advanced delivery tracing still lives inside the deeper event workspace.', 'يستخدم الإرسال إعداد مشروع الدعوة الحالي للفعالية. تتوفر أدوات التتبع المتقدمة داخل مساحة الفعالية التفصيلية.')}
                    </div>
                </aside>
            </div>
        </div>
    );
}
