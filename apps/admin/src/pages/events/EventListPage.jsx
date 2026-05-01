import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Eye, Edit, Calendar, Power, Trash2 } from 'lucide-react';
import api from '../../services/api';
import RoleGuard from '../../components/auth/RoleGuard';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './EventListPage.css';

export default function EventListPage() {
    const { t, i18n } = useTranslation();
    const [searchParams] = useSearchParams();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
    const [actionBusy, setActionBusy] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        eventType: 'all',
        clientId: searchParams.get('clientId') || ''
    });

    useEffect(() => {
        fetchEvents();
    }, [pagination.page, filters]);

    async function fetchEvents() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                pageSize: pagination.pageSize,
                ...(filters.search && { search: filters.search }),
                ...(filters.status !== 'all' && { status: filters.status }),
                ...(filters.eventType !== 'all' && { eventType: filters.eventType }),
                ...(filters.clientId && { clientId: filters.clientId })
            });
            const response = await api.get(`/admin/events?${params}`);
            setEvents(response.data.data);
            setPagination(prev => ({ ...prev, ...response.data.pagination }));
        } catch (error) {
            console.error('Failed to fetch events:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(e) {
        setFilters(prev => ({ ...prev, search: e.target.value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }

    function handleFilterChange(key, value) {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }

    async function executeToggleStatus(event) {
        const nextStatus = event.status === 'active' ? 'draft' : 'active';
        setActionBusy({ type: 'status', id: event.id });
        try {
            await api.patch(`/admin/events/${event.id}/status`, { status: nextStatus });
            await fetchEvents();
        } catch (error) {
            console.error('Failed to update event status:', error);
        } finally {
            setActionBusy(null);
        }
    }

    function handleToggleStatus(event) {
        const nextStatus = event.status === 'active' ? 'draft' : 'active';
        const confirmMessage = event.status === 'active'
            ? t('events.actions.deactivateConfirm')
            : t('events.actions.activateConfirm');

        setConfirmDialog({
            title: t('common.confirmAction'),
            description: confirmMessage,
            confirmLabel: nextStatus === 'active' ? t('events.actions.activate') : t('events.actions.deactivate'),
            variant: 'warning',
            onConfirm: () => executeToggleStatus(event)
        });
    }

    async function executeDeleteEvent(event) {
        setActionBusy({ type: 'delete', id: event.id });
        try {
            await api.delete(`/admin/events/${event.id}`);
            await fetchEvents();
        } catch (error) {
            console.error('Failed to delete event:', error);
        } finally {
            setActionBusy(null);
        }
    }

    function handleDeleteEvent(event) {
        setConfirmDialog({
            title: t('common.confirmAction'),
            description: t('events.actions.deleteConfirm'),
            confirmLabel: t('common.delete'),
            variant: 'danger',
            onConfirm: () => executeDeleteEvent(event)
        });
    }

    function formatDate(dateString) {
        const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US';
        return new Date(dateString).toLocaleDateString(locale, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    return (
        <div className="event-list-page">
            <div className="page-header">
                <div>
                    <h1>{t('nav.events')}</h1>
                    <p>{t('events.listSubtitle', { count: pagination.total })}</p>
                </div>
                <RoleGuard permission="events.create">
                    <Link to="/events/new" className="btn btn-primary">
                        <Plus size={18} />
                        <span>{t('events.createEvent')}</span>
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

            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder={t('events.searchPlaceholder')}
                        value={filters.search}
                        onChange={handleSearch}
                    />
                </div>

                <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                    <option value="all">{t('common.allStatuses')}</option>
                    <option value="draft">{t('events.status.draft')}</option>
                    <option value="active">{t('events.status.active')}</option>
                    <option value="completed">{t('events.status.completed')}</option>
                    <option value="cancelled">{t('events.status.cancelled')}</option>
                </select>

                <select
                    value={filters.eventType}
                    onChange={(e) => handleFilterChange('eventType', e.target.value)}
                >
                    <option value="all">{t('common.allTypes')}</option>
                    <option value="wedding">{t('events.type.wedding')}</option>
                    <option value="corporate">{t('events.type.corporate')}</option>
                    <option value="social">{t('events.type.social')}</option>
                </select>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('events.event')}</th>
                            <th>{t('events.client')}</th>
                            <th>{t('events.type.label')}</th>
                            <th>{t('events.date')}</th>
                            <th>{t('events.status.label')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="loading-cell">{t('common.loading')}</td></tr>
                        ) : events.length === 0 ? (
                            <tr><td colSpan="6" className="empty-cell">{t('events.noEvents')}</td></tr>
                        ) : (
                            events.map(event => (
                                <tr key={event.id}>
                                    <td>
                                        <div className="event-name">
                                            <Calendar size={16} />
                                        <div>
                                            <strong>{event.name}</strong>
                                            {event.name_ar && <span className="name-ar">{event.name_ar}</span>}
                                        </div>
                                    </div>
                                    </td>
                                    <td>{event.client_name}</td>
                                    <td>
                                        <span className={`type-badge type-${event.event_type}`}>
                                            {t(`events.type.${event.event_type}`)}
                                        </span>
                                    </td>
                                    <td>{formatDate(event.start_datetime)}</td>
                                    <td>
                                        <span className={`status-badge status-${event.status}`}>
                                            {t(`events.status.${event.status}`)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            <Link to={`/events/${event.id}`} className="action-btn" title={t('common.view')}>
                                                <Eye size={16} />
                                            </Link>
                                            <RoleGuard permission="events.edit">
                                                <Link to={`/events/${event.id}/edit`} className="action-btn" title={t('common.edit')}>
                                                    <Edit size={16} />
                                                </Link>
                                            </RoleGuard>
                                            <RoleGuard permission="events.edit">
                                                <button
                                                    type="button"
                                                    className={`action-btn warn ${event.status === 'active' ? 'active-state' : ''}`}
                                                    title={event.status === 'active' ? t('events.actions.deactivate') : t('events.actions.activate')}
                                                    onClick={() => handleToggleStatus(event)}
                                                    disabled={actionBusy?.id === event.id && actionBusy?.type === 'status'}
                                                >
                                                    <Power size={16} />
                                                </button>
                                            </RoleGuard>
                                            <RoleGuard permission="events.delete">
                                                <button
                                                    type="button"
                                                    className="action-btn danger"
                                                    title={t('events.actions.delete')}
                                                    onClick={() => handleDeleteEvent(event)}
                                                    disabled={actionBusy?.id === event.id && actionBusy?.type === 'delete'}
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
                        disabled={pagination.page === 1}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    >
                        {t('common.previous')}
                    </button>
                    <span>{t('common.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}</span>
                    <button
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    >
                        {t('common.next')}
                    </button>
                </div>
            )}
        </div>
    );
}
