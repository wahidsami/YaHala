import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Plus, Search, Trash2 } from 'lucide-react';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import RoleGuard from '../../components/auth/RoleGuard';
import './AddonsPage.css';

const ADDON_LABELS = {
    polls: 'Polls',
    questionnaires: 'Questionnaires',
    instructions: 'Instructions',
    quiz: 'Quiz',
    'files-downloads': 'Files & Downloads',
    guestbook: 'Guestbook'
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
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [clients, setClients] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
    const [filters, setFilters] = useState({ search: '', status: 'all', clientId: 'all' });
    const [confirmDialog, setConfirmDialog] = useState(null);

    const supportsApi = addonType === 'polls' || addonType === 'questionnaires';

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        if (supportsApi) {
            fetchList();
            return;
        }
        setItems([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
        setLoading(false);
    }, [addonType, filters, pagination.page]);

    async function fetchClients() {
        try {
            const response = await api.get('/admin/clients?pageSize=200&status=active');
            setClients(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch clients:', error);
        }
    }

    async function fetchList() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pagination.page),
                pageSize: String(pagination.pageSize),
                ...(filters.search ? { search: filters.search } : {}),
                ...(filters.status !== 'all' ? { status: filters.status } : {}),
                ...(filters.clientId !== 'all' ? { clientId: filters.clientId } : {})
            });

            const endpoint = addonType === 'polls' ? '/admin/polls' : '/admin/questionnaires';
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

    async function deleteItem(item) {
        try {
            if (addonType === 'polls') {
                await api.delete(`/admin/polls/${item.id}`);
            } else if (addonType === 'questionnaires') {
                await api.delete(`/admin/questionnaires/${item.id}`);
            }
            await fetchList();
        } catch (error) {
            console.error(`Failed to delete ${addonType} item:`, error);
        }
    }

    function openDeleteDialog(item) {
        setConfirmDialog({
            title: 'Delete item',
            description: `Delete "${item.title || item.name || 'this item'}"?`,
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: () => deleteItem(item)
        });
    }

    const pageTitle = useMemo(() => ADDON_LABELS[addonType] || 'Addons', [addonType]);

    return (
        <div className="addons-page">
            <div className="page-header">
                <div>
                    <h1>{pageTitle}</h1>
                    <p>Manage {pageTitle.toLowerCase()} records for this addon only.</p>
                </div>
            </div>

            <section className="addon-list-shell">
                <div className="addon-list-header">
                    <div>
                        <h2>{pageTitle}</h2>
                        <p>Search, filter, and manage all {pageTitle.toLowerCase()}.</p>
                    </div>
                    <RoleGuard permission="events.edit">
                        <button type="button" className="btn btn-primary" onClick={() => navigate(`/addons/${addonType}/new`)}>
                            <Plus size={16} />
                            <span>Add New</span>
                        </button>
                    </RoleGuard>
                </div>

                <div className="filters-bar">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder={`Search ${pageTitle.toLowerCase()}...`}
                            value={filters.search}
                            onChange={(event) => {
                                setFilters((prev) => ({ ...prev, search: event.target.value }));
                                setPagination((prev) => ({ ...prev, page: 1 }));
                            }}
                        />
                    </div>

                    <select value={filters.status} onChange={(event) => {
                        setFilters((prev) => ({ ...prev, status: event.target.value }));
                        setPagination((prev) => ({ ...prev, page: 1 }));
                    }}>
                        <option value="all">All statuses</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                        {addonType === 'polls' && <option value="ended">Ended</option>}
                    </select>

                    <select value={filters.clientId} onChange={(event) => {
                        setFilters((prev) => ({ ...prev, clientId: event.target.value }));
                        setPagination((prev) => ({ ...prev, page: 1 }));
                    }}>
                        <option value="all">All clients</option>
                        {clients.map((client) => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                    </select>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Client</th>
                                <th>Event</th>
                                <th>Created</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="loading-cell">Loading...</td></tr>
                            ) : !supportsApi ? (
                                <tr><td colSpan="6" className="empty-cell">No data source connected yet for this addon type.</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan="6" className="empty-cell">No records found.</td></tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.id}>
                                        <td><strong>{item.title || item.name || 'Untitled'}</strong></td>
                                        <td>{item.client_name || '-'}</td>
                                        <td>{item.event_name || '-'}</td>
                                        <td>{formatDate(item.created_at, i18n.language)}</td>
                                        <td><span className={`status-badge status-${item.status || 'draft'}`}>{item.status || 'draft'}</span></td>
                                        <td>
                                            <div className="row-actions">
                                                <Link to={`/addons/${addonType}/${item.id}`} className="action-btn" title="View"><Eye size={16} /></Link>
                                                <Link to={`/addons/${addonType}/${item.id}`} className="action-btn" title="Edit">Edit</Link>
                                                <RoleGuard permission="events.edit">
                                                    <button type="button" className="action-btn danger" title="Delete" onClick={() => openDeleteDialog(item)}>
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
                        <button type="button" onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))} disabled={pagination.page <= 1}>Previous</button>
                        <span>Page {pagination.page} of {pagination.totalPages}</span>
                        <button type="button" onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages || 1, prev.page + 1) }))} disabled={pagination.page >= pagination.totalPages}>Next</button>
                    </div>
                )}
            </section>

            <ConfirmDialog
                open={Boolean(confirmDialog)}
                title={confirmDialog?.title || ''}
                description={confirmDialog?.description || ''}
                confirmLabel={confirmDialog?.confirmLabel || 'Confirm'}
                cancelLabel="Cancel"
                variant={confirmDialog?.variant || 'danger'}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
        </div>
    );
}

function AddonEditorShell() {
    const { addonType = 'polls', id } = useParams();
    const navigate = useNavigate();
    const isNew = id === 'new';

    if (addonType === 'polls' && isNew) {
        return <Navigate to="/addons/polls/new-builder" replace />;
    }

    if (addonType === 'questionnaires' && isNew) {
        return <Navigate to="/addons/questionnaires/new-builder" replace />;
    }

    return (
        <div className="addons-page">
            <div className="page-header addon-editor-top">
                <div>
                    <button type="button" className="back-link" onClick={() => navigate(`/addons/${addonType}`)}>Back</button>
                    <h1>{isNew ? `New ${ADDON_LABELS[addonType] || addonType}` : `Edit ${ADDON_LABELS[addonType] || addonType}`}</h1>
                </div>
                <button type="button" className="btn btn-primary">Save</button>
            </div>

            <section className="addon-editor-shell">
                <div className="addon-editor-form-grid">
                    <label>
                        <span>Addon Name</span>
                        <input type="text" placeholder="Enter addon name" />
                    </label>
                    <label>
                        <span>Client</span>
                        <select defaultValue="">
                            <option value="">Select client</option>
                        </select>
                    </label>
                </div>

                <div className="addon-editor-placeholder">
                    <h3>Editor Area</h3>
                    <p>This is the dedicated editor container for {addonType}. We can now plug the full builder here.</p>
                </div>
            </section>
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

export { AddonEditorShell };
