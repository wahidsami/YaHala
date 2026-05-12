import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, ClipboardList, Eye, Layers3, MessageSquare, Plus, Search, Trash2 } from 'lucide-react';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import RoleGuard from '../../components/auth/RoleGuard';
import './AddonsPage.css';

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

const ADDON_LABELS = {
    polls: { en: 'Polls', ar: 'الاستطلاعات' },
    questionnaires: { en: 'Questionnaires', ar: 'الاستبيانات' },
    instructions: { en: 'Instructions', ar: 'التعليمات' },
    quiz: { en: 'Quiz', ar: 'الاختبار' },
    'files-downloads': { en: 'Files & Downloads', ar: 'الملفات والتنزيلات' },
    guestbook: { en: 'Guestbook', ar: 'سجل الزوار' }
};

const ADDON_META = {
    polls: {
        icon: MessageSquare,
        description: 'Fast voting and preference collection for an event.'
    },
    questionnaires: {
        icon: ClipboardList,
        description: 'Longer forms for RSVP, attendee details, or pre-event intake.'
    },
    instructions: {
        icon: BookOpen,
        description: 'Reusable event instructions that can be linked into invitation cards.'
    }
};

const ENDPOINT_MAP = {
    polls: '/admin/polls',
    questionnaires: '/admin/questionnaires',
    instructions: '/admin/instructions'
};

