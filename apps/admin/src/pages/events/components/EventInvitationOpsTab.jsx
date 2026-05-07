import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Mail, RefreshCw, Send, Users } from 'lucide-react';
import api from '../../../services/api';
import RoleGuard from '../../../components/auth/RoleGuard';
import './EventInvitationOpsTab.css';

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
    const [scheduleMode, setScheduleMode] = useState('now');
    const [scheduledFor, setScheduledFor] = useState('');

    async function loadData() {
        if (!event?.id) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const [summaryResponse, attendanceResponse, addonsResponse, questionnaireResponse] = await Promise.all([
                api.get(`/admin/events/${event.id}/invitation-summary`),
                api.get(`/admin/events/${event.id}/attendance-summary`),
                api.get(`/admin/events/${event.id}/addons-summary`),
                api.get(`/admin/events/${event.id}/questionnaire-summary`)
            ]);

            setSummary(summaryResponse.data?.data || null);
            setAttendance(attendanceResponse.data?.data || null);
            setAddons(addonsResponse.data?.data || null);
            setQuestionnaires(questionnaireResponse.data?.data || null);
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
            const payload = {};
            if (scheduleMode === 'scheduled' && scheduledFor) {
                payload.scheduledFor = new Date(scheduledFor).toISOString();
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

    if (loading) {
        return <div className="invitation-ops-loading">{t('common.loading')}</div>;
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

                            <button type="button" className="btn btn-primary" onClick={handleSendInvitations} disabled={sending || !readiness.hasRecipients}>
                                <Send size={16} />
                                <span>{sending ? t('common.loading') : t('events.invitationOps.send')}</span>
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
                            <span>Questionnaire submissions</span>
                            <strong>{questionnaires?.totals?.totalSubmissions || 0}</strong>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
