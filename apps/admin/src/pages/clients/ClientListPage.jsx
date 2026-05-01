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
            <div className="page-header">
                <div>
                    <h1>{t('nav.clients')}</h1>
                    <p>{t('clients.listSubtitle', { count: pagination.total })}</p>
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

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('clients.name')}</th>
                            <th>{t('clients.contact')}</th>
                            <th>{t('clients.company')}</th>
                            <th>{t('clients.status')}</th>
                            <th>{t('clients.events')}</th>
                            <th>{t('clients.plan')}</th>
                            <th>{t('clients.created')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="loading-cell">{t('common.loading')}</td></tr>
                        ) : clients.length === 0 ? (
                            <tr><td colSpan="8" className="empty-cell">{t('clients.noClients')}</td></tr>
                        ) : (
                            clients.map(client => (
                                <tr key={client.id}>
                                    <td>
                                        <div className="client-name">
                                            <div className="client-logo">
                                                {client.logo_path ? (
                                                    <img src={resolveAssetUrl(client.logo_path)} alt={`${client.name} logo`} />
                                                ) : (
                                                    <span>{client.name.charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <strong>{client.name}</strong>
                                            {client.name_ar && <span className="name-ar">{client.name_ar}</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="contact-info">
                                            <span>{client.email}</span>
                                            {client.phone && <span className="phone">{client.phone}</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="company-info">
                                            <span className={`company-type company-type-${client.company_type || 'unknown'}`}>
                                                {t(`clients.type.${client.company_type || 'unknown'}`)}
                                            </span>
                                            <span className="company-sector">{client.company_sector || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-badge status-${client.status}`}>
                                            {t(`clients.status.${client.status}`)}
                                        </span>
                                    </td>
                                    <td>{client.event_count || 0}</td>
                                    <td>
                                        <span className={`plan-badge plan-${client.subscription_tier}`}>
                                            {t(`clients.plan.${client.subscription_tier}`)}
                                        </span>
                                    </td>
                                    <td>{formatDate(client.created_at)}</td>
                                    <td>
                                        <div className="row-actions">
                                            <Link to={`/clients/${client.id}`} className="action-btn" title={t('clients.view')}>
                                                <Eye size={16} />
                                            </Link>
                                            <RoleGuard permission="clients.edit">
                                                <Link to={`/clients/${client.id}/edit`} className="action-btn" title={t('clients.edit')}>
                                                    <Edit size={16} />
                                                </Link>
                                            </RoleGuard>
                                            <RoleGuard permission="clients.edit">
                                                <button
                                                    type="button"
                                                    className={`action-btn warn ${client.status === 'suspended' ? 'active-state' : ''}`}
                                                    title={client.status === 'suspended' ? t('clients.actions.unban') : t('clients.actions.ban')}
                                                    onClick={() => handleToggleBan(client)}
                                                    disabled={actionBusy?.id === client.id && actionBusy?.type === 'status'}
                                                >
                                                    <Ban size={16} />
                                                </button>
                                            </RoleGuard>
                                            <RoleGuard permission="clients.delete">
                                                <button
                                                    type="button"
                                                    className="action-btn danger"
                                                    title={t('clients.actions.delete')}
                                                    onClick={() => handleDeleteClient(client)}
                                                    disabled={actionBusy?.id === client.id && actionBusy?.type === 'delete'}
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
