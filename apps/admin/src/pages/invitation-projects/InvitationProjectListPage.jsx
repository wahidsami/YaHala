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
            <div className="page-header">
                <div>
                    <h1>{t('invitationProjects.title')}</h1>
                    <p>{t('invitationProjects.subtitle')}</p>
                </div>

                <RoleGuard permission="events.create">
                    <Link to="/invitation-projects/new" className="btn btn-primary">
                        <Plus size={18} />
                        <span>{t('invitationProjects.newProject')}</span>
                    </Link>
                </RoleGuard>
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

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('invitationProjects.project')}</th>
                            <th>{t('invitationProjects.event')}</th>
                            <th>{t('invitationProjects.statusLabel')}</th>
                            <th>{t('invitationProjects.recipients')}</th>
                            <th>{t('invitationProjects.pages')}</th>
                            <th>{t('invitationProjects.updated')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="loading-cell">{t('common.loading')}</td>
                            </tr>
                        ) : projects.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="empty-cell">{t('invitationProjects.emptyState')}</td>
                            </tr>
                        ) : (
                            projects.map((project) => (
                                <tr key={project.id}>
                                    <td>
                                        <div className="project-name">
                                            <strong>{localized(project.name, project.name_ar)}</strong>
                                            {project.name_ar && project.name && project.name_ar !== project.name && <span className="name-ar">{project.name_ar}</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="project-meta">
                                            <span>{localized(project.event_name, project.event_name_ar)}</span>
                                            {project.client_name && <span className="meta-subtle">{localized(project.client_name, project.client_name_ar)}</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${STATUS_BADGE[project.status] || 'status-draft'}`}>
                                            {t(`invitationProjects.status.${project.status}`)}
                                        </span>
                                    </td>
                                    <td>{project.recipient_count || 0}</td>
                                    <td>{project.page_count || 0}</td>
                                    <td>{formatDate(project.updated_at)}</td>
                                    <td>
                                        <div className="row-actions">
                                            <Link to={`/invitation-projects/${project.id}`} className="action-btn" title={t('common.view')}>
                                                <Eye size={16} />
                                            </Link>
                                            <RoleGuard permission="events.edit">
                                                <Link to={`/invitation-projects/${project.id}/edit`} className="action-btn" title={t('common.edit')}>
                                                    <Edit size={16} />
                                                </Link>
                                            </RoleGuard>
                                            <Link
                                                to={`/invitation-projects/${project.id}`}
                                                className="action-btn"
                                                title={t('invitationProjects.manage')}
                                            >
                                                <Mail size={16} />
                                            </Link>
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
