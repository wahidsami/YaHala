import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshTick, setRefreshTick] = useState(0);

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

    const overview = data?.summary || {};
    const invitations = data?.invitations || {};
    const rsvp = data?.rsvp || {};
    const polls = data?.polls || {};
    const recentResponses = data?.recentResponses || [];
    const topProjects = data?.topProjects || [];
    const topPolls = data?.topPolls || [];
    const recentActivity = data?.recentActivity || [];

    const responseRate = useMemo(() => percent(rsvp.total_submissions, invitations.total_recipients), [invitations.total_recipients, rsvp.total_submissions]);
    const openRate = useMemo(() => percent(invitations.opened_count, invitations.total_recipients), [invitations.opened_count, invitations.total_recipients]);

    function refreshReports() {
        setRefreshTick((value) => value + 1);
    }

    return (
        <div className="reports-page">
            <div className="page-header">
                <div>
                    <h1>{t('nav.reports')}</h1>
                    <p>{t('reports.subtitle')}</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={refreshReports} disabled={loading}>
                    <RefreshCw size={16} />
                    <span>{t('common.refresh')}</span>
                </button>
            </div>

            {error && <div className="reports-error">{error}</div>}

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
