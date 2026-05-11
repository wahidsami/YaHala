import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowUpRight,
    BadgeCheck,
    Building2,
    ChevronLeft,
    ChevronRight,
    CircleDashed,
    Clock3,
    Copy,
    Download,
    Eye,
    Filter,
    Mail,
    MapPin,
    Phone,
    Plus,
    Search,
    Upload,
    Users,
    X
} from 'lucide-react';
import RoleGuard from '../../components/auth/RoleGuard';
import api from '../../services/api';
import '../clients/ClientListPage.css';
import './GuestsPage.css';

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

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

function formatPercent(value) {
    return `${Math.round(Number(value || 0))}%`;
}

function getGuestFlowState(guest) {
    if (guest.status === 'banned') {
        return 'banned';
    }

    if (Number(guest.responded_count || 0) > 0) {
        return 'responded';
    }

    if (Number(guest.invitation_count || 0) > 0) {
        return 'awaiting';
    }

    return 'ready';
}

function flowLabel(i18n, flow) {
    if (flow === 'responded') {
        return localize(i18n, 'Responded', 'استجاب');
    }

    if (flow === 'awaiting') {
        return localize(i18n, 'Awaiting reply', 'بانتظار الرد');
    }

    if (flow === 'banned') {
        return localize(i18n, 'Restricted', 'مقيّد');
    }

    return localize(i18n, 'Ready to invite', 'جاهز للدعوة');
}

function QuickStatCard({ title, value, tone, icon: Icon }) {
    return (
        <article className={`guest-stat-card guest-stat-card--${tone}`}>
            <div className="guest-stat-card__icon">
                <Icon size={20} strokeWidth={2.5} />
            </div>
            <div className="guest-stat-card__head">
                <strong>{value}</strong>
                <span>{title}</span>
            </div>
        </article>
    );
}

function GuestDrawer({ guest, i18n, onClose }) {
    const { t } = useTranslation();

    if (!guest) {
        return null;
    }

    const imageUrl = resolveAssetUrl(guest.avatar_path);
    const clientLabel = i18n.language?.startsWith('ar')
        ? (guest.client_name_ar || guest.client_name || '')
        : (guest.client_name || guest.client_name_ar || '');
    const flow = getGuestFlowState(guest);

    return (
        <div className="guest-drawer-backdrop" role="presentation" onClick={onClose}>
            <aside
                className="guest-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={guest.name}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="guest-drawer__header">
                    <div>
                        <span className="drawer-eyebrow">{localize(i18n, 'Guest snapshot', 'ملخص الضيف')}</span>
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
                        <span className={`guest-flow-pill guest-flow-pill--${flow}`}>{flowLabel(i18n, flow)}</span>
                    </div>
                </div>

                <div className="guest-drawer__stats">
                    <div>
                        <span>{localize(i18n, 'Invites sent', 'الدعوات المرسلة')}</span>
                        <strong>{formatNumber(guest.invitation_count)}</strong>
                    </div>
                    <div>
                        <span>{localize(i18n, 'Responses', 'الردود')}</span>
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
                        <span>{flowLabel(i18n, flow)}</span>
                    </div>
                    <div className="info-row">
                        <Building2 size={16} />
                        <span>{clientLabel || t('common.notAvailable')}</span>
                    </div>
                </div>

                <div className="guest-drawer__footer">
                    <div>
                        <span>{localize(i18n, 'Last invited', 'آخر دعوة')}</span>
                        <strong>{formatDate(guest.last_invited_at, i18n.language) || t('common.notAvailable')}</strong>
                    </div>
                    <Link to={`/clients/${guest.client_id}?tab=guests`} className="btn btn-primary">
                        {localize(i18n, 'Open guestbook', 'فتح دفتر الضيوف')}
                    </Link>
                </div>
            </aside>
        </div>
    );
}

