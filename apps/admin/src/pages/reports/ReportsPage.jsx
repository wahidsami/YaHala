import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    BarChart3,
    CalendarClock,
    ChevronRight,
    Eye,
    FileText,
    RefreshCw,
    Reply,
    Send,
    Users,
    UserCheck,
    X
} from 'lucide-react';
import api from '../../services/api';
import '../clients/ClientListPage.css';
import './ReportsPage.css';

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
}

function formatDateTime(value, language) {
    if (!value) {
        return '—';
    }

    const locale = language?.startsWith('ar') ? 'ar-SA' : 'en-US';
    try {
        return new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(new Date(value));
    } catch {
        return '—';
    }
}

function percent(numerator, denominator) {
    if (!denominator) {
        return '0%';
    }

    return `${Math.round((Number(numerator || 0) / Number(denominator || 1)) * 100)}%`;
}

function labelize(value) {
    return String(value || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\w/, (char) => char.toUpperCase());
}

function getStorageBaseUrl() {
    const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    return baseUrl.replace(/\/api\/?$/, '');
}

function resolveStorageUrl(storagePath) {
    if (!storagePath) {
        return '';
    }
    if (/^(https?:\/\/|data:|blob:)/i.test(storagePath)) {
        return storagePath;
    }
    if (storagePath.startsWith('/storage/') || storagePath.startsWith('storage/')) {
        const normalizedPath = storagePath.startsWith('/storage/') ? storagePath : `/${storagePath}`;
        return `${getStorageBaseUrl()}${normalizedPath}`;
    }
    return storagePath.startsWith('/') ? `${window.location.origin}${storagePath}` : `${window.location.origin}/${storagePath}`;
}

function OverviewCard({ title, value, subtitle, icon: Icon, tone = 'neutral' }) {
    return (
        <div className={`report-card report-card--${tone}`}>
            <div className="report-card__icon">
                <Icon size={18} />
            </div>
            <div className="report-card__content">
                <span>{title}</span>
                <strong>{value}</strong>
                {subtitle && <small>{subtitle}</small>}
            </div>
        </div>
    );
}

