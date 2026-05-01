import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Building2,
    ChevronLeft,
    ChevronRight,
    Eye,
    Filter,
    Mail,
    MapPin,
    Phone,
    Search,
    Users,
    UserRound,
    X
} from 'lucide-react';
import api from '../../services/api';
import '../clients/ClientListPage.css';
import './GuestsPage.css';

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

function formatDate(value, language) {
    if (!value) {
        return '';
    }

    const locale = language?.startsWith('ar') ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value));
}

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
}

function GuestSummaryCard({ title, value, subtitle, icon: Icon, tone = 'neutral' }) {
    return (
        <div className={`guest-summary-card guest-summary-card--${tone}`}>
            <div className="guest-summary-card__icon">
                <Icon size={18} />
            </div>
            <div className="guest-summary-card__content">
                <span>{title}</span>
                <strong>{value}</strong>
                {subtitle && <small>{subtitle}</small>}
            </div>
        </div>
    );
}

function GuestDrawer({ guest, language, onClose }) {
    const { t } = useTranslation();

    if (!guest) {
        return null;
    }

    const imageUrl = resolveAssetUrl(guest.avatar_path);
    const clientLabel = language?.startsWith('ar')
        ? (guest.client_name_ar || guest.client_name || '')
        : (guest.client_name || guest.client_name_ar || '');

    return (
        <div className="guest-drawer-backdrop" role="presentation" onClick={onClose}>
            <aside className="guest-drawer" role="dialog" aria-modal="true" aria-label={guest.name} onClick={(event) => event.stopPropagation()}>
                <div className="guest-drawer__header">
                    <div>
                        <span className="drawer-eyebrow">{t('guests.detailsTitle')}</span>
                        <h2>{guest.name}</h2>
                    </div>
                    <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}>
                        <X size={18} />
                    </button>
                </div>

                <div className="guest-drawer__profile">
                    <div className="guest-drawer__avatar">
                        {imageUrl ? (
                            <img src={imageUrl} alt={guest.name} />
                        ) : (
                            <span>{(guest.name || '?').slice(0, 1).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="guest-drawer__meta">
                        <strong>{clientLabel || t('common.notAvailable')}</strong>
                        <span>{guest.organization || t('common.notAvailable')}</span>
                        <span>{guest.position || t('common.notAvailable')}</span>
                    </div>
                </div>

                <div className="guest-drawer__stats">
                    <div>
                        <span>{t('guests.invitationCount')}</span>
                        <strong>{formatNumber(guest.invitation_count)}</strong>
                    </div>
                    <div>
                        <span>{t('guests.respondedCount')}</span>
                        <strong>{formatNumber(guest.responded_count)}</strong>
                    </div>
                </div>

                <div className="guest-drawer__info">
                    <div className="info-row">
                        <Mail size={16} />
                        <span>{guest.email || t('common.notAvailable')}</span>
                    </div>
                    <div className="info-row">
                        <Phone size={16} />
                        <span>{guest.mobile_number || t('common.notAvailable')}</span>
                    </div>
                    <div className="info-row">
                        <MapPin size={16} />
                        <span>{guest.organization || t('common.notAvailable')}</span>
                    </div>
                    <div className="info-row">
                        <Users size={16} />
                        <span>{guest.gender || t('common.notAvailable')}</span>
                    </div>
                    <div className="info-row">
                        <Building2 size={16} />
                        <span>{guest.client_name || guest.client_name_ar || t('common.notAvailable')}</span>
                    </div>
                </div>

                <div className="guest-drawer__footer">
                    <div>
                        <span>{t('guests.lastInvitedAt')}</span>
                        <strong>{formatDate(guest.last_invited_at, language) || t('common.notAvailable')}</strong>
                    </div>
                    <Link to={`/clients/${guest.client_id}`} className="btn btn-primary">
                        {t('guests.openClient')}
                    </Link>
                </div>
            </aside>
        </div>
    );
}

export default function GuestsPage() {
    const { t, i18n } = useTranslation();
    const [guests, setGuests] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingClients, setLoadingClients] = useState(true);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
    const [summary, setSummary] = useState({ total: 0, active: 0, banned: 0, invited: 0, responded: 0 });
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        gender: 'all',
        clientId: 'all'
    });
    const [selectedGuest, setSelectedGuest] = useState(null);

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        fetchGuests();
    }, [filters, pagination.page, pagination.pageSize]);

    async function fetchClients() {
        setLoadingClients(true);
        try {
            const params = new URLSearchParams({
                page: 1,
                pageSize: 500,
                sortBy: 'name',
                sortOrder: 'asc'
            });
            const response = await api.get(`/admin/clients?${params}`);
            setClients(response.data.data || []);
        } catch (fetchError) {
            console.error('Failed to fetch clients for guest filter:', fetchError);
        } finally {
            setLoadingClients(false);
        }
    }

    async function fetchGuests() {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                pageSize: pagination.pageSize,
                sortBy: 'created_at',
                sortOrder: 'desc',
                ...(filters.search && { search: filters.search }),
                ...(filters.status !== 'all' && { status: filters.status }),
                ...(filters.gender !== 'all' && { gender: filters.gender }),
                ...(filters.clientId !== 'all' && { clientId: filters.clientId })
            });
            const response = await api.get(`/admin/guests?${params}`);
            setGuests(response.data.data || []);
            setPagination((prev) => ({ ...prev, ...response.data.pagination }));
            setSummary(response.data.summary || {});
        } catch (fetchError) {
            console.error('Failed to fetch guests:', fetchError);
            setError(fetchError.response?.data?.message || t('guests.loadFailed'));
        } finally {
            setLoading(false);
        }
    }

    function handleFilterChange(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPagination((prev) => ({ ...prev, page: 1 }));
    }

    function handleSearch(event) {
        handleFilterChange('search', event.target.value);
    }

    const clientOptions = useMemo(() => clients.map((client) => ({
        id: client.id,
        label: i18n.language?.startsWith('ar') ? (client.name_ar || client.name) : (client.name || client.name_ar)
    })), [clients, i18n.language]);

    return (
        <div className="guests-page">
            <div className="page-header">
                <div>
                    <h1>{t('nav.guests')}</h1>
                    <p>{t('guests.subtitle')}</p>
                </div>
                <div className="guests-header-actions">
                    <button className="btn btn-primary" onClick={fetchGuests} disabled={loading}>
                        {t('common.refresh')}
                    </button>
                </div>
            </div>

            <div className="guest-summary-grid">
                <GuestSummaryCard title={t('guests.summaryTotal')} value={formatNumber(summary.total)} subtitle={t('guests.summaryTotalHint')} icon={Users} tone="primary" />
                <GuestSummaryCard title={t('guests.summaryActive')} value={formatNumber(summary.active)} subtitle={t('guests.summaryActiveHint')} icon={UserRound} tone="success" />
                <GuestSummaryCard title={t('guests.summaryInvited')} value={formatNumber(summary.invited)} subtitle={t('guests.summaryInvitedHint')} icon={Mail} tone="accent" />
                <GuestSummaryCard title={t('guests.summaryResponded')} value={formatNumber(summary.responded)} subtitle={t('guests.summaryRespondedHint')} icon={Eye} tone="dark" />
            </div>

            <div className="filters-bar guests-filters-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder={t('clients.guests.searchPlaceholder')}
                        value={filters.search}
                        onChange={handleSearch}
                    />
                </div>

                <div className="filter-pill">
                    <Filter size={16} />
                    <select value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
                        <option value="all">{t('clients.guests.allStatuses')}</option>
                        <option value="active">{t('clients.guests.statusActive')}</option>
                        <option value="banned">{t('clients.guests.statusBanned')}</option>
                    </select>
                </div>

                <div className="filter-pill">
                    <select value={filters.gender} onChange={(event) => handleFilterChange('gender', event.target.value)}>
                        <option value="all">{t('clients.guests.allGenders')}</option>
                        <option value="male">{t('clients.guests.genderMale')}</option>
                        <option value="female">{t('clients.guests.genderFemale')}</option>
                        <option value="other">{t('clients.guests.genderOther')}</option>
                    </select>
                </div>

                <div className="filter-pill">
                    <select value={filters.clientId} onChange={(event) => handleFilterChange('clientId', event.target.value)} disabled={loadingClients}>
                        <option value="all">{t('guests.allClients')}</option>
                        {clientOptions.map((client) => (
                            <option key={client.id} value={client.id}>{client.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {error && <div className="guests-error">{error}</div>}

            <div className="table-container guests-table-container">
                <table className="data-table guests-table">
                    <thead>
                        <tr>
                            <th>{t('clients.guests.name')}</th>
                            <th>{t('guests.client')}</th>
                            <th>{t('clients.guests.organization')}</th>
                            <th>{t('clients.guests.email')}</th>
                            <th>{t('clients.guests.mobileNumber')}</th>
                            <th>{t('clients.guests.status')}</th>
                            <th>{t('guests.invitationCount')}</th>
                            <th>{t('common.createdAt')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" className="loading-cell">{t('common.loading')}</td></tr>
                        ) : guests.length === 0 ? (
                            <tr><td colSpan="9" className="empty-cell">{t('guests.noGuests')}</td></tr>
                        ) : (
                            guests.map((guest) => {
                                const imageUrl = resolveAssetUrl(guest.avatar_path);
                                const clientLabel = i18n.language?.startsWith('ar')
                                    ? (guest.client_name_ar || guest.client_name || '')
                                    : (guest.client_name || guest.client_name_ar || '');

                                return (
                                    <tr key={guest.id}>
                                        <td>
                                            <div className="guest-name-cell">
                                                <div className="guest-avatar">
                                                    {imageUrl ? (
                                                        <img className="guest-avatar-image" src={imageUrl} alt={guest.name} />
                                                    ) : (
                                                        <span>{(guest.name || '?').charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <strong>{guest.name}</strong>
                                                {guest.position && <span>{guest.position}</span>}
                                            </div>
                                        </td>
                                        <td>{clientLabel || t('common.notAvailable')}</td>
                                        <td>{guest.organization || t('common.notAvailable')}</td>
                                        <td>{guest.email || t('common.notAvailable')}</td>
                                        <td>{guest.mobile_number || t('common.notAvailable')}</td>
                                        <td>
                                            <span className={`status-badge ${guest.status === 'banned' ? 'status-banned' : 'status-active'}`}>
                                                {guest.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="guest-counts">
                                                <strong>{formatNumber(guest.invitation_count)}</strong>
                                                <span>{formatNumber(guest.responded_count)} {t('guests.respondedShort')}</span>
                                            </div>
                                        </td>
                                        <td>{formatDate(guest.created_at, i18n.language)}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button type="button" className="action-btn" onClick={() => setSelectedGuest(guest)} title={t('common.view')}>
                                                    <Eye size={16} />
                                                </button>
                                                <Link to={`/clients/${guest.client_id}`} className="action-btn" title={t('guests.openClient')}>
                                                    <ChevronRight size={16} />
                                                </Link>
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

            {selectedGuest && (
                <GuestDrawer
                    guest={selectedGuest}
                    language={i18n.language}
                    onClose={() => setSelectedGuest(null)}
                />
            )}
        </div>
    );
}
