import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Mail, RefreshCw, Send, Users } from 'lucide-react';
import api from '../../../services/api';
import RoleGuard from '../../../components/auth/RoleGuard';
import './EventInvitationOpsTab.css';

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function formatTimestamp(value, locale) {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleString(locale || 'en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default function EventInvitationOpsTab({ event }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US';
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [summary, setSummary] = useState(null);
    const [attendance, setAttendance] = useState(null);
    const [addons, setAddons] = useState(null);
    const [questionnaires, setQuestionnaires] = useState(null);
    const [sendResult, setSendResult] = useState(null);
    const [rsvpResponses, setRsvpResponses] = useState({ rows: [], totals: { total: 0, attending: 0, maybe: 0, notAttending: 0 } });
    const [traceResult, setTraceResult] = useState(null);
    const [tracing, setTracing] = useState(false);
    const [scheduleMode, setScheduleMode] = useState('now');
    const [scheduledFor, setScheduledFor] = useState('');
    const [sendAudience, setSendAudience] = useState('newly_added');
    const [customRecipientIds, setCustomRecipientIds] = useState([]);

    async function loadData() {
        if (!event?.id) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const [summaryResponse, attendanceResponse, addonsResponse, questionnaireResponse, rsvpResponse] = await Promise.all([
                api.get(`/admin/events/${event.id}/invitation-summary`),
                api.get(`/admin/events/${event.id}/attendance-summary`),
                api.get(`/admin/events/${event.id}/addons-summary`),
                api.get(`/admin/events/${event.id}/questionnaire-summary`),
                api.get(`/admin/events/${event.id}/rsvp-responses`)
            ]);

            setSummary(summaryResponse.data?.data || null);
            setAttendance(attendanceResponse.data?.data || null);
            setAddons(addonsResponse.data?.data || null);
            setQuestionnaires(questionnaireResponse.data?.data || null);
            setRsvpResponses(rsvpResponse.data?.data || { rows: [], totals: { total: 0, attending: 0, maybe: 0, notAttending: 0 } });
        } catch (loadError) {
            console.error('Failed to load invitation operations summary:', loadError);
            setError(loadError.response?.data?.message || t('events.invitationOps.loadFailed'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, [event?.id]);

    useEffect(() => {
        if (!event?.id) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            if (document.visibilityState !== 'visible') {
                return;
            }
            if (!actionLoading && !sending && !tracing) {
                loadData();
            }
        }, 15000);

        return () => window.clearInterval(intervalId);
    }, [event?.id, actionLoading, sending, tracing]);

    const readiness = useMemo(() => {
        const recipients = summary?.totals?.recipients || 0;
        const templateSelected = Boolean(event?.template_id);
        const hasRecipients = recipients > 0;
        return { templateSelected, hasRecipients };
    }, [event?.template_id, summary?.totals?.recipients]);

    async function handleSyncTemplate() {
        if (!event?.id) {
            return;
        }
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post(`/admin/events/${event.id}/sync-invitation-template`);
            setSuccess(t('events.invitationOps.syncSuccess'));
            await loadData();
        } catch (syncError) {
            console.error('Failed to sync template from event operations tab:', syncError);
            setError(syncError.response?.data?.message || t('events.invitationOps.syncFailed'));
        } finally {
            setActionLoading(false);
        }
    }

    async function handleSendInvitations() {
        if (!event?.id) {
            return;
        }
        setSending(true);
        setError('');
        setSuccess('');
        try {
            const payload = { audience: sendAudience };
            if (scheduleMode === 'scheduled' && scheduledFor) {
                payload.scheduledFor = new Date(scheduledFor).toISOString();
            }
            if (sendAudience === 'custom_selected') {
                payload.recipientIds = customRecipientIds;
            }
            const response = await api.post(`/admin/events/${event.id}/send-invitations`, payload);
            setSendResult(response.data?.data || null);
            setSuccess(t('events.invitationOps.sendSuccess'));
            await loadData();
        } catch (sendError) {
            console.error('Failed to send invitations from event operations tab:', sendError);
            setError(sendError.response?.data?.message || t('events.invitationOps.sendFailed'));
        } finally {
            setSending(false);
        }
    }

    async function handleTraceInvitations() {
        if (!event?.id) {
            return;
        }
        setTracing(true);
        setError('');
        setSuccess('');
        setTraceResult(null);
        try {
            const payload = { audience: sendAudience };
            if (scheduleMode === 'scheduled' && scheduledFor) {
                payload.scheduledFor = new Date(scheduledFor).toISOString();
            }
            if (sendAudience === 'custom_selected') {
                payload.recipientIds = customRecipientIds;
            }
            const response = await api.post(`/admin/events/${event.id}/send-invitations/trace`, payload);
            setTraceResult(response.data?.data || null);
            setSuccess(t('invitationProjects.traceSendTitle'));
            await loadData();
        } catch (traceError) {
            console.error('Failed to trace invitations from event operations tab:', traceError);
            setError(traceError.response?.data?.message || t('invitationProjects.traceFailed'));
        } finally {
            setTracing(false);
        }
    }

    if (loading) {
        return <div className="invitation-ops-loading">{t('common.loading')}</div>;
    }

    const rsvpData = rsvpResponses || { rows: [], totals: {} };
    const responseRows = Array.isArray(rsvpData.rows) ? rsvpData.rows : [];
    const responseTotals = rsvpData.totals || {};
    const customRecipients = responseRows.map((row) => ({
        id: row.recipientId,
        label: row.guestName || row.email || row.recipientId,
        email: row.email || ''
    }));
    const canSend = readiness.hasRecipients && (sendAudience !== 'custom_selected' || customRecipientIds.length > 0);

    function toggleCustomRecipient(recipientId, checked) {
        setCustomRecipientIds((previous) => {
            if (checked) {
                return Array.from(new Set([...previous, recipientId]));
            }
            return previous.filter((id) => id !== recipientId);
        });
    }

    return (
        <div className="invitation-ops-tab">
            <div className="invitation-ops-header">
                <div>
                    <h3>{t('events.invitationOps.title')}</h3>
                    <p>{t('events.invitationOps.subtitle')}</p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={loadData} disabled={loading}>
                    <RefreshCw size={16} />
                    <span>{t('common.refresh')}</span>
                </button>
            </div>

            {error && <div className="form-error">{error}</div>}
            {success && <div className="status-banner success">{success}</div>}

            <div className="invitation-ops-kpis">
                <article className="ops-kpi-card">
                    <span>{t('events.invitationOps.recipients')}</span>
                    <strong>{summary?.totals?.recipients || 0}</strong>
                </article>
                <article className="ops-kpi-card">
                    <span>{t('events.invitationOps.sent')}</span>
                    <strong>{summary?.totals?.sent || 0}</strong>
                </article>
                <article className="ops-kpi-card">
                    <span>{t('events.invitationOps.failed')}</span>
                    <strong>{summary?.totals?.failed || 0}</strong>
                </article>
                <article className="ops-kpi-card">
                    <span>{localize(i18n, 'RSVP responses', 'ردود الحضور')}</span>
                    <strong>{responseTotals.total || 0}</strong>
                </article>
                <article className="ops-kpi-card">
                    <span>{t('events.invitationOps.checkedIn')}</span>
                    <strong>{attendance?.totals?.checkedInTotal || 0}</strong>
                </article>
            </div>

            <div className="invitation-ops-grid">
                <section className="ops-card">
                    <div className="ops-card-header">
                        <h4>{t('events.invitationOps.actions')}</h4>
                        <Mail size={16} />
                    </div>

                    <div className="ops-readiness-list">
                        <div className={readiness.templateSelected ? 'ready' : 'pending'}>
                            {readiness.templateSelected ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                            <span>{t('events.invitationOps.templateReady')}</span>
                        </div>
                        <div className={readiness.hasRecipients ? 'ready' : 'pending'}>
                            {readiness.hasRecipients ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                            <span>{t('events.invitationOps.recipientsReady')}</span>
                        </div>
                    </div>

                    <RoleGuard permission="events.edit">
                        <div className="ops-actions">
                            <button type="button" className="btn btn-secondary" onClick={handleSyncTemplate} disabled={actionLoading}>
                                <RefreshCw size={16} />
                                <span>{actionLoading ? t('common.loading') : t('events.invitationOps.syncTemplate')}</span>
                            </button>

                            <div className="send-controls">
                                <label htmlFor="sendAudience">{localize(i18n, 'Send Audience', 'فئة الإرسال')}</label>
                                <select
                                    id="sendAudience"
                                    value={sendAudience}
                                    onChange={(e) => {
                                        const nextAudience = e.target.value;
                                        setSendAudience(nextAudience);
                                        if (nextAudience !== 'custom_selected') {
                                            setCustomRecipientIds([]);
                                        }
                                    }}
                                >
                                    <option value="newly_added">{localize(i18n, 'Newly Added (Unsent)', 'المضافون حديثًا (غير مُرسَل لهم)')}</option>
                                    <option value="failed">{localize(i18n, 'Failed Only', 'الفاشلة فقط')}</option>
                                    <option value="sent_not_opened">{localize(i18n, 'Sent/Delivered Not Opened', 'مُرسلة/مُسلّمة ولم تُفتح')}</option>
                                    <option value="opened_not_responded">{localize(i18n, 'Opened Not Responded', 'فُتحت بدون رد')}</option>
                                    <option value="custom_selected">{localize(i18n, 'Custom Selected', 'اختيار مخصص')}</option>
                                </select>

                                <label htmlFor="sendMode">{t('events.invitationOps.sendMode')}</label>
                                <select id="sendMode" value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value)}>
                                    <option value="now">{t('events.invitationOps.sendNow')}</option>
                                    <option value="scheduled">{t('events.invitationOps.sendScheduled')}</option>
                                </select>
                                {scheduleMode === 'scheduled' && (
                                    <input
                                        type="datetime-local"
                                        value={scheduledFor}
                                        onChange={(e) => setScheduledFor(e.target.value)}
                                    />
                                )}
                            </div>

                            {sendAudience === 'custom_selected' && (
                                <div className="ops-custom-recipient-list">
                                    {customRecipients.length === 0 ? (
                                        <p className="ops-hint">{localize(i18n, 'No recipients available yet.', 'لا يوجد مستلمون بعد.')}</p>
                                    ) : (
                                        customRecipients.map((recipient) => (
                                            <label key={recipient.id} className="ops-custom-recipient-row">
                                                <input
                                                    type="checkbox"
                                                    checked={customRecipientIds.includes(recipient.id)}
                                                    onChange={(e) => toggleCustomRecipient(recipient.id, e.target.checked)}
                                                />
                                                <span>{recipient.label}</span>
                                                <small>{recipient.email || '-'}</small>
                                            </label>
                                        ))
                                    )}
                                </div>
                            )}

                            <button type="button" className="btn btn-primary" onClick={handleSendInvitations} disabled={sending || !canSend}>
                                <Send size={16} />
                                <span>{sending ? t('common.loading') : t('events.invitationOps.send')}</span>
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={handleTraceInvitations} disabled={tracing || !canSend}>
                                <Send size={16} />
                                <span>{tracing ? t('common.loading') : t('invitationProjects.traceSend')}</span>
                            </button>
                        </div>
                    </RoleGuard>

                    {sendResult?.summary && (
                        <div className="ops-send-result">
                            <p>{t('events.invitationOps.lastSendResult')}</p>
                            <div className="ops-send-result-grid">
                                <span>{t('settings.queued')}: {sendResult.summary.queued || 0}</span>
                                <span>{t('reports.sent')}: {sendResult.summary.sent || 0}</span>
                                <span>{t('reports.failed')}: {sendResult.summary.failed || 0}</span>
                            </div>
                        </div>
                    )}

                    {traceResult && (
                        <div className="ops-trace-result">
                            <p>{t('invitationProjects.traceSendTitle')}</p>
                            <div className="ops-send-result-grid">
                                <span>{t('invitationProjects.traceQueuedJobs')}: {traceResult.trace?.summary?.queuedJobs || 0}</span>
                                <span>{t('invitationProjects.traceClaimedJobs')}: {traceResult.trace?.summary?.claimedJobs || 0}</span>
                                <span>{t('invitationProjects.traceSentJobs')}: {traceResult.trace?.summary?.sentJobs || 0}</span>
                                <span>{t('invitationProjects.traceFailedJobs')}: {traceResult.trace?.summary?.failedJobs || 0}</span>
                            </div>
                            <details>
                                <summary>{t('invitationProjects.traceRawJson')}</summary>
                                <pre className="ops-trace-json">{JSON.stringify(traceResult.trace || traceResult, null, 2)}</pre>
                            </details>
                        </div>
                    )}
                </section>

                <section className="ops-card">
                    <div className="ops-card-header">
                        <h4>{t('events.invitationOps.funnel')}</h4>
                        <Users size={16} />
                    </div>
                    <div className="ops-metrics-list">
                        <div><span>{t('events.invitationOps.queued')}</span><strong>{summary?.totals?.queued || 0}</strong></div>
                        <div><span>{t('events.invitationOps.sent')}</span><strong>{summary?.totals?.sent || 0}</strong></div>
                        <div><span>{t('events.invitationOps.delivered')}</span><strong>{summary?.totals?.delivered || 0}</strong></div>
                        <div><span>{t('events.invitationOps.opened')}</span><strong>{summary?.totals?.opened || 0}</strong></div>
                        <div><span>{t('events.invitationOps.responded')}</span><strong>{summary?.totals?.responded || 0}</strong></div>
                        <div><span>{t('events.invitationOps.failed')}</span><strong>{summary?.totals?.failed || 0}</strong></div>
                    </div>
                    <small>{t('events.invitationOps.lastUpdated')}: {formatTimestamp(summary?.lastUpdatedAt, locale)}</small>
                </section>

                <section className="ops-card">
                    <div className="ops-card-header">
                        <h4>{t('events.invitationOps.attendance')}</h4>
                        <CheckCircle2 size={16} />
                    </div>
                    <div className="ops-metrics-list">
                        <div><span>{t('events.invitationOps.invitedTotal')}</span><strong>{attendance?.totals?.invitedTotal || 0}</strong></div>
                        <div><span>{t('events.invitationOps.invitedAttended')}</span><strong>{attendance?.totals?.invitedAttended || 0}</strong></div>
                        <div><span>{t('events.invitationOps.invitedPending')}</span><strong>{attendance?.totals?.invitedPending || 0}</strong></div>
                        <div><span>{t('events.invitationOps.walkInTotal')}</span><strong>{attendance?.totals?.walkInTotal || 0}</strong></div>
                        <div><span>{t('events.invitationOps.walkInCheckedIn')}</span><strong>{attendance?.totals?.walkInCheckedIn || 0}</strong></div>
                    </div>
                </section>

                <section className="ops-card">
                    <div className="ops-card-header">
                        <h4>{t('events.invitationOps.addons')}</h4>
                        <Users size={16} />
                    </div>
                    <div className="ops-metrics-list">
                        <div>
                            <span>{t('events.invitationOps.enabledAddons')}</span>
                            <strong>{addons?.addInsEnabled?.length || 0}</strong>
                        </div>
                        <div>
                            <span>{t('events.invitationOps.pollTabs')}</span>
                            <strong>{addons?.addons?.poll?.tabCount || 0}</strong>
                        </div>
                        <div>
                            <span>{t('addons.questionnaireTab')}</span>
                            <strong>{questionnaires?.totals?.totalQuestionnaires || 0}</strong>
                        </div>
                        <div>
                            <span>{localize(i18n, 'Questionnaire submissions', 'إرسالات الاستبيان')}</span>
                            <strong>{questionnaires?.totals?.totalSubmissions || 0}</strong>
                        </div>
                    </div>
                </section>

                <section className="ops-card ops-card--wide">
                    <div className="ops-card-header">
                        <h4>{localize(i18n, 'RSVP Responses', 'ردود الحضور')}</h4>
                        <Users size={16} />
                    </div>
                    <div className="ops-metrics-list">
                        <div><span>{localize(i18n, 'Attending', 'حاضر')}</span><strong>{responseTotals.attending || 0}</strong></div>
                        <div><span>{localize(i18n, 'Maybe', 'ربما')}</span><strong>{responseTotals.maybe || 0}</strong></div>
                        <div><span>{localize(i18n, 'Not attending', 'غير حاضر')}</span><strong>{responseTotals.notAttending || 0}</strong></div>
                        <div><span>{localize(i18n, 'Total responses', 'إجمالي الردود')}</span><strong>{responseTotals.total || 0}</strong></div>
                    </div>
                    <div className="ops-rsvp-table-wrap">
                        <table className="ops-rsvp-table">
                            <thead>
                                <tr>
                                    <th>{localize(i18n, 'Guest', 'الضيف')}</th>
                                    <th>{localize(i18n, 'Attendance', 'الحضور')}</th>
                                    <th>{localize(i18n, 'Reason/Notes', 'السبب/ملاحظات')}</th>
                                    <th>{localize(i18n, 'Responded at', 'وقت الرد')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {responseRows.length ? responseRows.map((row) => (
                                    <tr key={row.recipientId}>
                                        <td>
                                            <strong>{row.guestName || '-'}</strong>
                                            <div className="ops-rsvp-sub">{row.email || row.phone || '-'}</div>
                                        </td>
                                        <td>{row.attendance || '-'}</td>
                                        <td>{row.notes || '-'}</td>
                                        <td>{formatTimestamp(row.respondedAt, locale)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4}>{localize(i18n, 'No RSVP responses yet.', 'لا توجد ردود حضور بعد.')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
