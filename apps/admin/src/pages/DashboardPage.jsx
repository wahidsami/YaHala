import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, BarChart3, CalendarPlus, Clock3, FolderPlus, ScanLine, Users, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import RoleGuard from '../components/auth/RoleGuard';
import './DashboardPage.css';

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
}

function formatActivityAction(action) {
    const labels = {
        guest_attended: 'Guest attended',
        duplicate_scan: 'Duplicate scan',
        login: 'Login',
        create: 'Created',
        update: 'Updated',
        delete: 'Deleted'
    };

    return labels[action] || action || 'Activity';
}

function TrendChart({ rows, keys }) {
    const maxValue = Math.max(
        1,
        ...rows.flatMap((row) => keys.map((key) => Number(row[key.key] || 0)))
    );

    return (
        <div className="trend-chart">
            {rows.map((row) => (
                <div key={row.label} className="trend-row">
                    <div className="trend-label">{row.label}</div>
                    <div className="trend-bars">
                        {keys.map((item) => {
                            const value = Number(row[item.key] || 0);
                            const height = Math.max(8, (value / maxValue) * 100);
                            return (
                                <div key={item.key} className="trend-bar-group">
                                    <div className="trend-bar-track">
                                        <div
                                            className={`trend-bar ${item.className}`}
                                            style={{ height: `${height}%` }}
                                            title={`${item.label}: ${value}`}
                                        />
                                    </div>
                                    <span className="trend-bar-value">{formatNumber(value)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            <div className="trend-legend">
                {keys.map((item) => (
                    <span key={item.key} className={`trend-legend-item ${item.className}`}>
                        {item.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function StatusChart({ rows }) {
    const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0) || 1;

    return (
        <div className="status-chart">
            {rows.map((row) => {
                const percent = (Number(row.count || 0) / total) * 100;
                return (
                    <div key={row.status} className="status-chart-row">
                        <div className="status-chart-head">
                            <span className={`status-pill status-${row.status}`}>{row.status}</span>
                            <strong>{formatNumber(row.count)}</strong>
                        </div>
                        <div className="status-chart-track">
                            <div className={`status-chart-fill status-${row.status}`} style={{ width: `${percent}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function DashboardPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const chartKeys = [
        { key: 'clients', label: t('dashboard.clientsCreated'), className: 'clients' },
        { key: 'events', label: t('dashboard.eventsCreated'), className: 'events' },
        { key: 'guests', label: t('dashboard.guestsCreated'), className: 'guests' },
        { key: 'scans', label: t('dashboard.scansMade'), className: 'scans' }
    ];

    useEffect(() => {
        fetchSummary();
    }, []);

    async function fetchSummary() {
        setLoading(true);
        try {
            const response = await api.get('/admin/dashboard/summary');
            setSummary(response.data.data);
        } catch (error) {
            console.error('Failed to fetch dashboard summary:', error);
        } finally {
            setLoading(false);
        }
    }

    const totals = summary?.totals || {};
    const monthlyTrend = summary?.monthlyTrend || [];
    const eventStatusBreakdown = summary?.eventStatusBreakdown || [];
    const recentActivity = summary?.recentActivity || [];
    const recentRsvpResponses = summary?.recentRsvpResponses || [];

    return (
        <div className="dashboard-page">
            <div className="page-header">
                <div>
                    <h1>{t('dashboard.title')}</h1>
                    <p>{t('dashboard.welcome')}, {user?.name}!</p>
                </div>
                <button className="refresh-btn" onClick={fetchSummary} disabled={loading}>
                    {t('common.refresh')}
                </button>
            </div>

            <div className="kpi-grid">
                <div className="kpi-card">
                    <span className="kpi-label">{t('dashboard.clients')}</span>
                    <span className="kpi-value">{formatNumber(totals.clients_total)}</span>
                    <span className="kpi-subvalue">{t('dashboard.activeClients')}: {formatNumber(totals.active_clients)}</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-label">{t('dashboard.events')}</span>
                    <span className="kpi-value">{formatNumber(totals.events_total)}</span>
                    <span className="kpi-subvalue">{t('dashboard.activeEvents')}: {formatNumber(totals.active_events)}</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-label">{t('dashboard.guests')}</span>
                    <span className="kpi-value">{formatNumber(totals.guests_total)}</span>
                    <span className="kpi-subvalue">{t('dashboard.scannerUsers')}: {formatNumber(totals.scanner_users)}</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-label">{t('dashboard.scans')}</span>
                    <span className="kpi-value">{formatNumber(totals.scans_total)}</span>
                    <span className="kpi-subvalue">{t('dashboard.activityLog')}</span>
                </div>
            </div>

            <div className="quick-actions-section">
                <div className="section-header">
                    <h2>{t('dashboard.quickActions')}</h2>
                </div>
                <div className="quick-actions-grid">
                    <RoleGuard permission="clients.create">
                        <Link to="/clients/new" className="quick-action-card">
                            <UserPlus size={20} />
                            <span>{t('dashboard.newClient')}</span>
                        </Link>
                    </RoleGuard>
                    <RoleGuard permission="events.create">
                        <Link to="/events/new" className="quick-action-card">
                            <CalendarPlus size={20} />
                            <span>{t('dashboard.newEvent')}</span>
                        </Link>
                    </RoleGuard>
                    <RoleGuard permission="events.create">
                        <Link to="/invitation-projects/new" className="quick-action-card">
                            <FolderPlus size={20} />
                            <span>{t('dashboard.newInvitationProject')}</span>
                        </Link>
                    </RoleGuard>
                    <RoleGuard permission="scanner_users.create">
                        <Link to="/settings" className="quick-action-card">
                            <ScanLine size={20} />
                            <span>{t('dashboard.openScanner')}</span>
                        </Link>
                    </RoleGuard>
                </div>
            </div>

            <div className="insight-grid">
                <div className="insight-card">
                    <div className="section-header">
                        <h2>{t('dashboard.businessTrend')}</h2>
                        <span className="section-note">{t('dashboard.months')}</span>
                    </div>
                    {loading ? (
                        <div className="card-loading">Loading...</div>
                    ) : (
                        <TrendChart rows={monthlyTrend} keys={chartKeys} />
                    )}
                </div>

                <div className="insight-card">
                    <div className="section-header">
                        <h2>{t('dashboard.eventStatusMix')}</h2>
                        <BarChart3 size={18} />
                    </div>
                    {loading ? (
                        <div className="card-loading">Loading...</div>
                    ) : (
                        <StatusChart rows={eventStatusBreakdown} />
                    )}
                </div>
            </div>

            <div className="insight-card rsvp-card">
                <div className="section-header">
                    <div>
                        <h2>{t('dashboard.recentRsvpResponses')}</h2>
                        <p className="section-note">{t('dashboard.recentRsvpResponsesSubtitle')}</p>
                    </div>
                    <Link to="/reports" className="section-link">
                        {t('dashboard.viewAllReports')}
                    </Link>
                </div>

                {loading ? (
                    <div className="card-loading">{t('common.loading')}</div>
                ) : recentRsvpResponses.length === 0 ? (
                    <div className="empty-state">{t('dashboard.noRsvpResponses')}</div>
                ) : (
                    <div className="dashboard-table-wrap">
                        <table className="dashboard-table">
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
                                {recentRsvpResponses.map((response) => {
                                    const guestName = response.display_name || response.display_name_ar || '—';
                                    const projectName = response.project_name || response.project_name_ar || '—';
                                    const eventName = response.event_name || response.event_name_ar || '—';
                                    const attendanceValue = String(response.response_data?.attendance || '').toLowerCase();
                                    const attendance = {
                                        attending: t('reports.attending'),
                                        not_attending: t('reports.notAttending'),
                                        maybe: t('reports.maybe')
                                    }[attendanceValue] || response.response_data?.attendance || '—';
                                    const notes = response.response_data?.notes || response.response_data?.note || '';

                                    return (
                                        <tr key={response.id}>
                                            <td>{guestName}</td>
                                            <td>{projectName}</td>
                                            <td>{eventName}</td>
                                            <td><span className="dashboard-response-pill">{attendance}</span></td>
                                            <td>{notes || '—'}</td>
                                            <td>{new Date(response.submitted_at).toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="insight-card activity-card">
                <div className="section-header">
                    <h2>{t('dashboard.activityLog')}</h2>
                    <Activity size={18} />
                </div>
                {loading ? (
                    <div className="card-loading">Loading...</div>
                ) : recentActivity.length === 0 ? (
                    <div className="empty-state">No activity yet.</div>
                ) : (
                    <div className="activity-list">
                        {recentActivity.map((item) => (
                            <div key={item.id} className="activity-row">
                                <div className="activity-main">
                                    <strong>{item.actorName}</strong>
                                    <span>{formatActivityAction(item.action)}</span>
                                </div>
                                <div className="activity-meta">
                                    <span>{item.entityType || 'system'}</span>
                                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
