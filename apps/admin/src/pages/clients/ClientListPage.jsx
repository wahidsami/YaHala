import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit, Eye, Trash2, Ban } from 'lucide-react';
import api from '../../services/api';
import RoleGuard from '../../components/auth/RoleGuard';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './ClientListPage.css';

function resolveAssetUrl(assetPath) {
    if (!assetPath) {
        return '';
    }

    if (/^https?:\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
        return assetPath;
    }

    const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const origin = baseUrl.replace(/\/api\/?$/, '');
    return `${origin}${assetPath.startsWith('/') ? '' : '/'}${assetPath}`;
}

export default function ClientListPage() {
    const { t, i18n } = useTranslation();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
    const [filters, setFilters] = useState({ search: '', status: 'all', subscription: 'all' });
    const [actionBusy, setActionBusy] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);

    useEffect(() => {
        fetchClients();
    }, [pagination.page, filters]);

    async function fetchClients() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                pageSize: pagination.pageSize,
                ...(filters.search && { search: filters.search }),
                ...(filters.status !== 'all' && { status: filters.status }),
                ...(filters.subscription !== 'all' && { subscription: filters.subscription })
            });
            const response = await api.get(`/admin/clients?${params}`);
            setClients(response.data.data);
            setPagination(prev => ({ ...prev, ...response.data.pagination }));
        } catch (error) {
            console.error('Failed to fetch clients:', error);
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

    async function executeToggleBan(client) {
        setActionBusy({ type: 'status', id: client.id });
        try {
            const nextStatus = client.status === 'suspended' ? 'active' : 'suspended';
            await api.patch(`/admin/clients/${client.id}/status`, { status: nextStatus });
            await fetchClients();
        } catch (error) {
            console.error('Failed to update client status:', error);
        } finally {
            setActionBusy(null);
        }
    }

    function handleToggleBan(client) {
        const nextStatus = client.status === 'suspended' ? 'active' : 'suspended';
        const confirmMessage = client.status === 'suspended'
            ? t('clients.actions.unbanConfirm')
            : t('clients.actions.banConfirm');

        setConfirmDialog({
            title: t('common.confirmAction'),
            description: confirmMessage,
            confirmLabel: nextStatus === 'suspended' ? t('clients.actions.ban') : t('clients.actions.unban'),
            variant: 'warning',
            onConfirm: () => executeToggleBan(client)
        });
    }

    async function executeDeleteClient(client) {
        setActionBusy({ type: 'delete', id: client.id });
        try {
            await api.delete(`/admin/clients/${client.id}`);
            await fetchClients();
        } catch (error) {
            console.error('Failed to delete client:', error);
        } finally {
            setActionBusy(null);
        }
    }

    function handleDeleteClient(client) {
        setConfirmDialog({
            title: t('common.confirmAction'),
            description: t('clients.actions.deleteConfirm'),
            confirmLabel: t('common.delete'),
            variant: 'danger',
            onConfirm: () => executeDeleteClient(client)
        });
    }

    function formatDate(dateString) {
        const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US';
        return new Date(dateString).toLocaleDateString(locale);
    }

    return (
        <div className="client-list-page">
            <div className="page-header hub-display-title">
                <div className="hub-display-title__copy">
                    <span className="hub-display-title__eyebrow">{t('nav.clients')}</span>
                    <h1>{t('clients.listSubtitle', { count: pagination.total })}</h1>
                </div>
                <div className="hub-display-title__actions">
                    <RoleGuard permission="clients.create">
                        <Link to="/clients/new" className="btn btn-primary">
                            <Plus size={16} />
                            <span>{t('clients.createClient')}</span>
                        </Link>
                    </RoleGuard>
                </div>
            </div>
                <RoleGuard permission="clients.create">
                    <Link to="/clients/new" className="btn btn-primary">
                        <Plus size={18} />
                        <span>{t('clients.createClient')}</span>
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
                        placeholder={t('clients.searchPlaceholder')}
                        value={filters.search}
                        onChange={handleSearch}
                    />
                </div>

                <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                    <option value="all">{t('clients.allStatuses')}</option>
                    <option value="active">{t('clients.status.active')}</option>
                    <option value="inactive">{t('clients.status.inactive')}</option>
                    <option value="suspended">{t('clients.status.suspended')}</option>
                </select>

                <select
                    value={filters.subscription}
                    onChange={(e) => handleFilterChange('subscription', e.target.value)}
                >
                    <option value="all">{t('clients.allPlans')}</option>
                    <option value="basic">{t('clients.plan.basic')}</option>
                    <option value="pro">{t('clients.plan.pro')}</option>
                    <option value="enterprise">{t('clients.plan.enterprise')}</option>
                </select>
            </div>

            <div className="client-card-grid">
                {loading ? (
                    <div className="loading-state">{t('common.loading')}</div>
                ) : clients.length === 0 ? (
                    <div className="empty-state">{t('clients.noClients')}</div>
                ) : (
                    clients.map(client => (
                        <div key={client.id} className="client-card">
                            <div className="client-card__header">
                                <div className="client-card__logo">
                                    {client.logo_path ? (
                                        <img src={resolveAssetUrl(client.logo_path)} alt={`${client.name} logo`} />
                                    ) : (
                                        <span>{client.name.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <div className="client-card__actions">
                                    <Link to={`/clients/${client.id}`} className="action-btn" title={t('clients.view')}>
                                        <Eye size={16} />
                                    </Link>
                                </div>
                            </div>
                            <div className="client-card__body">
                                <h3>{client.name}</h3>
                                {client.name_ar && <span className="client-name-ar">{client.name_ar}</span>}
                                
                                <div className="client-card__meta">
                                    <span className={`status-badge status-${client.status}`}>
                                        {t(`clients.status.${client.status}`)}
                                    </span>
                                    <span className={`plan-badge plan-${client.subscription_tier}`}>
                                        {t(`clients.plan.${client.subscription_tier}`)}
                                    </span>
                                </div>
                            </div>
                            <div className="client-card__footer">
                                <div className="client-card__stat">
                                    <strong>{client.event_count || 0}</strong>
                                    <span>{t('clients.events')}</span>
                                </div>
                                <div className="client-card__stat">
                                    <strong>{formatDate(client.created_at)}</strong>
                                    <span>{t('clients.created')}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

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