function formatDate(value, lang = 'en') {
    if (!value) return '';
    const locale = lang?.startsWith('ar') ? 'ar-SA' : 'en-US';
    return new Date(value).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function AddonListPage() {
    const { i18n } = useTranslation();
    const { addonType = 'polls' } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [clients, setClients] = useState([]);
    const [events, setEvents] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        clientId: 'all',
        eventId: searchParams.get('eventId') || 'all'
    });
    const [confirmDialog, setConfirmDialog] = useState(null);

    const supportsApi = Boolean(ENDPOINT_MAP[addonType]);
    const supportsEventFilter = addonType === 'polls' || addonType === 'questionnaires' || addonType === 'instructions';
    const activeMeta = ADDON_META[addonType] || { icon: Layers3, description: 'Manage addon records for this module.' };
    const ActiveIcon = activeMeta.icon;
    const selectedEvent = useMemo(() => events.find((event) => event.id === filters.eventId) || null, [events, filters.eventId]);

    useEffect(() => {
        fetchClients();
        fetchEvents();
    }, []);

    useEffect(() => {
        setSelectedIds([]);
        if (supportsApi) {
            fetchList();
            return;
        }
        setItems([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
        setLoading(false);
    }, [addonType, filters, pagination.page, selectedEvent?.client_id]);

    async function fetchClients() {
        try {
            const response = await api.get('/admin/clients?pageSize=200&status=active');
            setClients(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch clients:', error);
        }
    }

    async function fetchEvents() {
        try {
            const response = await api.get('/admin/events?page=1&pageSize=200');
            setEvents(response.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch events:', error);
        }
    }

    async function fetchList() {
        setLoading(true);
        try {
            const effectiveClientId = filters.clientId !== 'all'
                ? filters.clientId
                : (addonType === 'instructions' && selectedEvent?.client_id ? selectedEvent.client_id : 'all');
            const params = new URLSearchParams({
                page: String(pagination.page),
                pageSize: String(pagination.pageSize),
                ...(filters.search ? { search: filters.search } : {}),
                ...(filters.status !== 'all' ? { status: filters.status } : {}),
                ...(effectiveClientId !== 'all' ? { clientId: effectiveClientId } : {}),
                ...(supportsEventFilter && filters.eventId !== 'all' && addonType !== 'instructions' ? { eventId: filters.eventId } : {})
            });

            const endpoint = ENDPOINT_MAP[addonType];
            const response = await api.get(`${endpoint}?${params.toString()}`);
            setItems(response.data.data || []);
            setPagination((prev) => ({ ...prev, ...response.data.pagination }));
        } catch (error) {
            console.error(`Failed to fetch ${addonType}:`, error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (filters.eventId && filters.eventId !== 'all') {
                next.set('eventId', filters.eventId);
            } else {
                next.delete('eventId');
            }
            return next;
        }, { replace: true });
    }, [filters.eventId, setSearchParams]);

    async function deleteItem(item) {
        try {
            const endpoint = ENDPOINT_MAP[addonType];
            await api.delete(`${endpoint}/${item.id}`);
            await fetchList();
        } catch (error) {
            console.error(`Failed to delete ${addonType} item:`, error);
        }
    }

    function openDeleteDialog(item) {
        setConfirmDialog({
            title: localize(i18n, 'Delete item', 'حذف العنصر'),
            description: localize(i18n, `Delete "${item.title || item.name || 'this item'}"?`, `هل تريد حذف "${item.title || item.name || 'هذا العنصر'}"؟`),
            confirmLabel: localize(i18n, 'Delete', 'حذف'),
            variant: 'danger',
            onConfirm: () => deleteItem(item)
        });
    }

    function toggleSelect(id) {
        setSelectedIds((prev) => (
            prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
        ));
    }

    function toggleSelectAll() {
        if (selectedIds.length === items.length) {
            setSelectedIds([]);
            return;
        }
        setSelectedIds(items.map((item) => item.id));
    }

    const pageTitle = useMemo(() => {
        const label = ADDON_LABELS[addonType];
        return label ? localize(i18n, label.en, label.ar) : localize(i18n, 'Addons', 'الإضافات');
    }, [addonType, i18n]);
    const publishedCount = items.filter((item) => item.status === 'published').length;
    const draftCount = items.filter((item) => item.status === 'draft').length;
    const contextualEventLabel = selectedEvent ? (selectedEvent.name || selectedEvent.name_ar || localize(i18n, 'Selected event', 'الفعالية المحددة')) : localize(i18n, 'All events', 'كل الفعاليات');

    return (
        <div className="addons-page">
            <nav className="addons-subnav">
                {Object.entries(ADDON_META).map(([key, meta]) => {
                    const Icon = meta.icon;
                    return (
                        <Link key={key} to={`/addons/${key}${filters.eventId !== 'all' ? `?eventId=${filters.eventId}` : ''}`} className={`addons-subnav-btn ${addonType === key ? 'active' : ''}`}>
                            <Icon size={16} />
                            <span>{localize(i18n, ADDON_LABELS[key].en, ADDON_LABELS[key].ar)}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="page-header">
                <div>
                    <h1>{pageTitle}</h1>
                    <p>{activeMeta.description}</p>
                </div>
            </div>

            <section className="addon-overview-shell">
                <div className="addon-overview-card">
                    <div className="addon-overview-card__head">
                        <div className="addon-overview-card__icon">
                            <ActiveIcon size={18} />
                        </div>
                        <div>
                            <strong>{localize(i18n, `${pageTitle} workspace`, `مساحة عمل ${pageTitle}`)}</strong>
                            <p>{localize(i18n, 'Organize this addon around the event first, then manage individual records.', 'نظّم هذه الإضافة حسب الفعالية أولًا، ثم أدر السجلات الفردية.')}</p>
                        </div>
                    </div>

                    <div className="addon-overview-card__stats">
                        <div><span>{localize(i18n, 'Loaded', 'المحمّلة')}</span><strong>{pagination.total || items.length}</strong></div>
                        <div><span>{localize(i18n, 'Published', 'المنشورة')}</span><strong>{publishedCount}</strong></div>
                        <div><span>{localize(i18n, 'Draft', 'المسودات')}</span><strong>{draftCount}</strong></div>
                        <div><span>{localize(i18n, 'Selected', 'المحددة')}</span><strong>{selectedIds.length}</strong></div>
                    </div>
                </div>

                <div className="addon-overview-card addon-overview-card--actions">
                    <div className="addon-overview-card__head">
                        <div className="addon-overview-card__icon addon-overview-card__icon--event">
                            <Layers3 size={18} />
                        </div>
                        <div>
                            <strong>{contextualEventLabel}</strong>
                            <p>{selectedEvent ? localize(i18n, 'Keep this addon list scoped to the current event and jump back into the event workspace when needed.', 'أبقِ هذه القائمة مرتبطة بالفعالية الحالية وارجع لمساحة الفعالية عند الحاجة.') : localize(i18n, 'Choose an event below to work in event context and keep addon management organized.', 'اختر فعالية أدناه للعمل ضمن سياق الفعالية وتنظيم إدارة الإضافات.')}</p>
                        </div>
                    </div>
                    <div className="addon-overview-card__links">
                        {selectedEvent && (
                            <Link to={`/events/${selectedEvent.id}`} className="addon-overview-link">
                                <span>{localize(i18n, 'Open event workspace', 'فتح مساحة الفعالية')}</span>
                            </Link>
                        )}
                        {selectedEvent && (
                            <Link to={`/reports?eventId=${selectedEvent.id}`} className="addon-overview-link">
                                <span>{localize(i18n, 'Open live report', 'فتح التقرير المباشر')}</span>
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            <section className="addon-list-shell">
                <div className="addon-list-header">
                    <div>
                        <h2>{pageTitle}</h2>
                        <p>{localize(i18n, `Search, filter, and manage all ${pageTitle.toLowerCase()} with event context.`, `ابحث وصفِّ وأدر جميع عناصر ${pageTitle} ضمن سياق الفعالية.`)}</p>
                    </div>
                    <RoleGuard permission="events.edit">
                        <button type="button" className="btn btn-primary" onClick={() => navigate(`/addons/${addonType}/new`)}>
                            <Plus size={16} />
                            <span>{localize(i18n, 'Add New', 'إضافة جديد')}</span>
                        </button>
                    </RoleGuard>
                </div>

                <div className="filters-bar">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder={localize(i18n, `Search ${pageTitle.toLowerCase()}...`, `ابحث في ${pageTitle}...`)}
                            value={filters.search}
                            onChange={(event) => {
                                setFilters((prev) => ({ ...prev, search: event.target.value }));
                                setPagination((prev) => ({ ...prev, page: 1 }));
                            }}
                        />
                    </div>

                    {supportsEventFilter && (
                        <select value={filters.eventId} onChange={(event) => {
                            setFilters((prev) => ({ ...prev, eventId: event.target.value }));
                            setPagination((prev) => ({ ...prev, page: 1 }));
                        }}>
                            <option value="all">{localize(i18n, 'All events', 'كل الفعاليات')}</option>
                            {events.map((event) => (
                                <option key={event.id} value={event.id}>{event.name || event.name_ar || localize(i18n, 'Untitled event', 'فعالية بدون عنوان')}</option>
                            ))}
                        </select>
                    )}

                    <select value={filters.status} onChange={(event) => {
                        setFilters((prev) => ({ ...prev, status: event.target.value }));
                        setPagination((prev) => ({ ...prev, page: 1 }));
                    }}>
                        <option value="all">{localize(i18n, 'All statuses', 'كل الحالات')}</option>
                        <option value="draft">{localize(i18n, 'Draft', 'مسودة')}</option>
                        <option value="published">{localize(i18n, 'Published', 'منشورة')}</option>
                        <option value="archived">{localize(i18n, 'Archived', 'مؤرشفة')}</option>
                        {addonType === 'polls' && <option value="ended">{localize(i18n, 'Ended', 'منتهية')}</option>}
                    </select>

                    <select value={filters.clientId} onChange={(event) => {
                        setFilters((prev) => ({ ...prev, clientId: event.target.value }));
                        setPagination((prev) => ({ ...prev, page: 1 }));
                    }}>
                        <option value="all">{localize(i18n, 'All clients', 'كل العملاء')}</option>
                        {clients.map((client) => (
                            <option key={client.id} value={client.id}>{client.name}</option>
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
                                        checked={items.length > 0 && selectedIds.length === items.length}
                                        onChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                </th>
                                <th>{localize(i18n, 'Title', 'العنوان')}</th>
                                <th>{localize(i18n, 'Client', 'العميل')}</th>
                                <th>{localize(i18n, 'Created', 'تاريخ الإنشاء')}</th>
                                <th>{localize(i18n, 'Actions', 'الإجراءات')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="loading-cell">{localize(i18n, 'Loading...', 'جارٍ التحميل...')}</td></tr>
                            ) : !supportsApi ? (
                                <tr><td colSpan="5" className="empty-cell">{localize(i18n, 'No data source connected yet for this addon type.', 'لا يوجد مصدر بيانات متصل لهذا النوع من الإضافات بعد.')}</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan="5" className="empty-cell">{localize(i18n, 'No records found.', 'لم يتم العثور على سجلات.')}</td></tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.id}>
                                        <td className="select-column">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                aria-label={`Select ${item.title || item.name || item.id}`}
                                            />
                                        </td>
                                        <td><strong>{item.title || item.name || localize(i18n, 'Untitled', 'بدون عنوان')}</strong></td>
                                        <td>{item.client_name || '-'}</td>
                                        <td>{formatDate(item.created_at, i18n.language)}</td>
                                        <td>
                                            <div className="row-actions">
                                                <Link to={`/addons/${addonType}/${item.id}/edit`} className="action-btn" title={localize(i18n, 'View', 'عرض')}><Eye size={16} /></Link>
                                                <Link to={`/addons/${addonType}/${item.id}/edit`} className="action-btn" title={localize(i18n, 'Edit', 'تحرير')}>{localize(i18n, 'Edit', 'تحرير')}</Link>
                                                <RoleGuard permission="events.edit">
                                                    <button type="button" className="action-btn danger" title={localize(i18n, 'Delete', 'حذف')} onClick={() => openDeleteDialog(item)}>
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
                        <button type="button" onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))} disabled={pagination.page <= 1}>{localize(i18n, 'Previous', 'السابق')}</button>
                        <span>{localize(i18n, `Page ${pagination.page} of ${pagination.totalPages}`, `الصفحة ${pagination.page} من ${pagination.totalPages}`)}</span>
                        <button type="button" onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages || 1, prev.page + 1) }))} disabled={pagination.page >= pagination.totalPages}>{localize(i18n, 'Next', 'التالي')}</button>
                    </div>
                )}
            </section>

            <ConfirmDialog
                open={Boolean(confirmDialog)}
                title={confirmDialog?.title || ''}
                description={confirmDialog?.description || ''}
                confirmLabel={confirmDialog?.confirmLabel || localize(i18n, 'Confirm', 'تأكيد')}
                cancelLabel={localize(i18n, 'Cancel', 'إلغاء')}
                variant={confirmDialog?.variant || 'danger'}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
        </div>
    );
}

export default function AddonsPageRouter() {
    const location = useLocation();
    if (location.pathname === '/addons' || location.pathname === '/addons/') {
        return <Navigate to="/addons/polls" replace />;
    }
    return <AddonListPage />;
}



