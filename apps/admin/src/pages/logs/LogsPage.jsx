import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Filter,
    FileText,
    RefreshCw,
    Search,
    Shield,
    Sparkles,
    Users,
    X
} from 'lucide-react';
import api from '../../services/api';
import '../clients/ClientListPage.css';
import './LogsPage.css';

const DEFAULT_PAGINATION = {
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0
};

const DEFAULT_FILTERS = {
    search: '',
    action: 'all',
    userType: 'all',
    entityType: 'all',
    entityId: '',
    fromDate: '',
    toDate: ''
};

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

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
}

function humanize(value) {
    return String(value || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\w/, (char) => char.toUpperCase());
}

function resolveEntityLink(log) {
    const details = log?.details && typeof log.details === 'object' ? log.details : {};

    if (details.clientId) {
        return `/clients/${details.clientId}`;
    }

    if (details.eventId) {
        return `/events/${details.eventId}`;
    }

    if (details.projectId) {
        return `/invitation-projects/${details.projectId}`;
    }

    if (log.entity_type === 'client' && log.entity_id) {
        return `/clients/${log.entity_id}`;
    }

    if (log.entity_type === 'event' && log.entity_id) {
        return `/events/${log.entity_id}`;
    }

    if (log.entity_type === 'invitation_project' && log.entity_id) {
        return `/invitation-projects/${log.entity_id}`;
    }

    return '';
}

function LogSummaryCard({ title, value, subtitle, icon: Icon, tone = 'neutral' }) {
    return (
        <div className={`log-summary-card log-summary-card--${tone}`}>
            <div className="log-summary-card__icon">
                <Icon size={18} />
            </div>
            <div className="log-summary-card__content">
                <span>{title}</span>
                <strong>{value}</strong>
                {subtitle && <small>{subtitle}</small>}
            </div>
        </div>
    );
}

function LogDrawer({ log, language, onClose }) {
    const { t } = useTranslation();

    if (!log) {
        return null;
    }

    const details = log.details && typeof log.details === 'object' ? log.details : {};
    const link = resolveEntityLink(log);

    return (
        <div className="log-drawer-backdrop" role="presentation" onClick={onClose}>
            <aside className="log-drawer" role="dialog" aria-modal="true" aria-label={log.action} onClick={(event) => event.stopPropagation()}>
                <div className="log-drawer__header">
                    <div>
                        <span className="drawer-eyebrow">{t('logs.detailsTitle')}</span>
                        <h2>{humanize(log.action)}</h2>
                        <p>{log.actor_name || t('common.notAvailable')}</p>
                    </div>
                    <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}>
                        <X size={18} />
                    </button>
                </div>

                <div className="log-drawer__profile">
                    <div className="log-drawer__avatar">
                        {log.user_type === 'scanner' ? <Shield size={22} /> : <Users size={22} />}
                    </div>
                    <div className="log-drawer__meta">
                        <strong>{log.actor_name || t('common.notAvailable')}</strong>
                        <span>{humanize(log.actor_role || log.user_type)}</span>
                        <span>{log.actor_email || t('common.notAvailable')}</span>
                    </div>
                </div>

                <div className="log-drawer__grid">
                    <div className="log-drawer__card">
                        <span>{t('logs.action')}</span>
                        <strong>{humanize(log.action)}</strong>
                    </div>
                    <div className="log-drawer__card">
                        <span>{t('logs.userType')}</span>
                        <strong>{humanize(log.user_type || 'system')}</strong>
                    </div>
                    <div className="log-drawer__card">
                        <span>{t('logs.entityType')}</span>
                        <strong>{humanize(log.entity_type || '—')}</strong>
                    </div>
                    <div className="log-drawer__card">
                        <span>{t('logs.ipAddress')}</span>
                        <strong>{log.ip_address || '—'}</strong>
                    </div>
                </div>

                <div className="log-drawer__timeline">
                    <div className="log-drawer__timeline-row">
                        <CalendarClock size={16} />
                        <div>
                            <span>{t('common.createdAt')}</span>
                            <strong>{formatDateTime(log.created_at, language)}</strong>
                        </div>
                    </div>
                    <div className="log-drawer__timeline-row">
                        <Sparkles size={16} />
                        <div>
                            <span>{t('logs.entityId')}</span>
                            <strong>{log.entity_id || '—'}</strong>
                        </div>
                    </div>
                </div>

                {Object.keys(details).length > 0 && (
                    <div className="log-drawer__details">
                        <div className="log-drawer__details-header">
                            <h3>{t('logs.detailsPayload')}</h3>
                            {link && (
                                <Link to={link} className="btn btn-primary">
                                    {t('logs.openEntity')}
                                </Link>
                            )}
                        </div>
                        <pre>{JSON.stringify(details, null, 2)}</pre>
                    </div>
                )}

                {!Object.keys(details).length && link && (
                    <div className="log-drawer__footer">
                        <Link to={link} className="btn btn-primary">
                            {t('logs.openEntity')}
                        </Link>
                    </div>
                )}
            </aside>
        </div>
    );
}