function SectionHeader({ title, subtitle, action }) {
    return (
        <div className="report-section__header">
            <div>
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

function EmptyState({ message }) {
    return <div className="report-empty">{message}</div>;
}

export default function ReportsPage() {
    const { t, i18n } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshTick, setRefreshTick] = useState(0);
    const [eventOptions, setEventOptions] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(searchParams.get('eventId') || '');
    const [eventReport, setEventReport] = useState(null);
    const [eventReportLoading, setEventReportLoading] = useState(false);
    const [eventReportError, setEventReportError] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState('');

    const isArabic = i18n.language?.startsWith('ar');

    useEffect(() => {
        let mounted = true;

        async function fetchReports() {
            setLoading(true);
            setError('');

            try {
                const response = await api.get('/admin/reports/overview');
                if (mounted) {
                    setData(response.data.data || null);
                    setLastUpdatedAt(new Date().toISOString());
                }
            } catch (fetchError) {
                console.error('Failed to load reports:', fetchError);
                if (mounted) {
                    setError(fetchError.response?.data?.message || t('reports.loadFailed'));
                    setData(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchReports();

        return () => {
            mounted = false;
        };
    }, [refreshTick, t]);

    useEffect(() => {
        let mounted = true;
        async function fetchEventsForReports() {
            try {
                const response = await api.get('/admin/reports/events');
                const rows = response.data?.data || [];
                if (mounted) {
                    setEventOptions(rows);
                    if (selectedEventId && rows.some((event) => event.id === selectedEventId)) {
                        setSelectedEventId(selectedEventId);
                    } else if (!selectedEventId && rows.length) {
                        setSelectedEventId(rows[0].id);
                    }
                }
            } catch (fetchError) {
                console.error('Failed to load report events:', fetchError);
            }
        }
        fetchEventsForReports();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedEventId) {
            setEventReport(null);
            return;
        }
        let mounted = true;
        async function fetchEventReport() {
            setEventReportLoading(true);
            setEventReportError('');
            try {
                const response = await api.get(`/admin/reports/events/${selectedEventId}`);
                if (mounted) {
                    setEventReport(response.data?.data || null);
                    setLastUpdatedAt(new Date().toISOString());
                }
            } catch (fetchError) {
                if (mounted) {
                    setEventReport(null);
                    setEventReportError(fetchError.response?.data?.message || 'Failed to load event report');
                }
            } finally {
                if (mounted) {
                    setEventReportLoading(false);
                }
            }
        }
        fetchEventReport();
        return () => {
            mounted = false;
        };
    }, [refreshTick, selectedEventId]);

    useEffect(() => {
        if (!autoRefresh) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setRefreshTick((value) => value + 1);
        }, 30000);

        return () => window.clearInterval(intervalId);
    }, [autoRefresh]);

    useEffect(() => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (selectedEventId) {
                next.set('eventId', selectedEventId);
            } else {
                next.delete('eventId');
            }
            return next;
        }, { replace: true });
    }, [selectedEventId, setSearchParams]);

    const overview = data?.summary || {};
    const invitations = data?.invitations || {};
    const rsvp = data?.rsvp || {};
    const polls = data?.polls || {};
    const questionnaires = data?.questionnaires || {};
    const recentResponses = data?.recentResponses || [];
    const topProjects = data?.topProjects || [];
    const topPolls = data?.topPolls || [];
    const topQuestionnaires = data?.topQuestionnaires || [];
    const recentActivity = data?.recentActivity || [];

    const responseRate = useMemo(() => percent(rsvp.total_submissions, invitations.total_recipients), [invitations.total_recipients, rsvp.total_submissions]);
    const openRate = useMemo(() => percent(invitations.opened_count, invitations.total_recipients), [invitations.opened_count, invitations.total_recipients]);
    const selectedEvent = useMemo(
        () => eventOptions.find((event) => event.id === selectedEventId) || null,
        [eventOptions, selectedEventId]
    );
    const checkInRate = useMemo(
        () => percent(eventReport?.invitationStats?.checked_in_count, eventReport?.invitationStats?.total_recipients),
        [eventReport]
    );

    function refreshReports() {
        setRefreshTick((value) => value + 1);
    }

    function exportEventReportPdf() {
        window.print();
    }

    return (
        <div className="reports-page">
            <div className="page-header hub-display-title">
                <div>
                    <h1>{t('nav.reports')}</h1>
                    <p>{t('reports.subtitle')}</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={refreshReports} disabled={loading}>
                    <RefreshCw size={16} />
                    <span>{t('common.refresh')}</span>
                </button>
            </div>

            <section className="report-live-shell">
                <div className="report-live-shell__header">
                    <div>
                        <span className="eyebrow">Live event monitor</span>
                        <h2>{selectedEvent ? (isArabic ? (selectedEvent.name_ar || selectedEvent.name) : (selectedEvent.name || selectedEvent.name_ar)) : 'Choose an event'}</h2>
                        <p>Keep one event in focus, watch attendance and RSVP movement, then jump into add-ons or workspace actions without losing context.</p>
                    </div>

                    <div className="report-live-shell__controls">
                        <div className="event-report-toolbar">
                            <label htmlFor="eventReportQuickSelect">Event</label>
                            <select
                                id="eventReportQuickSelect"
                                className="form-select"
                                value={selectedEventId}
                                onChange={(event) => setSelectedEventId(event.target.value)}
                            >
                                {eventOptions.map((event) => (
                                    <option key={event.id} value={event.id}>
                                        {isArabic ? (event.name_ar || event.name) : (event.name || event.name_ar)} · {isArabic ? (event.client_name_ar || event.client_name) : (event.client_name || event.client_name_ar)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button type="button" className={`report-live-toggle ${autoRefresh ? 'is-active' : ''}`} onClick={() => setAutoRefresh((value) => !value)}>
                            <Activity size={16} />
                            <span>{autoRefresh ? 'Auto refresh on' : 'Auto refresh off'}</span>
                        </button>
                    </div>
                </div>

                <div className="report-live-shell__meta">
                    <span>Last updated: {formatDateTime(lastUpdatedAt, i18n.language)}</span>
                    <div className="report-live-shell__links">
                        {selectedEventId && <Link to={`/events/${selectedEventId}`} className="report-live-link">Open event workspace</Link>}
                        {selectedEventId && <Link to={`/addons/polls?eventId=${selectedEventId}`} className="report-live-link">Open add-ons</Link>}
                        {selectedEventId && <Link to={`/send?eventId=${selectedEventId}`} className="report-live-link">Open send workspace</Link>}
                    </div>
                </div>

                {eventReport && !eventReportLoading && (
                    <div className="report-grid report-grid--four">
                        <OverviewCard title="Invited" value={formatNumber(eventReport?.invitationStats?.total_recipients)} subtitle={`Checked-in rate ${checkInRate}`} icon={Users} tone="primary" />
                        <OverviewCard title="Checked In" value={formatNumber(eventReport?.invitationStats?.checked_in_count)} subtitle={`Walk-ins ${formatNumber(eventReport?.walkInStats?.walk_in_count)}`} icon={UserCheck} tone="success" />
                        <OverviewCard title="Responded" value={formatNumber(eventReport?.rsvpStats?.total_submissions)} subtitle={`Attending ${formatNumber(eventReport?.rsvpStats?.attending_count)}`} icon={Reply} tone="accent" />
                        <OverviewCard title="Delivery" value={formatNumber(eventReport?.invitationStats?.sent_count)} subtitle={`Opened ${formatNumber(eventReport?.invitationStats?.opened_count)} · Failed ${formatNumber(eventReport?.invitationStats?.failed_count)}`} icon={Send} tone="dark" />
                    </div>
                )}
            </section>

            {error && <div className="reports-error">{error}</div>}

            <section className="report-section">
                <SectionHeader
                    title="Event Report Center"
                    subtitle="Select any event to view complete operational and attendance report, then export to PDF."
                    action={(
                        <button type="button" className="btn btn-secondary" onClick={exportEventReportPdf} disabled={!eventReport}>
                            <FileText size={16} />
                            <span>Export PDF</span>
                        </button>
                    )}
                />
                <div className="event-report-toolbar">
                    <label htmlFor="eventReportSelect">Event</label>
                    <select
                        id="eventReportSelect"
                        className="form-select"
                        value={selectedEventId}
                        onChange={(event) => setSelectedEventId(event.target.value)}
                    >
                        {eventOptions.map((event) => (
                            <option key={event.id} value={event.id}>
                                {isArabic ? (event.name_ar || event.name) : (event.name || event.name_ar)} · {isArabic ? (event.client_name_ar || event.client_name) : (event.client_name || event.client_name_ar)}
                            </option>
                        ))}
                    </select>
                </div>

                {eventReportError && <div className="reports-error">{eventReportError}</div>}

                {eventReportLoading ? (
                    <div className="report-empty">Loading event report...</div>
                ) : eventReport ? (
                    <div className="event-report-sheet" id="event-report-pdf">
                        <div className="event-report-sheet__header">
                            <div className="event-report-sheet__brand">
                                <img src="/yahala-logo.svg" alt="YaHala" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                <div>
                                    <strong>YaHala Event Report</strong>
                                    <small>{formatDateTime(new Date().toISOString(), i18n.language)}</small>
                                </div>
                            </div>
                            <div className="event-report-sheet__logos">
                                {eventReport?.event?.client_logo_path ? <img src={resolveStorageUrl(eventReport.event.client_logo_path)} alt="Client logo" /> : null}
                                {eventReport?.event?.event_logo_path ? <img src={resolveStorageUrl(eventReport.event.event_logo_path)} alt="Event logo" /> : null}
                            </div>
                        </div>

                        <div className="report-grid report-grid--four">
                            <OverviewCard title="Invited" value={formatNumber(eventReport?.invitationStats?.total_recipients)} icon={Users} tone="primary" />
                            <OverviewCard title="Checked In" value={formatNumber(eventReport?.invitationStats?.checked_in_count)} icon={UserCheck} tone="success" />
                            <OverviewCard title="Walk-ins" value={formatNumber(eventReport?.walkInStats?.walk_in_count)} icon={Activity} tone="accent" />
                            <OverviewCard title="Response Rate" value={percent(eventReport?.rsvpStats?.total_submissions, eventReport?.invitationStats?.total_recipients)} icon={Reply} tone="dark" />
                        </div>

                        <div className="report-mini-grid">
                            <div className="report-mini-card"><span>Sent</span><strong>{formatNumber(eventReport?.invitationStats?.sent_count)}</strong></div>
                            <div className="report-mini-card"><span>Delivered</span><strong>{formatNumber(eventReport?.invitationStats?.delivered_count)}</strong></div>
                            <div className="report-mini-card"><span>Opened</span><strong>{formatNumber(eventReport?.invitationStats?.opened_count)}</strong></div>
                            <div className="report-mini-card"><span>Responded</span><strong>{formatNumber(eventReport?.invitationStats?.responded_count)}</strong></div>
                            <div className="report-mini-card"><span>Failed</span><strong>{formatNumber(eventReport?.invitationStats?.failed_count)}</strong></div>
                            <div className="report-mini-card"><span>Opted Out</span><strong>{formatNumber(eventReport?.invitationStats?.opted_out_count)}</strong></div>
                            <div className="report-mini-card"><span>RSVP Attending</span><strong>{formatNumber(eventReport?.rsvpStats?.attending_count)}</strong></div>
                            <div className="report-mini-card"><span>RSVP Maybe</span><strong>{formatNumber(eventReport?.rsvpStats?.maybe_count)}</strong></div>
                        </div>

                        <div className="report-table-wrap">
                            <table className="data-table report-table">
                                <thead>
                                    <tr>
                                        <th>Guest</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th>Status</th>
                                        <th>Attendance</th>
                                        <th>Opened At</th>
                                        <th>Responded At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(eventReport.attendees || []).length === 0 ? (
                                        <tr><td colSpan="7" className="empty-cell">No attendees found for this event.</td></tr>
                                    ) : (
                                        eventReport.attendees.map((attendee) => (
                                            <tr key={attendee.recipient_id}>
                                                <td>{isArabic ? (attendee.display_name_ar || attendee.display_name || '—') : (attendee.display_name || attendee.display_name_ar || '—')}</td>
                                                <td>{attendee.email || '—'}</td>
                                                <td>{attendee.phone || '—'}</td>
                                                <td>{labelize(attendee.overall_status)}</td>
                                                <td>{labelize(attendee.attendance_status)}</td>
                                                <td>{formatDateTime(attendee.opened_at, i18n.language)}</td>
                                                <td>{formatDateTime(attendee.responded_at, i18n.language)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <EmptyState message="Choose an event to start reporting." />
                )}
            </section>

            <section className="report-section">
                <div className="report-callout">
                    <div>
                        <span className="eyebrow">{t('reports.responseLocationsTitle')}</span>
                        <h2>{t('reports.responseLocationsHeading')}</h2>
                        <p>{t('reports.responseLocationsSubtitle')}</p>
                    </div>
                    <div className="report-callout__links">
                        <Link to="/invitation-projects" className="report-callout__link">
                            <span>{t('reports.responseLocationsProjects')}</span>
                            <ChevronRight size={16} />
                        </Link>
                        <Link to="/logs" className="report-callout__link">
                            <span>{t('reports.responseLocationsLogs')}</span>
                            <ChevronRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            <section className="report-section">
                <SectionHeader
                    title={t('reports.overviewTitle')}
                    subtitle={t('reports.overviewSubtitle')}
                />
                <div className="report-grid report-grid--six">
                    <OverviewCard title={t('reports.clients')} value={formatNumber(overview.clients_total)} subtitle={t('reports.activeClients', { count: formatNumber(overview.active_clients) })} icon={Users} tone="primary" />
                    <OverviewCard title={t('reports.events')} value={formatNumber(overview.events_total)} subtitle={t('reports.activeEvents', { count: formatNumber(overview.active_events) })} icon={CalendarClock} tone="success" />
                    <OverviewCard title={t('reports.guests')} value={formatNumber(overview.guests_total)} subtitle={t('reports.scannerUsers', { count: formatNumber(overview.scanner_users) })} icon={UserCheck} tone="accent" />
                    <OverviewCard title={t('reports.recipients')} value={formatNumber(invitations.total_recipients)} subtitle={t('reports.responseRate', { rate: responseRate })} icon={Send} tone="dark" />
                    <OverviewCard title={t('reports.responses')} value={formatNumber(rsvp.total_submissions)} subtitle={t('reports.attendingCount', { count: formatNumber(rsvp.attending_count) })} icon={Reply} tone="neutral" />
                    <OverviewCard title={t('reports.pollVotes')} value={formatNumber(polls.total_votes)} subtitle={t('reports.publishedPolls', { count: formatNumber(polls.published_polls) })} icon={BarChart3} tone="accent" />
                    <OverviewCard title="Questionnaire submissions" value={formatNumber(questionnaires.total_submissions)} subtitle={`Published: ${formatNumber(questionnaires.published_questionnaires)}`} icon={FileText} tone="dark" />
                </div>
            </section>

            <section className="report-section">
                <SectionHeader
                    title={t('reports.invitationPerformance')}
                    subtitle={t('reports.invitationPerformanceSubtitle')}
                />
                <div className="report-mini-grid">
                    <div className="report-mini-card">
                        <span>{t('reports.sent')}</span>
                        <strong>{formatNumber(invitations.sent_count)}</strong>
                    </div>
                    <div className="report-mini-card">
                        <span>{t('reports.delivered')}</span>
                        <strong>{formatNumber(invitations.delivered_count)}</strong>
                    </div>
                    <div className="report-mini-card">
                        <span>{t('reports.opened')}</span>
                        <strong>{formatNumber(invitations.opened_count)}</strong>
                    </div>
                    <div className="report-mini-card">
                        <span>{t('reports.responded')}</span>
                        <strong>{formatNumber(invitations.responded_count)}</strong>
                    </div>
                    <div className="report-mini-card">
                        <span>{t('reports.failed')}</span>
                        <strong>{formatNumber(invitations.failed_count)}</strong>
                    </div>
                    <div className="report-mini-card">
                        <span>{t('reports.optedOut')}</span>
                        <strong>{formatNumber(invitations.opted_out_count)}</strong>
                    </div>
                    <div className="report-mini-card">
                        <span>{t('reports.openRate')}</span>
                        <strong>{openRate}</strong>
                    </div>
                    <div className="report-mini-card">
                        <span>{t('reports.responseRateShort')}</span>
                        <strong>{responseRate}</strong>
                    </div>
                </div>
            </section>

            <section className="report-section">
                <SectionHeader
                    title={t('reports.rsvpResponses')}
                    subtitle={t('reports.rsvpResponsesSubtitle')}
                />
                <div className="report-grid report-grid--four">
                    <OverviewCard title={t('reports.attending')} value={formatNumber(rsvp.attending_count)} icon={Reply} tone="success" />
                    <OverviewCard title={t('reports.notAttending')} value={formatNumber(rsvp.not_attending_count)} icon={X} tone="dark" />
                    <OverviewCard title={t('reports.maybe')} value={formatNumber(rsvp.maybe_count)} icon={Eye} tone="accent" />
                    <OverviewCard title={t('reports.totalSubmissions')} value={formatNumber(rsvp.total_submissions)} icon={FileText} tone="primary" />
                </div>

                <div className="report-table-wrap">
                    <table className="data-table report-table">
                        <thead>
                            <tr>
                                <th>{t('reports.guest')}</th>
                                <th>{t('reports.project')}</th>
                                <th>{t('reports.event')}</th>
                                <th>{t('reports.attendance')}</th>
                                <th>{t('reports.notes')}</th>
                                <th>{t('common.createdAt')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="loading-cell">{t('common.loading')}</td>
                                </tr>
                            ) : recentResponses.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="empty-cell">{t('reports.noResponses')}</td>
                                </tr>
                            ) : (
                                recentResponses.map((response) => {
                                    const guestName = isArabic
                                        ? (response.display_name_ar || response.display_name || '—')
                                        : (response.display_name || response.display_name_ar || '—');
                                    const projectName = isArabic
                                        ? (response.project_name_ar || response.project_name || '—')
                                        : (response.project_name || response.project_name_ar || '—');
                                    const eventName = isArabic
                                        ? (response.event_name_ar || response.event_name || '—')
                                        : (response.event_name || response.event_name_ar || '—');
                                    const attendance = String(response.response_data?.attendance || '').replace(/_/g, ' ');
                                    const notes = response.response_data?.notes || response.response_data?.note || '';

                                    return (
                                        <tr key={response.id}>
                                            <td>{guestName}</td>
                                            <td>{projectName}</td>
                                            <td>{eventName}</td>
                                            <td>{attendance ? labelize(attendance) : '—'}</td>
                                            <td>{notes || '—'}</td>
                                            <td>{formatDateTime(response.submitted_at, i18n.language)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="report-section">
                <SectionHeader
                    title={t('reports.topProjects')}
                    subtitle={t('reports.topProjectsSubtitle')}
                />
                <div className="report-table-wrap">
                    <table className="data-table report-table">
                        <thead>
                            <tr>
                                <th>{t('reports.project')}</th>
                                <th>{t('reports.client')}</th>
                                <th>{t('reports.recipientCount')}</th>
                                <th>{t('reports.responded')}</th>
                                <th>{t('reports.opened')}</th>
                                <th>{t('reports.failed')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="loading-cell">{t('common.loading')}</td>
                                </tr>
                            ) : topProjects.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-cell">{t('reports.noProjects')}</td>
                                </tr>
                            ) : (
                                topProjects.map((project) => {
                                    const projectName = isArabic
                                        ? (project.name_ar || project.name || '—')
                                        : (project.name || project.name_ar || '—');
                                    const clientName = isArabic
                                        ? (project.client_name_ar || project.client_name || '—')
                                        : (project.client_name || project.client_name_ar || '—');

                                    return (
                                        <tr key={project.id}>
                                            <td>{projectName}</td>
                                            <td>{clientName}</td>
                                            <td>{formatNumber(project.recipient_count)}</td>
                                            <td>{formatNumber(project.responded_count)}</td>
                                            <td>{formatNumber(project.opened_count)}</td>
                                            <td>{formatNumber(project.failed_count)}</td>
                                            <td>
                                                <Link to={`/invitation-projects/${project.id}`} className="action-btn" title={t('logs.openEntity')}>
                                                    <ChevronRight size={16} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="report-section">
                <SectionHeader
                    title={t('reports.topPolls')}
                    subtitle={t('reports.topPollsSubtitle')}
                />
                <div className="report-table-wrap">
                    <table className="data-table report-table">
                        <thead>
                            <tr>
                                <th>{t('reports.poll')}</th>
                                <th>{t('reports.client')}</th>
                                <th>{t('reports.event')}</th>
                                <th>{t('reports.status')}</th>
                                <th>{t('reports.mode')}</th>
                                <th>{t('reports.votes')}</th>
                                <th>{t('reports.participants')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="loading-cell">{t('common.loading')}</td>
                                </tr>
                            ) : topPolls.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="empty-cell">{t('reports.noPolls')}</td>
                                </tr>
                            ) : (
                                topPolls.map((poll) => {
                                    const pollTitle = isArabic
                                        ? (poll.title_ar || poll.title || '—')
                                        : (poll.title || poll.title_ar || '—');
                                    const clientName = isArabic
                                        ? (poll.client_name_ar || poll.client_name || '—')
                                        : (poll.client_name || poll.client_name_ar || '—');
                                    const eventName = isArabic
                                        ? (poll.event_name_ar || poll.event_name || '—')
                                        : (poll.event_name || poll.event_name_ar || '—');

                                    return (
                                        <tr key={poll.id}>
                                            <td>{pollTitle}</td>
                                            <td>{clientName}</td>
                                            <td>{eventName}</td>
                                            <td>
                                                <span className="report-status-pill">{labelize(poll.status)}</span>
                                            </td>
                                            <td>{labelize(poll.poll_mode)}</td>
                                            <td>{formatNumber(poll.total_votes)}</td>
                                            <td>{formatNumber(poll.participants_count)}</td>
                                            <td>
                                                <Link to={`/addons/polls/${poll.id}`} className="action-btn" title={t('logs.openEntity')}>
                                                    <ChevronRight size={16} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="report-section">
                <SectionHeader
                    title="Top questionnaires"
                    subtitle="Questionnaires ranked by submission volume."
                />
                <div className="report-table-wrap">
                    <table className="data-table report-table">
                        <thead>
                            <tr>
                                <th>Questionnaire</th>
                                <th>{t('reports.client')}</th>
                                <th>{t('reports.event')}</th>
                                <th>{t('reports.status')}</th>
                                <th>Questions</th>
                                <th>Submissions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="loading-cell">{t('common.loading')}</td>
                                </tr>
                            ) : topQuestionnaires.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="empty-cell">No questionnaires found</td>
                                </tr>
                            ) : (
                                topQuestionnaires.map((questionnaire) => {
                                    const questionnaireTitle = isArabic
                                        ? (questionnaire.title_ar || questionnaire.title || '—')
                                        : (questionnaire.title || questionnaire.title_ar || '—');
                                    const clientName = isArabic
                                        ? (questionnaire.client_name_ar || questionnaire.client_name || '—')
                                        : (questionnaire.client_name || questionnaire.client_name_ar || '—');
                                    const eventName = isArabic
                                        ? (questionnaire.event_name_ar || questionnaire.event_name || '—')
                                        : (questionnaire.event_name || questionnaire.event_name_ar || '—');

                                    return (
                                        <tr key={questionnaire.id}>
                                            <td>{questionnaireTitle}</td>
                                            <td>{clientName}</td>
                                            <td>{eventName}</td>
                                            <td><span className="report-status-pill">{labelize(questionnaire.status)}</span></td>
                                            <td>{formatNumber(questionnaire.question_count)}</td>
                                            <td>{formatNumber(questionnaire.submission_count)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="report-section">
                <SectionHeader
                    title={t('reports.recentActivity')}
                    subtitle={t('reports.recentActivitySubtitle')}
                />
                <div className="report-table-wrap">
                    <table className="data-table report-table">
                        <thead>
                            <tr>
                                <th>{t('common.createdAt')}</th>
                                <th>{t('logs.actor')}</th>
                                <th>{t('logs.action')}</th>
                                <th>{t('logs.entity')}</th>
                                <th>{t('logs.details')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="loading-cell">{t('common.loading')}</td>
                                </tr>
                            ) : recentActivity.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">{t('reports.noActivity')}</td>
                                </tr>
                            ) : (
                                recentActivity.map((entry) => (
                                    <tr key={entry.id}>
                                        <td>{formatDateTime(entry.created_at, i18n.language)}</td>
                                        <td>{entry.actor_name || 'System'}</td>
                                        <td>{labelize(entry.action)}</td>
                                        <td>{labelize(entry.entity_type || '—')}</td>
                                        <td>{Object.keys(entry.details || {}).slice(0, 3).join(', ') || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