function ClientActionModal({ clients, i18n, mode, onClose, onConfirm }) {
    const [clientId, setClientId] = useState(clients[0]?.id || '');

    if (!mode) {
        return null;
    }

    const title = mode === 'import'
        ? localize(i18n, 'Choose a client for import', 'اختر العميل للاستيراد')
        : localize(i18n, 'Choose a client for a new guest', 'اختر العميل لإضافة ضيف جديد');
    const subtitle = mode === 'import'
        ? localize(i18n, 'Guest creation still belongs to each client guestbook. We will take you there.', 'إنشاء الضيوف ما زال مرتبطاً بدفتر ضيوف كل عميل. سننقلك إليه الآن.')
        : localize(i18n, 'New guests are created inside a client guestbook so ownership stays clear.', 'يتم إنشاء الضيوف داخل دفتر ضيوف العميل حتى تبقى الملكية واضحة.');

    return (
        <div className="guest-modal" role="dialog" aria-modal="true">
            <button type="button" className="guest-modal__backdrop" aria-label={localize(i18n, 'Close', 'إغلاق')} onClick={onClose} />
            <div className="guest-modal__panel guest-modal__panel--compact">
                <div className="guest-modal__header">
                    <div>
                        <p className="guest-modal__eyebrow">{mode === 'import' ? localize(i18n, 'Import guests', 'استيراد الضيوف') : localize(i18n, 'Add guest', 'إضافة ضيف')}</p>
                        <h3>{title}</h3>
                    </div>
                    <button type="button" className="icon-button" onClick={onClose} aria-label={localize(i18n, 'Close', 'إغلاق')}>
                        <X size={18} />
                    </button>
                </div>

                <p className="guest-modal__description">{subtitle}</p>

                <div className="field">
                    <label>{localize(i18n, 'Client', 'العميل')}</label>
                    <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
                        {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                                {i18n.language?.startsWith('ar') ? (client.name_ar || client.name) : (client.name || client.name_ar)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="guest-form__actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        {localize(i18n, 'Cancel', 'إلغاء')}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => onConfirm(clientId)} disabled={!clientId}>
                        {localize(i18n, 'Continue', 'متابعة')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function GuestsPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [guests, setGuests] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingClients, setLoadingClients] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
    const [summary, setSummary] = useState({ total: 0, active: 0, banned: 0, invited: 0, responded: 0 });
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        gender: 'all',
        clientId: 'all'
    });
    const [activeView, setActiveView] = useState('all');
    const [selectedGuest, setSelectedGuest] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [launcherMode, setLauncherMode] = useState('');

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        fetchGuests();
    }, [filters, pagination.page, pagination.pageSize]);

    useEffect(() => {
        if (!notice) {
            return undefined;
        }

        const timeout = window.setTimeout(() => setNotice(null), 3200);
        return () => window.clearTimeout(timeout);
    }, [notice]);

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
            setPagination((previous) => ({ ...previous, ...response.data.pagination }));
            setSummary(response.data.summary || {});
        } catch (fetchError) {
            console.error('Failed to fetch guests:', fetchError);
            setError(fetchError.response?.data?.message || t('guests.loadFailed'));
        } finally {
            setLoading(false);
        }
    }

    function handleFilterChange(key, value) {
        setFilters((previous) => ({ ...previous, [key]: value }));
        setPagination((previous) => ({ ...previous, page: 1 }));
    }

    function handleSearch(event) {
        handleFilterChange('search', event.target.value);
    }

    function handleSelectGuest(guestId, checked) {
        setSelectedIds((previous) => {
            if (checked) {
                return previous.includes(guestId) ? previous : [...previous, guestId];
            }

            return previous.filter((id) => id !== guestId);
        });
    }

    function handleSelectVisible(checked) {
        if (checked) {
            setSelectedIds((previous) => {
                const next = new Set(previous);
                visibleGuests.forEach((guest) => next.add(guest.id));
                return Array.from(next);
            });
            return;
        }

        setSelectedIds((previous) => previous.filter((id) => !visibleGuests.some((guest) => guest.id === id)));
    }

    function openClientGuestbook(clientId, mode = '') {
        if (!clientId) {
            return;
        }

        const suffix = mode ? `&guestAction=${mode}` : '';
        navigate(`/clients/${clientId}?tab=guests${suffix}`);
    }

    async function handleCopyEmails() {
        const emails = selectedGuests
            .map((guest) => String(guest.email || '').trim())
            .filter(Boolean);

        if (!emails.length) {
            setNotice({
                tone: 'warning',
                text: localize(i18n, 'No email addresses found in this selection.', 'لا توجد عناوين بريد إلكتروني في هذا التحديد.')
            });
            return;
        }

        try {
            await navigator.clipboard.writeText(emails.join(', '));
            setNotice({
                tone: 'success',
                text: localize(i18n, `Copied ${emails.length} email addresses.`, `تم نسخ ${emails.length} عنوان بريد إلكتروني.`)
            });
        } catch (clipboardError) {
            console.error('Failed to copy guest emails:', clipboardError);
            setNotice({
                tone: 'warning',
                text: localize(i18n, 'Clipboard access is unavailable in this browser.', 'الوصول إلى الحافظة غير متاح في هذا المتصفح.')
            });
        }
    }

    function handleExportSelection() {
        if (!selectedGuests.length) {
            return;
        }

        const rows = [
            ['name', 'client', 'organization', 'email', 'mobileNumber', 'status', 'invitationCount', 'respondedCount'],
            ...selectedGuests.map((guest) => [
                guest.name || '',
                guest.client_name || guest.client_name_ar || '',
                guest.organization || '',
                guest.email || '',
                guest.mobile_number || '',
                guest.status || '',
                guest.invitation_count || 0,
                guest.responded_count || 0
            ])
        ];

        const csv = rows
            .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'guest-selection.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        setNotice({
            tone: 'success',
            text: localize(i18n, `Exported ${selectedGuests.length} guests.`, `تم تصدير ${selectedGuests.length} ضيف.`)
        });
    }

    const invitedCount = Number(summary.invited || 0);
    const respondedCount = Number(summary.responded || 0);
    const awaitingCount = Math.max(0, invitedCount - respondedCount);
    const readyCount = Math.max(0, Number(summary.active || 0) - invitedCount);
    const totalCount = Number(summary.total || 0);
    const activeBase = Math.max(Number(summary.active || 0), 1);
    const totalBase = Math.max(totalCount, 1);

    const clientOptions = useMemo(() => clients.map((client) => ({
        id: client.id,
        label: i18n.language?.startsWith('ar') ? (client.name_ar || client.name) : (client.name || client.name_ar)
    })), [clients, i18n.language]);

    const viewTabs = useMemo(() => ([
        { id: 'all', label: localize(i18n, 'All guests', '?? ??????'), count: totalCount },
        { id: 'attending', label: localize(i18n, 'Attending', '????'), count: respondedCount },
        { id: 'pending', label: localize(i18n, 'Pending', '??? ????????'), count: awaitingCount },
        { id: 'declined', label: localize(i18n, 'Not Attending', '?? ????'), count: 0 }
    ]), [awaitingCount, i18n, respondedCount, totalCount]);

    const visibleGuests = useMemo(() => guests.filter((guest) => {
        const flow = getGuestFlowState(guest);

        if (activeView === 'attending') {
            return flow === 'responded';
        }

        if (activeView === 'pending') {
            return flow === 'awaiting';
        }

        if (activeView === 'declined') {
            return false; // Mock
        }

        return true;
    }), [activeView, guests]);

    useEffect(() => {
        setSelectedIds((previous) => previous.filter((id) => visibleGuests.some((guest) => guest.id === id)));
    }, [visibleGuests]);

    const selectedGuests = useMemo(() => visibleGuests.filter((guest) => selectedIds.includes(guest.id)), [selectedIds, visibleGuests]);
    const allVisibleSelected = visibleGuests.length > 0 && visibleGuests.every((guest) => selectedIds.includes(guest.id));
    const selectedClientIds = Array.from(new Set(selectedGuests.map((guest) => guest.client_id).filter(Boolean)));
    const suggestedClientId = selectedClientIds.length === 1
        ? selectedClientIds[0]
        : (filters.clientId !== 'all' ? filters.clientId : '');

    const quickGroups = [
        {
            id: 'follow-up',
            title: localize(i18n, 'Needs follow-up', 'بحاجة إلى متابعة'),
            caption: localize(i18n, 'Invited but still waiting on a reply', 'تمت دعوتهم وما زالوا بانتظار الرد'),
            value: awaitingCount,
            onClick: () => setActiveView('awaiting')
        },
        {
            id: 'ready',
            title: localize(i18n, 'Ready to invite', 'جاهزون للدعوة'),
            caption: localize(i18n, 'Active guests with no invite history yet', 'ضيوف نشطون بلا سجل دعوات بعد'),
            value: readyCount,
            onClick: () => setActiveView('ready')
        },
        {
            id: 'restricted',
            title: localize(i18n, 'Restricted', 'مقيّدون'),
            caption: localize(i18n, 'Banned guests who should stay out of campaigns', 'ضيوف محظورون يجب إبعادهم عن الحملات'),
            value: Number(summary.banned || 0),
            onClick: () => handleFilterChange('status', 'banned')
        },
        {
            id: 'all',
            title: localize(i18n, 'Workspace directory', 'دليل مساحة العمل'),
            caption: localize(i18n, 'Jump back to the full reusable guestbook', 'العودة إلى دفتر الضيوف الكامل'),
            value: totalCount,
            onClick: () => {
                setActiveView('all');
                setFilters((previous) => ({ ...previous, clientId: 'all', status: 'all' }));
                setPagination((previous) => ({ ...previous, page: 1 }));
            }
        }
    ];

    return (
        <div className="guests-page guests-redesign-page">
            <div className="page-header guests-page-header">
                <div className="guests-page-header__copy">
                    <span className="guests-page-header__eyebrow">{localize(i18n, 'Guest operations', 'عمليات الضيوف')}</span>
                    <h1>{t('nav.guests')}</h1>
                    <p>
                        {localize(
                            i18n,
                            'Start with invite progress, then jump into the right client guestbook whenever you need to add, import, or fix records.',
                            'ابدأ من تقدم الدعوات، ثم انتقل إلى دفتر ضيوف العميل المناسب كلما احتجت إلى إضافة أو استيراد أو تعديل السجلات.'
                        )}
                    </p>
                </div>

                <div className="guests-page-header__actions">
                    <RoleGuard permission="clients.edit">
                        <button type="button" className="btn btn-secondary" onClick={() => setLauncherMode('import')} disabled={!clients.length}>
                            <Upload size={16} />
                            <span>{t('clients.guests.importGuests')}</span>
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => setLauncherMode('create')} disabled={!clients.length}>
                            <Plus size={16} />
                            <span>{t('clients.guests.addGuest')}</span>
                        </button>
                    </RoleGuard>
                    <button type="button" className="btn btn-secondary" onClick={fetchGuests} disabled={loading}>
                        {t('common.refresh')}
                    </button>
                </div>
            </div>

            <div className="guest-stat-grid">
                <QuickStatCard
                    title={localize(i18n, 'Invited', '??? ??????')}
                    value={formatNumber(invitedCount)}
                    tone="lavender"
                    icon={Users}
                />
                <QuickStatCard
                    title={localize(i18n, 'Confirmed', '????')}
                    value={formatNumber(respondedCount)}
                    tone="mint"
                    icon={BadgeCheck}
                />
                <QuickStatCard
                    title={localize(i18n, 'Pending', '??? ????????')}
                    value={formatNumber(awaitingCount)}
                    tone="peach"
                    icon={Clock3}
                />
                <QuickStatCard
                    title={localize(i18n, 'Declined', '?????')}
                    value={formatNumber(0)}
                    tone="red"
                    icon={X}
                />
            </div>

            <div className="guests-workspace">
                <aside className="quick-groups-panel">
                    <h3>{localize(i18n, 'Quick Groups', '??????? ?????')}</h3>
                    <div className="quick-groups-list">
                        {quickGroups.map((group) => (
                            <button
                                key={group.id}
                                className={`quick-group-btn ${activeView === group.id || (group.id === 'restricted' && filters.status === 'banned') ? 'is-active' : '}`}
                                onClick={group.onClick}
                            >
                                <div className="quick-group-btn__info">
                                    <strong>{group.title}</strong>
                                    <span>{group.caption}</span>
                                </div>
                                <span className="quick-group-btn__count">{formatNumber(group.value)}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="guests-main">
                    <div className="guests-panel">
                        <div className="guest-tabs" role="tablist" aria-label={localize(i18n, 'Guest views', 'طرق عرض الضيوف')}>
                            {viewTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={activeView === tab.id ? 'is-active' : ''}
                                    onClick={() => setActiveView(tab.id)}
                                >
                                    <span>{tab.label}</span>
                                    <strong>{formatNumber(tab.count)}</strong>
                                </button>
                            ))}
                        </div>

                        <div className="guests-toolbar-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div className="guest-tabs" style={{ marginBottom: 0 }}>
                            {viewTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={activeView === tab.id ? 'is-active' : ''}
                                    onClick={() => setActiveView(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
                            <div className="guest-search-box" style={{ flex: "0 1 16rem" }}>
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder={localize(i18n, 'Search by name or email...', '????? ?????? ?? ??????...')}
                                    value={filters.search}
                                    onChange={(event) => {
                                        handleFilterChange('search', event.target.value);
                                        setActiveView('all');
                                    }}
                                />
                            </div>

                            <button type="button" className="btn btn-secondary" style={{ background: "transparent", borderColor: "var(--border-color)", borderRadius: "999px" }}>
                                <Filter size={16} />
                                <span>{t('common.filter')}</span>
                            </button>

                            <RoleGuard permission="clients.edit">
                                <button type="button" className="btn btn-secondary" onClick={() => setLauncherMode('import')} disabled={!clients.length} style={{ background: "transparent", borderColor: "var(--border-color)", borderRadius: "999px" }}>
                                    <Upload size={16} />
                                    <span>{localize(i18n, 'Import CSV', 'Import CSV')}</span>
                                </button>
                                <button type="button" className="btn btn-primary" onClick={() => setLauncherMode('create')} disabled={!clients.length} style={{ background: "#ef4444", borderColor: "#ef4444", color: "white", borderRadius: "999px" }}>
                                    <Plus size={16} />
                                    <span>{localize(i18n, 'Add Guest', 'Add Guest')}</span>
                                </button>
                            </RoleGuard>
                        </div>
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

                        {notice && <div className={`guests-banner guests-banner--${notice.tone}`} role="status">{notice.text}</div>}
                        {error && <div className="guests-error">{error}</div>}

                        <div className="guests-table-shell">
                            <div className="guests-table-summary">
                                <div>
                                    <strong>{formatNumber(visibleGuests.length)}</strong>
                                    <span>{localize(i18n, 'guests on this page', 'ضيف في هذه الصفحة')}</span>
                                </div>
                                <div>
                                    <strong>{formatNumber(pagination.total)}</strong>
                                    <span>{localize(i18n, 'in the filtered directory', 'في الدليل المفلتر')}</span>
                                </div>
                            </div>

                            <div className="table-container guests-table-container">
                                <table className="data-table guests-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                <input
                                                    type="checkbox"
                                                    checked={allVisibleSelected}
                                                    onChange={(event) => handleSelectVisible(event.target.checked)}
                                                    aria-label={t('clients.guests.selectAll')}
                                                />
                                            </th>
                                            <th>{t('clients.guests.name')}</th>
                                            <th>{t('guests.client')}</th>
                                            <th>{localize(i18n, 'Invite flow', 'مسار الدعوة')}</th>
                                            <th>{localize(i18n, 'Contact', 'التواصل')}</th>
                                            <th>{localize(i18n, 'Last activity', 'آخر نشاط')}</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="7" className="loading-cell">{t('common.loading')}</td></tr>
                                        ) : visibleGuests.length === 0 ? (
                                            <tr><td colSpan="7" className="empty-cell">{t('guests.noGuests')}</td></tr>
                                        ) : (
                                            visibleGuests.map((guest) => {
                                                const imageUrl = resolveAssetUrl(guest.avatar_path);
                                                const clientLabel = i18n.language?.startsWith('ar')
                                                    ? (guest.client_name_ar || guest.client_name || '')
                                                    : (guest.client_name || guest.client_name_ar || '');
                                                const flow = getGuestFlowState(guest);
                                                const isSelected = selectedIds.includes(guest.id);

                                                return (
                                                    <tr key={guest.id} className={isSelected ? 'is-selected' : ''}>
                                                        <td>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(event) => handleSelectGuest(guest.id, event.target.checked)}
                                                                aria-label={guest.name}
                                                            />
                                                        </td>
                                                        <td>
                                                            <div className="guest-identity-cell">
                                                                <div className="guest-avatar">
                                                                    {imageUrl ? (
                                                                        <img className="guest-avatar-image" src={imageUrl} alt={guest.name} />
                                                                    ) : (
                                                                        <span>{(guest.name || '?').charAt(0).toUpperCase()}</span>
                                                                    )}
                                                                </div>
                                                                <div className="guest-identity-copy">
                                                                    <strong>{guest.name}</strong>
                                                                    <span>{guest.position || guest.organization || t('common.notAvailable')}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="guest-client-cell">
                                                                <strong>{clientLabel || t('common.notAvailable')}</strong>
                                                                <span>{guest.organization || t('common.notAvailable')}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="guest-flow-cell">
                                                                <span className={`guest-flow-pill guest-flow-pill--${flow}`}>{flowLabel(i18n, flow)}</span>
                                                                <small>
                                                                    {localize(
                                                                        i18n,
                                                                        `${formatNumber(guest.invitation_count)} invites • ${formatNumber(guest.responded_count)} replies`,
                                                                        `${formatNumber(guest.invitation_count)} دعوات • ${formatNumber(guest.responded_count)} ردود`
                                                                    )}
                                                                </small>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="guest-contact-cell">
                                                                <span>{guest.email || t('common.notAvailable')}</span>
                                                                <small>{guest.mobile_number || t('common.notAvailable')}</small>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="guest-activity-cell">
                                                                <strong>{formatDate(guest.last_invited_at || guest.created_at, i18n.language)}</strong>
                                                                <span>
                                                                    {guest.last_invited_at
                                                                        ? localize(i18n, 'Last invite sent', 'آخر دعوة أُرسلت')
                                                                        : localize(i18n, 'Created in guestbook', 'تم إنشاؤه في دفتر الضيوف')}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="row-actions">
                                                                <button type="button" className="action-btn" onClick={() => setSelectedGuest(guest)} title={t('common.view')}>
                                                                    <Eye size={16} />
                                                                </button>
                                                                <Link to={`/clients/${guest.client_id}?tab=guests`} className="action-btn" title={localize(i18n, 'Open guestbook', 'فتح دفتر الضيوف')}>
                                                                    <ArrowUpRight size={16} />
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
                        </div>

                        <div className="pagination">
                            <button
                                type="button"
                                onClick={() => setPagination((previous) => ({ ...previous, page: Math.max(1, previous.page - 1) }))}
                                disabled={pagination.page <= 1 || loading}
                            >
                                <ChevronLeft size={16} />
                                <span>{t('common.previous')}</span>
                            </button>
                            <span>{t('common.pageOf', { page: pagination.page, totalPages: pagination.totalPages || 1 })}</span>
                            <button
                                type="button"
                                onClick={() => setPagination((previous) => ({ ...previous, page: Math.min(previous.totalPages || 1, previous.page + 1) }))}
                                disabled={pagination.page >= (pagination.totalPages || 1) || loading}
                            >
                                <span>{t('common.next')}</span>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </section>

                <aside className="guests-sidebar">
                    <div className="guests-helper-card">
                        <div className="guests-helper-card__head">
                            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.25rem", color: "#1e1b4b" }}>{t('Quick groups', 'Quick groups')}</h2>
                        </div>
                        <div className="quick-group-list">
                            {quickGroups.map((group) => (
                                <button
                                    key={group.id}
                                    type="button"
                                    className="quick-group-card"
                                    onClick={group.onClick}
                                    style={{ alignItems: "center", borderRadius: "999px", padding: "0.5rem 1rem", border: "1px solid var(--border-color)", background: "white", marginBottom: "0.5rem" }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <Users size={16} style={{ color: "var(--text-secondary)" }} />
                                        <strong style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-primary)" }}>{group.title}</strong>
                                    </div>
                                    <em style={{ background: "rgba(241, 245, 249, 0.8)", padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.8rem", color: "var(--color-primary)" }}>{group.value}</em>
                                </button>
                            ))}
                            <button
                                type="button"
                                className="quick-group-card"
                                style={{ justifyContent: "center", background: "transparent", border: "1px dashed var(--border-color)", color: "var(--text-secondary)", borderRadius: "999px", padding: "0.5rem 1rem" }}
                            >
                                <Plus size={16} />
                                <strong style={{ margin: 0, fontSize: "0.9rem" }}>{t('New group', 'New group')}</strong>
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {selectedIds.length > 0 && (
                <div className="guest-bulk-bar">
                    <div className="guest-bulk-bar__summary">
                        <strong>{localize(i18n, `${selectedIds.length} selected`, `${selectedIds.length} محدد`)}</strong>
                        <span>{localize(i18n, 'Use the current page selection for quick follow-up tasks.', 'استخدم تحديد هذه الصفحة لمهام المتابعة السريعة.')}</span>
                    </div>

                    <div className="guest-bulk-bar__actions">
                        <button type="button" className="btn btn-secondary" onClick={handleCopyEmails}>
                            <Copy size={16} />
                            <span>{localize(i18n, 'Copy emails', 'نسخ البريد الإلكتروني')}</span>
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={handleExportSelection}>
                            <Download size={16} />
                            <span>{localize(i18n, 'Export CSV', 'تصدير CSV')}</span>
                        </button>
                        {suggestedClientId ? (
                            <button type="button" className="btn btn-secondary" onClick={() => openClientGuestbook(suggestedClientId)}>
                                <ArrowUpRight size={16} />
                                <span>{localize(i18n, 'Review in client guestbook', 'مراجعة في دفتر ضيوف العميل')}</span>
                            </button>
                        ) : null}
                        <button type="button" className="btn btn-ghost" onClick={() => setSelectedIds([])}>
                            {localize(i18n, 'Clear selection', 'مسح التحديد')}
                        </button>
                    </div>
                </div>
            )}

            {selectedGuest && (
                <GuestDrawer
                    guest={selectedGuest}
                    i18n={i18n}
                    onClose={() => setSelectedGuest(null)}
                />
            )}

            <ClientActionModal
                clients={clients}
                i18n={i18n}
                mode={launcherMode}
                onClose={() => setLauncherMode('')}
                onConfirm={(clientId) => {
                    openClientGuestbook(clientId, launcherMode);
                    setLauncherMode('');
                }}
            />
        </div>
    );
}