export default function LogsPage() {
    const { t, i18n } = useTranslation();
    const [logs, setLogs] = useState([]);
    const [summary, setSummary] = useState({
        total: 0,
        admin_actions: 0,
        scanner_actions: 0,
        guest_attended: 0,
        duplicate_scans: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [selectedLog, setSelectedLog] = useState(null);
    const [refreshTick, setRefreshTick] = useState(0);
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        let mounted = true;

        async function fetchLogs() {
            setLoading(true);
            setError('');

            try {
                const params = new URLSearchParams({
                    page: String(pagination.page),
                    pageSize: String(pagination.pageSize),
                    sortBy,
                    sortOrder
                });

                if (filters.search.trim()) {
                    params.set('search', filters.search.trim());
                }

                if (filters.action !== 'all') {
                    params.set('action', filters.action);
                }

                if (filters.userType !== 'all') {
                    params.set('userType', filters.userType);
                }

                if (filters.entityType !== 'all') {
                    params.set('entityType', filters.entityType);
                }

                if (filters.entityId.trim()) {
                    params.set('entityId', filters.entityId.trim());
                }

                if (filters.fromDate) {
                    params.set('fromDate', filters.fromDate);
                }

                if (filters.toDate) {
                    params.set('toDate', filters.toDate);
                }

                const response = await api.get(`/admin/logs?${params}`);

                if (!mounted) {
                    return;
                }

                setLogs(response.data.data || []);
                setSummary(response.data.summary || {});
                setPagination((prev) => ({
                    ...prev,
                    ...response.data.pagination
                }));

                if (selectedLog) {
                    const refreshed = (response.data.data || []).find((entry) => entry.id === selectedLog.id);
                    setSelectedLog(refreshed || null);
                }
            } catch (fetchError) {
                console.error('Failed to fetch logs:', fetchError);
                if (mounted) {
                    setLogs([]);
                    setError(fetchError.response?.data?.message || t('logs.loadFailed'));
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        const timer = window.setTimeout(fetchLogs, filters.search.trim() ? 250 : 0);

        return () => {
            mounted = false;
            window.clearTimeout(timer);
        };
    }, [
        filters.search,
        filters.action,
        filters.userType,
        filters.entityType,
        filters.entityId,
        filters.fromDate,
        filters.toDate,
        pagination.page,
        pagination.pageSize,
        refreshTick,
        sortBy,
        sortOrder,
        t
    ]);

    function handleFilterChange(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPagination((prev) => ({ ...prev, page: 1 }));
    }

    function handleRefresh() {
        setRefreshTick((value) => value + 1);
    }

    function clearFilters() {
        setFilters(DEFAULT_FILTERS);
        setSortBy('created_at');
        setSortOrder('desc');
        setPagination((prev) => ({ ...prev, page: 1 }));
    }

    function handleSort(column) {
        const nextOrder = sortBy === column ? (sortOrder === 'asc' ? 'desc' : 'asc') : (column === 'created_at' ? 'desc' : 'asc');
        setSortBy(column);
        setSortOrder(nextOrder);
        setPagination((prev) => ({ ...prev, page: 1 }));
    }

    const hasFilters =
        filters.search.trim() ||
        filters.action !== 'all' ||
        filters.userType !== 'all' ||
        filters.entityType !== 'all' ||
        filters.entityId.trim() ||
        filters.fromDate ||
        filters.toDate;

    const actionOptions = ['all', 'guest_attended', 'duplicate_scan'];
    const userTypeOptions = ['all', 'admin', 'scanner'];
    const entityTypeOptions = ['all', 'invitation_recipient', 'client', 'event', 'invitation_project'];

    return (
        <div className="logs-page">
            <div className="page-header hub-display-title">
                <div>
                    <h1>{t('nav.logs')}</h1>
                    <p>{t('logs.subtitle')}</p>
                </div>
                <div className="logs-header-actions">
                    <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={!hasFilters}>
                        <Filter size={16} />
                        <span>{t('logs.clearFilters')}</span>
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleRefresh} disabled={loading}>
                        <RefreshCw size={16} />
                        <span>{t('common.refresh')}</span>
                    </button>
                </div>
            </div>

            <div className="log-summary-grid">
                <LogSummaryCard
                    title={t('logs.summaryTotal')}
                    value={formatNumber(summary.total)}
                    subtitle={t('logs.summaryTotalHint')}
                    icon={Activity}
                    tone="primary"
                />
                <LogSummaryCard
                    title={t('logs.summaryAdmin')}
                    value={formatNumber(summary.admin_actions)}
                    subtitle={t('logs.summaryAdminHint')}
                    icon={Shield}
                    tone="success"
                />
                <LogSummaryCard
                    title={t('logs.summaryScanner')}
                    value={formatNumber(summary.scanner_actions)}
                    subtitle={t('logs.summaryScannerHint')}
                    icon={Users}
                    tone="accent"
                />
                <LogSummaryCard
                    title={t('logs.summaryGuestAttended')}
                    value={formatNumber(summary.guest_attended)}
                    subtitle={t('logs.summaryGuestAttendedHint')}
                    icon={Clock3}
                    tone="dark"
                />
            </div>

            <div className="filters-bar logs-filters-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder={t('logs.searchPlaceholder')}
                        value={filters.search}
                        onChange={(event) => handleFilterChange('search', event.target.value)}
                    />
                </div>

                <div className="filter-pill">
                    <select value={filters.action} onChange={(event) => handleFilterChange('action', event.target.value)}>
                        {actionOptions.map((option) => (
                            <option key={option} value={option}>
                                {option === 'all' ? t('logs.allActions') : humanize(option)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-pill">
                    <select value={filters.userType} onChange={(event) => handleFilterChange('userType', event.target.value)}>
                        {userTypeOptions.map((option) => (
                            <option key={option} value={option}>
                                {option === 'all' ? t('logs.allUserTypes') : humanize(option)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-pill">
                    <select value={filters.entityType} onChange={(event) => handleFilterChange('entityType', event.target.value)}>
                        {entityTypeOptions.map((option) => (
                            <option key={option} value={option}>
                                {option === 'all' ? t('logs.allEntityTypes') : humanize(option)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-pill">
                    <input
                        type="date"
                        value={filters.fromDate}
                        onChange={(event) => handleFilterChange('fromDate', event.target.value)}
                        aria-label={t('logs.fromDate')}
                    />
                </div>

                <div className="filter-pill">
                    <input
                        type="date"
                        value={filters.toDate}
                        onChange={(event) => handleFilterChange('toDate', event.target.value)}
                        aria-label={t('logs.toDate')}
                    />
                </div>
            </div>

            {error && <div className="logs-error">{error}</div>}

            <div className="table-container logs-table-container">
                <table className="data-table logs-table">
                    <thead>
                        <tr>
                            <th>
                                <button type="button" className="logs-sort" onClick={() => handleSort('created_at')}>
                                    <span>{t('common.createdAt')}</span>
                                </button>
                            </th>
                            <th>{t('logs.actor')}</th>
                            <th>{t('logs.action')}</th>
                            <th>{t('logs.entity')}</th>
                            <th>{t('logs.userType')}</th>
                            <th>{t('logs.ipAddress')}</th>
                            <th>{t('logs.details')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="8" className="loading-cell">
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="empty-cell">
                                    {t('logs.noLogs')}
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => {
                                const link = resolveEntityLink(log);

                                return (
                                    <tr
                                        key={log.id}
                                        className={selectedLog?.id === log.id ? 'is-selected' : ''}
                                        onClick={() => setSelectedLog(log)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                setSelectedLog(log);
                                            }
                                        }}
                                    >
                                        <td>{formatDateTime(log.created_at, i18n.language)}</td>
                                        <td>
                                            <div className="log-actor-cell">
                                                <strong>{log.actor_name || 'System'}</strong>
                                                <span>{log.actor_email || log.actor_role || humanize(log.user_type)}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="log-action-pill">{humanize(log.action)}</span>
                                        </td>
                                        <td>
                                            <div className="log-entity-cell">
                                                <strong>{humanize(log.entity_type || '—')}</strong>
                                                <span>{log.entity_id || '—'}</span>
                                            </div>
                                        </td>
                                        <td>{humanize(log.user_type || 'system')}</td>
                                        <td>{log.ip_address || '—'}</td>
                                        <td>
                                            <div className="log-details-cell">
                                                <span>{Object.keys(log.details || {}).slice(0, 3).join(', ') || '—'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    type="button"
                                                    className="action-btn"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setSelectedLog(log);
                                                    }}
                                                    title={t('common.view')}
                                                >
                                                    <FileText size={16} />
                                                </button>
                                                {link && (
                                                    <Link
                                                        to={link}
                                                        className="action-btn"
                                                        title={t('logs.openEntity')}
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        <ChevronRight size={16} />
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="pagination">
                <button
                    type="button"
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page <= 1 || loading}
                >
                    <ChevronLeft size={16} />
                    <span>{t('common.previous')}</span>
                </button>
                <span>{t('common.pageOf', { page: pagination.page, totalPages: pagination.totalPages || 1 })}</span>
                <button
                    type="button"
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages || 1, prev.page + 1) }))}
                    disabled={pagination.page >= (pagination.totalPages || 1) || loading}
                >
                    <span>{t('common.next')}</span>
                    <ChevronRight size={16} />
                </button>
            </div>

            {selectedLog && (
                <LogDrawer
                    log={selectedLog}
                    language={i18n.language}
                    onClose={() => setSelectedLog(null)}
                />
            )}
        </div>
    );
}
