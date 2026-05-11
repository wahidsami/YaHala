import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Eye, Edit, Mail } from 'lucide-react';
import api from '../../services/api';
import RoleGuard from '../../components/auth/RoleGuard';
import './InvitationProjectsPage.css';

const STATUS_BADGE = {
    draft: 'status-draft',
    active: 'status-active',
    paused: 'status-paused',
    archived: 'status-archived',
    completed: 'status-completed'
};

export default function InvitationProjectListPage() {
    const { t, i18n } = useTranslation();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
    const [filters, setFilters] = useState({
        search: '',
        status: 'all'
    });

    useEffect(() => {
        fetchProjects();
    }, [pagination.page, filters]);

    async function fetchProjects() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                pageSize: pagination.pageSize,
                ...(filters.search && { search: filters.search }),
                ...(filters.status !== 'all' && { status: filters.status })
            });

            const response = await api.get(`/admin/invitation-projects?${params}`);
            setProjects(response.data.data);
            setPagination(prev => ({ ...prev, ...response.data.pagination }));
        } catch (error) {
            console.error('Failed to fetch invitation projects:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(event) {
        setFilters(prev => ({ ...prev, search: event.target.value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }

    function handleStatusChange(event) {
        setFilters(prev => ({ ...prev, status: event.target.value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }

    function formatDate(dateString) {
        const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
        return new Date(dateString).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function localized(primary, secondary) {
        return i18n.language === 'ar' ? (secondary || primary) : (primary || secondary);
    }

    return (
        <div className="invitation-projects-page">
            <div className="page-header hub-display-title">
                <div className="hub-display-title__copy">
                    <span className="hub-display-title__eyebrow">{t('nav.invitationProjects')}</span>
                    <h1>{t('invitationProjects.title')}</h1>
                </div>

                <div className="hub-display-title__actions">
                    <RoleGuard permission="events.create">
                        <Link to="/invitation-projects/new" className="btn btn-primary">
                            <Plus size={16} />
                            <span>{t('invitationProjects.newProject')}</span>
                        </Link>
                    </RoleGuard>
                </div>
            </div>

            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder={t('invitationProjects.searchPlaceholder')}
                        value={filters.search}
                        onChange={handleSearch}
                    />
                </div>

                <select value={filters.status} onChange={handleStatusChange}>
                    <option value="all">{t('invitationProjects.allStatuses')}</option>
                    <option value="draft">{t('invitationProjects.status.draft')}</option>
                    <option value="active">{t('invitationProjects.status.active')}</option>
                    <option value="paused">{t('invitationProjects.status.paused')}</option>
                    <option value="completed">{t('invitationProjects.status.completed')}</option>
                    <option value="archived">{t('invitationProjects.status.archived')}</option>
                </select>
            </div>

            <div className="client-card-grid">
                {loading ? (
                    <div className="loading-state">{t('common.loading')}</div>
                ) : projects.length === 0 ? (
                    <div className="empty-state">{t('invitationProjects.emptyState')}</div>
                ) : (
                    projects.map((project) => (
                        <div key={project.id} className="client-card">
                            <div className="client-card__header">
                                <div className="client-card__logo">
                                    <Mail size={24} />
                                </div>
                                <div className="client-card__actions">
                                    <Link to={`/invitation-projects/${project.id}`} className="action-btn" title={t('common.view')}>
                                        <Eye size={16} />
                                    </Link>
                                    <RoleGuard permission="events.edit">
                                        <Link to={`/invitation-projects/${project.id}/edit`} className="action-btn" title={t('common.edit')}>
                                            <Edit size={16} />
                                        </Link>
                                    </RoleGuard>
                                </div>
                            </div>
                            <div className="client-card__body">
                                <h3>{localized(project.name, project.name_ar)}</h3>
                                {project.name_ar && project.name && project.name_ar !== project.name && <span className="client-name-ar">{project.name_ar}</span>}
                                
                                <div className="client-card__meta">
                                    <span className={`status-badge ${STATUS_BADGE[project.status] || 'status-draft'}`}>
                                        {t(`invitationProjects.status.${project.status}`)}
                                    </span>
                                </div>
                                
                                <div className="project-meta" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <span>{localized(project.event_name, project.event_name_ar)}</span>
                                    {project.client_name && <span> • {localized(project.client_name, project.client_name_ar)}</span>}
                                </div>
                            </div>
                            <div className="client-card__footer">
                                <div className="client-card__stat">
                                    <strong>{project.recipient_count || 0}</strong>
                                    <span>{t('invitationProjects.recipients')}</span>
                                </div>
                                <div className="client-card__stat">
                                    <strong>{project.page_count || 0}</strong>
                                    <span>{t('invitationProjects.pages')}</span>
                                </div>
                                <div className="client-card__stat">
                                    <strong>{formatDate(project.updated_at)}</strong>
                                    <span>{t('invitationProjects.updated')}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {pagination.totalPages > 1 && (
                <div className="pagination">
                    <button
                        disabled={pagination.page === 1}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    >
                        {t('common.previous')}
                    </button>
                    <span>{t('invitationProjects.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}</span>
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


