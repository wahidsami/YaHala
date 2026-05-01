import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Edit, ArrowLeft, Calendar, Users, Scan, Globe, Mail, Phone, MapPin, UserCircle2, Building2, Search, Eye } from 'lucide-react';
import api from '../../services/api';
import RoleGuard from '../../components/auth/RoleGuard';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ClientGuestsTab from './components/ClientGuestsTab';
import './ClientProfilePage.css';

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

function formatAddress(client, notAvailableLabel) {
    const parts = [
        client.address_building_number,
        client.address_street,
        client.address_district,
        client.address_city,
        client.address_region,
        client.address_postal_code,
        client.address_additional_number,
        client.address_unit_number
    ].filter(Boolean);

    return parts.length ? parts.join(', ') : notAvailableLabel;
}

function formatCompanyType(value, t, notAvailableLabel) {
    if (value === 'gov') return t('clients.type.gov');
    if (value === 'private') return t('clients.type.private');
    return value || notAvailableLabel;
}

function formatDate(dateString, locale = 'en-US') {
    return new Date(dateString).toLocaleDateString(locale);
}

export default function ClientProfilePage() {
    const { t, i18n } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = useState(null);
    const [stats, setStats] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventPagination, setEventPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
    const [eventFilters, setEventFilters] = useState({ search: '', status: 'all' });
    const [confirmDialog, setConfirmDialog] = useState(null);
    const locale = useMemo(() => (i18n.language === 'ar' ? 'ar-EG' : 'en-US'), [i18n.language]);
    const notAvailable = t('common.notAvailable');

    useEffect(() => {
        fetchClient();
        fetchStats();
    }, [id]);

    useEffect(() => {
        if (activeTab === 'events') {
            fetchEvents();
        }
    }, [activeTab, id, eventPagination.page, eventFilters]);

    async function fetchClient() {
        try {
            const response = await api.get(`/admin/clients/${id}`);
            setClient(response.data.data);
        } catch (error) {
            console.error('Failed to fetch client:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchStats() {
        try {
            const response = await api.get(`/admin/clients/${id}/stats`);
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    async function fetchEvents() {
        setEventsLoading(true);
        try {
            const params = new URLSearchParams({
                clientId: id,
                page: eventPagination.page,
                pageSize: eventPagination.pageSize,
                sortBy: 'start_datetime',
                sortOrder: 'desc',
                ...(eventFilters.search && { search: eventFilters.search }),
                ...(eventFilters.status !== 'all' && { status: eventFilters.status })
            });

            const response = await api.get(`/admin/events?${params}`);
            setEvents(response.data.data);
            setEventPagination(prev => ({ ...prev, ...response.data.pagination }));
        } catch (error) {
            console.error('Failed to fetch client events:', error);
        } finally {
            setEventsLoading(false);
        }
    }

    function handleEventFilterChange(key, value) {
        setEventFilters(prev => ({ ...prev, [key]: value }));
        setEventPagination(prev => ({ ...prev, page: 1 }));
    }

    async function executeDeactivate() {
        try {
            await api.delete(`/admin/clients/${id}`);
            navigate('/clients');
        } catch (error) {
            console.error('Failed to deactivate client:', error);
        }
    }

    function handleDeactivate() {
        setConfirmDialog({
            title: t('common.confirmAction'),
            description: t('clients.actions.deactivateConfirm'),
            confirmLabel: t('common.deactivate'),
            variant: 'danger',
            onConfirm: executeDeactivate
        });
    }

    if (loading) return <div className="loading">{t('common.loading')}</div>;
    if (!client) return <div className="error">{t('common.notFound')}</div>;

    return (
        <div className="client-profile-page">
            <div className="profile-header">
                <Link to="/clients" className="back-link">
                    <ArrowLeft size={18} />
                    <span>{t('clients.form.backToClients')}</span>
                </Link>

                <div className="header-content">
                    <div className="header-info">
                        <div className="client-identity">
                            <div className="client-logo">
                                {client.logo_path ? (
                                    <img src={resolveAssetUrl(client.logo_path)} alt={`${client.name} logo`} />
                                ) : (
                                    <div className="client-logo-placeholder">
                                        <Building2 size={28} />
                                    </div>
                                )}
                            </div>

                            <div>
                                <h1>{client.name}</h1>
                                {client.name_ar && <p className="name-ar">{client.name_ar}</p>}
                                <span className={`status-badge status-${client.status}`}>{client.status}</span>
                            </div>
                        </div>
                    </div>

                    <div className="header-actions">
                        <RoleGuard permission="clients.edit">
                            <Link to={`/clients/${id}/edit`} className="btn btn-secondary">
                                <Edit size={18} />
                                <span>{t('common.edit')}</span>
                            </Link>
                        </RoleGuard>
                        <RoleGuard permission="clients.delete">
                            <button className="btn btn-danger" onClick={handleDeactivate}>
                                {t('common.deactivate')}
                            </button>
                        </RoleGuard>
                    </div>
                </div>
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

            <div className="profile-tabs">
                <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                    {t('clients.tabs.overview')}
                </button>
                <button className={activeTab === 'guests' ? 'active' : ''} onClick={() => setActiveTab('guests')}>
                    {t('clients.tabs.guests')}
                </button>
                <button className={activeTab === 'events' ? 'active' : ''} onClick={() => setActiveTab('events')}>
                    {t('clients.tabs.events')}
                </button>
                <button className={activeTab === 'scanners' ? 'active' : ''} onClick={() => setActiveTab('scanners')}>
                    {t('clients.tabs.scanners')}
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'overview' && (
                    <div className="overview-tab">
                        <div className="info-grid">
                            <div className="info-card">
                                <h3>{t('clients.profile.clientInfo')}</h3>
                                <div className="info-row">
                                    <span><Mail size={16} /> {t('auth.email')}</span>
                                    <strong>{client.email}</strong>
                                </div>
                                <div className="info-row">
                                    <span><Phone size={16} /> {t('clients.form.phone')}</span>
                                    <strong>{client.phone || notAvailable}</strong>
                                </div>
                                <div className="info-row">
                                    <span><Globe size={16} /> {t('clients.form.websiteUrl')}</span>
                                    <strong>
                                        {client.website_url ? (
                                            <a href={client.website_url} target="_blank" rel="noreferrer">
                                                {client.website_url}
                                            </a>
                                        ) : (
                                            notAvailable
                                        )}
                                    </strong>
                                </div>
                                <div className="info-row">
                                    <span><UserCircle2 size={16} /> {t('clients.form.contactPerson')}</span>
                                    <strong>{client.contact_person || notAvailable}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('clients.form.created')}</span>
                                    <strong>{new Date(client.created_at).toLocaleDateString(locale)}</strong>
                                </div>
                            </div>

                            <div className="info-card">
                                <h3>{t('clients.profile.companyProfile')}</h3>
                                <div className="info-row">
                                    <span>{t('clients.form.companyType')}</span>
                                    <strong>{formatCompanyType(client.company_type, t, notAvailable)}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('clients.form.companySector')}</span>
                                    <strong>{client.company_sector || notAvailable}</strong>
                                </div>
                                <div className="info-row">
                                    <span><MapPin size={16} /> {t('clients.form.address')}</span>
                                    <strong>{formatAddress(client, notAvailable)}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('clients.form.buildingNumber')}</span>
                                    <strong>{client.address_building_number || notAvailable}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('clients.form.unitNumber')}</span>
                                    <strong>{client.address_unit_number || notAvailable}</strong>
                                </div>
                            </div>

                            <div className="info-card">
                                <h3>{t('clients.profile.subscription')}</h3>
                                <div className="info-row">
                                    <span>{t('clients.form.plan')}</span>
                                    <strong className={`plan-badge plan-${client.subscription_tier}`}>
                                        {t(`clients.plan.${client.subscription_tier}`, client.subscription_tier)}
                                    </strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('clients.form.eventLimit')}</span>
                                    <strong>{stats?.events?.used || 0} / {client.event_limit}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('clients.form.guestLimit')}</span>
                                    <strong>{stats?.guests?.used || 0} / {client.guest_limit}</strong>
                                </div>
                            </div>
                        </div>

                        {stats && (
                            <div className="usage-section">
                                <h3>{t('clients.profile.usage')}</h3>
                                <div className="usage-grid">
                                    <div className="usage-card">
                                        <Calendar size={24} />
                                        <div>
                                            <span className="usage-value">{stats.events?.used || 0}</span>
                                            <span className="usage-label">{t('clients.events')}</span>
                                        </div>
                                    </div>
                                    <div className="usage-card">
                                        <Users size={24} />
                                        <div>
                                            <span className="usage-value">{stats.activeEvents || 0}</span>
                                            <span className="usage-label">{t('clients.profile.activeEvents')}</span>
                                        </div>
                                    </div>
                                    <div className="usage-card">
                                        <Scan size={24} />
                                        <div>
                                            <span className="usage-value">{stats.scannerUsers || 0}</span>
                                            <span className="usage-label">{t('clients.tabs.scanners')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'guests' && (
                    <ClientGuestsTab clientId={id} />
                )}

                {activeTab === 'events' && (
                    <div className="events-tab">
                        <div className="tab-header">
                            <h3>{t('clients.profile.clientEvents')}</h3>
                            <RoleGuard permission="events.create">
                                <Link to={`/events/new?clientId=${id}`} className="btn btn-primary">
                                    {t('events.createEvent')}
                                </Link>
                            </RoleGuard>
                        </div>

                        <div className="events-toolbar">
                            <div className="events-search">
                                <Search size={16} />
                                <input
                                    type="text"
                                    placeholder={t('events.searchPlaceholder')}
                                    value={eventFilters.search}
                                    onChange={(e) => handleEventFilterChange('search', e.target.value)}
                                />
                            </div>

                            <select
                                value={eventFilters.status}
                                onChange={(e) => handleEventFilterChange('status', e.target.value)}
                            >
                                <option value="all">{t('common.allStatuses')}</option>
                                <option value="draft">{t('events.status.draft')}</option>
                                <option value="active">{t('events.status.active')}</option>
                                <option value="completed">{t('events.status.completed')}</option>
                                <option value="cancelled">{t('events.status.cancelled')}</option>
                            </select>
                        </div>

                        <div className="events-table-wrap">
                            <table className="events-table">
                                <thead>
                                    <tr>
                                        <th>{t('events.event')}</th>
                                        <th>{t('events.date')}</th>
                                        <th>{t('clients.profile.guestsCount')}</th>
                                        <th>{t('clients.profile.attended')}</th>
                                        <th>{t('clients.profile.noShow')}</th>
                                        <th>{t('events.status.label')}</th>
                                        <th>{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {eventsLoading ? (
                                        <tr>
                                            <td colSpan="7" className="loading-cell">{t('common.loading')}</td>
                                        </tr>
                                    ) : events.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="empty-cell">{t('events.noEvents')}</td>
                                        </tr>
                                    ) : (
                                        events.map((event) => (
                                            <tr key={event.id}>
                                                <td>
                                                    <div className="event-name-cell">
                                                        <strong>{event.name}</strong>
                                                        {event.name_ar && <span>{event.name_ar}</span>}
                                                    </div>
                                                </td>
                                                <td>{formatDate(event.start_datetime, locale)}</td>
                                                <td>{Number(event.total_guests || 0)}</td>
                                                <td>{Number(event.checked_in_guests || 0)}</td>
                                                <td>{Number(event.not_checked_in_guests || 0)}</td>
                                                <td>
                                                    <span className={`status-badge status-${event.status}`}>{t(`events.status.${event.status}`)}</span>
                                                </td>
                                                <td>
                                                    <div className="row-actions">
                                                        <Link to={`/events/${event.id}`} className="action-btn" title={t('common.view')}>
                                                            <Eye size={16} />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {eventPagination.totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    disabled={eventPagination.page === 1}
                                    onClick={() => setEventPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                >
                                    {t('common.previous')}
                                </button>
                                <span>{t('common.pageOf', { page: eventPagination.page, totalPages: eventPagination.totalPages })}</span>
                                <button
                                    disabled={eventPagination.page >= eventPagination.totalPages}
                                    onClick={() => setEventPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                >
                                    {t('common.next')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'scanners' && (
                    <div className="scanners-tab">
                        <div className="tab-header">
                            <h3>{t('clients.tabs.scanners')}</h3>
                            <RoleGuard permission="scanner_users.create">
                                <button className="btn btn-primary">{t('clients.profile.addScannerUser')}</button>
                            </RoleGuard>
                        </div>
                        <p className="placeholder-text">{t('clients.profile.scannersPlaceholder')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
