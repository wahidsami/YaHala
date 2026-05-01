import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Edit, Plus, Power, Search, Trash2, Layers3, MessageSquare, ClipboardList, HelpCircle, BookText, Download } from 'lucide-react';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import RoleGuard from '../../components/auth/RoleGuard';
import './AddonsPage.css';

const ADDON_TABS = [
    { id: 'poll', labelKey: 'addons.pollTab', icon: MessageSquare },
    { id: 'questionnaire', labelKey: 'addons.questionnaireTab', icon: ClipboardList },
    { id: 'quiz', labelKey: 'addons.quizTab', icon: HelpCircle },
    { id: 'instructions', labelKey: 'addons.instructionsTab', icon: BookText },
    { id: 'files_downloads', labelKey: 'addons.filesDownloadsTab', icon: Download }
];

function localizedText(i18n, primary, secondary) {
    return i18n.language?.startsWith('ar') ? (secondary || primary || '') : (primary || secondary || '');
}

function formatDate(i18n, value) {
    if (!value) {
        return '';
    }

    const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US';
    return new Date(value).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function StatCard({ title, value, tone = 'default' }) {
    return (
        <div className={`addon-stat-card tone-${tone}`}>
            <span className="addon-stat-value">{value}</span>
            <span className="addon-stat-title">{title}</span>
        </div>
    );
}

export default function AddonsPage() {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState('poll');
    const [stats, setStats] = useState(null);
    const [clients, setClients] = useState([]);
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        mode: 'all',
        clientId: 'all'
    });
    const [selectedIds, setSelectedIds] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [actionBusy, setActionBusy] = useState(null);

    useEffect(() => {
        fetchStats();
        fetchClients();
    }, []);

    useEffect(() => {
        if (activeTab === 'poll') {
            fetchPolls();
        }
    }, [activeTab, filters, pagination.page]);

    async function fetchStats() {
        try {
            const response = await api.get('/admin/polls/stats');
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to fetch poll stats:', error);
        }
    }

    async function fetchClients() {
        try {
            const response = await api.get('/admin/clients?pageSize=200&status=active');
            setClients(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch clients for addons:', error);
        }
    }

    async function fetchPolls() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                pageSize: pagination.pageSize,
                ...(filters.search && { search: filters.search }),
                ...(filters.status !== 'all' && { status: filters.status }),
                ...(filters.mode !== 'all' && { mode: filters.mode }),
                ...(filters.clientId !== 'all' && { clientId: filters.clientId })
            });
            const response = await api.get(`/admin/polls?${params}`);
            setPolls(response.data.data || []);
            setPagination(prev => ({ ...prev, ...response.data.pagination }));
            setSelectedIds([]);
        } catch (error) {
            console.error('Failed to fetch polls:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(event) {
        setFilters(prev => ({ ...prev, search: event.target.value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }

    function handleFilterChange(key, value) {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }

    function toggleSelected(id) {
        setSelectedIds((prev) => (
            prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
        ));
    }

    function toggleSelectAll() {
        if (selectedIds.length === polls.length) {
            setSelectedIds([]);
            return;
        }

        setSelectedIds(polls.map((poll) => poll.id));
    }

    async function executeToggleStatus(poll, nextStatus) {
        setActionBusy({ type: 'status', id: poll.id });
        try {
            await api.patch(`/admin/polls/${poll.id}/status`, { status: nextStatus });
            await fetchPolls();
            await fetchStats();
        } catch (error) {
            console.error('Failed to update poll status:', error);
        } finally {
            setActionBusy(null);
        }
    }

    function handleToggleStatus(poll) {
        const nextStatus = poll.status === 'published' ? 'draft' : 'published';
        setConfirmDialog({
            title: t('common.confirmAction'),
            description: poll.status === 'published' ? t('addons.polls.unpublishConfirm') : t('addons.polls.publishConfirm'),
            confirmLabel: poll.status === 'published' ? t('addons.polls.unpublish') : t('addons.polls.publish'),
            variant: 'warning',
            onConfirm: () => executeToggleStatus(poll, nextStatus)
        });
    }

    async function executeDeletePoll(poll) {
        setActionBusy({ type: 'delete', id: poll.id });
        try {
            await api.delete(`/admin/polls/${poll.id}`);
            await fetchPolls();
            await fetchStats();
        } catch (error) {
            console.error('Failed to delete poll:', error);
        } finally {
            setActionBusy(null);
        }
    }

    function handleDeletePoll(poll) {
        setConfirmDialog({
            title: t('common.confirmAction'),
            description: t('addons.polls.deleteConfirm'),
            confirmLabel: t('common.delete'),
            variant: 'danger',
            onConfirm: () => executeDeletePoll(poll)
        });
    }

    const isArabic = i18n.language?.startsWith('ar');

    const addonStats = useMemo(() => [
        { title: t('addons.polls.total'), value: stats?.total_polls || 0, tone: 'primary' },
        { title: t('addons.polls.published'), value: stats?.published_polls || 0, tone: 'success' },
        { title: t('addons.polls.draft'), value: stats?.draft_polls || 0, tone: 'warning' },
        { title: t('addons.polls.participants'), value: stats?.total_participants || 0, tone: 'accent' }
    ], [stats, t]);

    return (
        <div className="addons-page">
            <div className="page-header">
                <div>
                    <h1>{t('addons.title')}</h1>
                    <p>{t('addons.subtitle')}</p>
                </div>
                <RoleGuard permission="events.edit">
                    <Link to="/addons/polls/new" className="btn btn-primary">
                        <Plus size={18} />
                        <span>{t('addons.polls.create')}</span>
                    </Link>
                </RoleGuard>
            </div>

            <ConfirmDialog
                open={Boolean(confirmDialog)}
                title={confirmDialog?.title || ''}
                description={confirmDialog?.description || ''}
                confirmLabel={confirmDialog?.confirmLabel || t('common.confirm')}
                cancelLabel={t('common.cancel')}
                variant={confirmDialog?.variant || 'danger'}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />

            <div className="addons-stats-grid">
                {addonStats.map((card) => (
                    <StatCard key={card.title} {...card} />
                ))}
            </div>

            <div className="addons-tabs">
                {ADDON_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            type="button"
                            key={tab.id}
                            className={activeTab === tab.id ? 'active' : ''}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <Icon size={16} />
                            <span>{t(tab.labelKey)}</span>
                        </button>
                    );
                })}
            </div>

            {activeTab === 'poll' ? (
                <div className="addon-tab-panel">
                    <div className="filters-bar">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder={t('addons.polls.searchPlaceholder')}
                                value={filters.search}
                                onChange={handleSearch}
                            />
                        </div>

                        <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                            <option value="all">{t('addons.polls.allStatuses')}</option>
                            <option value="draft">{t('addons.polls.status.draft')}</option>
                            <option value="published">{t('addons.polls.status.published')}</option>
                            <option value="ended">{t('addons.polls.status.ended')}</option>
                            <option value="archived">{t('addons.polls.status.archived')}</option>
                        </select>

                        <select value={filters.mode} onChange={(e) => handleFilterChange('mode', e.target.value)}>
                            <option value="all">{t('addons.polls.allModes')}</option>
                            <option value="named">{t('addons.polls.mode.named')}</option>
                            <option value="anonymous">{t('addons.polls.mode.anonymous')}</option>
                        </select>

                        <select value={filters.clientId} onChange={(e) => handleFilterChange('clientId', e.target.value)}>
                            <option value="all">{t('clients.form.client')}</option>
                            {clients.map((client) => (
                                <option key={client.id} value={client.id}>
                                    {client.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="select-column">
                                        <input
                                            type="checkbox"
                                            checked={polls.length > 0 && selectedIds.length === polls.length}
                                            onChange={toggleSelectAll}
                                            aria-label={t('addons.polls.selectAll')}
                                        />
                                    </th>
                                    <th>{t('addons.polls.table.poll')}</th>
                                    <th>{t('addons.polls.table.client')}</th>
                                    <th>{t('addons.polls.table.event')}</th>
                                    <th>{t('addons.polls.table.participants')}</th>
                                    <th>{t('addons.polls.table.created')}</th>
                                    <th>{t('addons.polls.table.status')}</th>
                                    <th>{t('addons.polls.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="loading-cell">{t('common.loading')}</td>
                                    </tr>
                                ) : polls.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="empty-cell">{t('addons.polls.noPolls')}</td>
                                    </tr>
                                ) : (
                                    polls.map((poll) => (
                                        <tr key={poll.id}>
                                            <td className="select-column">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(poll.id)}
                                                    onChange={() => toggleSelected(poll.id)}
                                                    aria-label={poll.title}
                                                />
                                            </td>
                                            <td>
                                                <div className="poll-name-cell">
                                                    <strong>{localizedText(i18n, poll.title, poll.title_ar)}</strong>
                                                    <span>{poll.option_count || 0} options</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="table-stack">
                                                    <strong>{localizedText(i18n, poll.client_name, poll.client_name_ar)}</strong>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="table-stack">
                                                    <strong>{localizedText(i18n, poll.event_name, poll.event_name_ar)}</strong>
                                                </div>
                                            </td>
                                            <td>{poll.participants_count || 0}</td>
                                            <td>{formatDate(i18n, poll.created_at)}</td>
                                            <td>
                                                <span className={`status-badge status-${poll.status}`}>
                                                    {t(`addons.polls.status.${poll.status}`) || poll.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <Link to={`/addons/polls/${poll.id}`} className="action-btn" title={t('common.view')}>
                                                        <Eye size={16} />
                                                    </Link>
                                                    <RoleGuard permission="events.edit">
                                                        <button
                                                            type="button"
                                                            className="action-btn"
                                                            title={poll.status === 'published' ? t('addons.polls.unpublish') : t('addons.polls.publish')}
                                                            onClick={() => handleToggleStatus(poll)}
                                                            disabled={actionBusy?.id === poll.id && actionBusy?.type === 'status'}
                                                        >
                                                            <Power size={16} />
                                                        </button>
                                                    </RoleGuard>
                                                    <RoleGuard permission="events.edit">
                                                        <Link to={`/addons/polls/${poll.id}`} className="action-btn" title={t('common.edit')}>
                                                            <Edit size={16} />
                                                        </Link>
                                                    </RoleGuard>
                                                    <RoleGuard permission="events.edit">
                                                        <button
                                                            type="button"
                                                            className="action-btn danger"
                                                            title={t('common.delete')}
                                                            onClick={() => handleDeletePoll(poll)}
                                                            disabled={actionBusy?.id === poll.id && actionBusy?.type === 'delete'}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </RoleGuard>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {pagination.totalPages > 1 && (
                        <div className="pagination">
                            <button
                                type="button"
                                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                                disabled={pagination.page <= 1}
                            >
                                {t('common.previous')}
                            </button>
                            <span>{t('common.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}</span>
                            <button
                                type="button"
                                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages || 1, prev.page + 1) }))}
                                disabled={pagination.page >= pagination.totalPages}
                            >
                                {t('common.next')}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="addon-tab-panel placeholder-panel">
                    <Layers3 size={42} />
                    <h3>{t('addons.polls.emptyTabTitle')}</h3>
                    <p>{t('addons.polls.emptyTabDescription')}</p>
                </div>
            )}
        </div>
    );
}
