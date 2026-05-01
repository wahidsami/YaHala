import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Edit, Power, Trash2, MessageSquare, Users, CheckCircle2, BadgePercent } from 'lucide-react';
import api from '../../../services/api';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import RoleGuard from '../../../components/auth/RoleGuard';
import './EventPollsTab.css';

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

function StatCard({ title, value, icon: Icon, tone = 'default' }) {
    return (
        <div className={`event-poll-stat tone-${tone}`}>
            <div className="event-poll-stat-icon">
                <Icon size={20} />
            </div>
            <div className="event-poll-stat-copy">
                <span className="event-poll-stat-value">{value}</span>
                <span className="event-poll-stat-title">{title}</span>
            </div>
        </div>
    );
}

export default function EventPollsTab({ event, clientName, clientNameAr }) {
    const { t, i18n } = useTranslation();
    const [polls, setPolls] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
    const [actionBusy, setActionBusy] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);

    useEffect(() => {
        fetchPolls();
        fetchStats();
    }, [event?.id, pagination.page]);

    async function fetchPolls() {
        if (!event?.id) {
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams({
                eventId: event.id,
                page: pagination.page,
                pageSize: pagination.pageSize
            });

            const response = await api.get(`/admin/polls?${params}`);
            setPolls(response.data.data || []);
            setPagination(prev => ({ ...prev, ...response.data.pagination }));
        } catch (error) {
            console.error('Failed to fetch event polls:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchStats() {
        if (!event?.id) {
            return;
        }

        try {
            const params = new URLSearchParams({ eventId: event.id });
            const response = await api.get(`/admin/polls/stats?${params}`);
            setStats(response.data.data || null);
        } catch (error) {
            console.error('Failed to fetch event poll stats:', error);
        }
    }

    async function executeToggleStatus(poll, nextStatus) {
        setActionBusy({ type: 'status', id: poll.id });
        try {
            await api.patch(`/admin/polls/${poll.id}/status`, { status: nextStatus });
            await fetchPolls();
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

    const pollStats = useMemo(() => ({
        totalPolls: stats?.total_polls ?? polls.length,
        published: stats?.published_polls ?? polls.filter((poll) => poll.status === 'published').length,
        participants: stats?.total_participants ?? polls.reduce((sum, poll) => sum + Number(poll.participants_count || 0), 0),
        anonymous: stats?.anonymous_polls ?? polls.filter((poll) => poll.poll_mode === 'anonymous').length
    }), [stats, polls]);

    return (
        <div className="event-polls-tab">
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

            <div className="event-polls-stats">
                <StatCard title={t('addons.polls.total')} value={pollStats.totalPolls} icon={MessageSquare} tone="primary" />
                <StatCard title={t('addons.polls.published')} value={pollStats.published} icon={CheckCircle2} tone="success" />
                <StatCard title={t('addons.polls.participants')} value={pollStats.participants} icon={Users} tone="accent" />
                <StatCard title={t('addons.polls.stats.anonymous')} value={pollStats.anonymous} icon={BadgePercent} tone="warning" />
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('addons.polls.table.poll')}</th>
                            <th>{t('addons.polls.table.participants')}</th>
                            <th>{t('addons.polls.table.created')}</th>
                            <th>{t('addons.polls.table.status')}</th>
                            <th>{t('addons.polls.table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="loading-cell">{t('common.loading')}</td>
                            </tr>
                        ) : polls.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="empty-cell">{t('addons.polls.noPolls')}</td>
                            </tr>
                        ) : (
                            polls.map((poll) => (
                                <tr key={poll.id}>
                                    <td>
                                        <div className="poll-name-cell">
                                            <strong>{localizedText(i18n, poll.title, poll.title_ar)}</strong>
                                            <span>{localizedText(i18n, clientName, clientNameAr)}</span>
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
                                                <Link to={`/addons/polls/${poll.id}`} className="action-btn" title={t('common.edit')}>
                                                    <Edit size={16} />
                                                </Link>
                                            </RoleGuard>
                                            <RoleGuard permission="events.edit">
                                                <button
                                                    type="button"
                                                    className="action-btn warn"
                                                    title={poll.status === 'published' ? t('addons.polls.unpublish') : t('addons.polls.publish')}
                                                    onClick={() => handleToggleStatus(poll)}
                                                    disabled={actionBusy?.id === poll.id && actionBusy?.type === 'status'}
                                                >
                                                    <Power size={16} />
                                                </button>
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
    );
}
