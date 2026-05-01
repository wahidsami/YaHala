import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Copy, Eye, Edit, Palette } from 'lucide-react';
import api from '../../services/api';
import RoleGuard from '../../components/auth/RoleGuard';
import './TemplateListPage.css';

export default function TemplateListPage() {
    const { t } = useTranslation();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', category: 'all', status: 'all' });

    useEffect(() => {
        fetchTemplates();
    }, [filters]);

    async function fetchTemplates() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                ...(filters.search && { search: filters.search }),
                ...(filters.category !== 'all' && { category: filters.category }),
                ...(filters.status !== 'all' && { status: filters.status })
            });
            const response = await api.get(`/admin/templates?${params}`);
            setTemplates(response.data.data);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleClone(id) {
        try {
            await api.post(`/admin/templates/${id}/clone`);
            fetchTemplates();
        } catch (error) {
            console.error('Clone failed:', error);
        }
    }

    return (
        <div className="template-list-page">
            <div className="page-header">
                <div>
                    <h1>{t('nav.templates')}</h1>
                    <p>{t('templates.listSubtitle')}</p>
                </div>
                <RoleGuard permission="templates.create">
                    <Link to="/templates/new" className="btn btn-primary">
                        <Plus size={18} />
                        <span>{t('templates.createTemplate')}</span>
                    </Link>
                </RoleGuard>
            </div>

            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder={t('templates.searchPlaceholder')}
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    />
                </div>
                <select value={filters.category} onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}>
                    <option value="all">{t('common.allCategories')}</option>
                    <option value="wedding">{t('templates.category.wedding')}</option>
                    <option value="corporate">{t('templates.category.corporate')}</option>
                    <option value="social">{t('templates.category.social')}</option>
                </select>
                <select value={filters.status} onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}>
                    <option value="all">{t('common.allStatuses')}</option>
                    <option value="draft">{t('templates.status.draft')}</option>
                    <option value="published">{t('templates.status.published')}</option>
                </select>
            </div>

            <div className="template-grid">
                {loading ? (
                    <p className="loading">Loading...</p>
                ) : templates.length === 0 ? (
                    <div className="empty-state">
                        <Palette size={48} />
                        <p>{t('templates.noTemplates')}</p>
                        <Link to="/templates/new" className="btn btn-primary">{t('templates.createFirstTemplate')}</Link>
                    </div>
                ) : (
                    templates.map(template => (
                        <div key={template.id} className="template-card">
                            <div className="template-preview">
                                <Palette size={32} />
                            </div>
                            <div className="template-info">
                                <h3>{template.name}</h3>
                                <span className={`category-badge ${template.category}`}>{t(`templates.category.${template.category}`)}</span>
                                <span className={`status-badge ${template.status}`}>{t(`templates.status.${template.status}`)}</span>
                            </div>
                            <div className="template-actions">
                                <Link to={`/templates/${template.id}`} className="action-btn" title={t('common.edit')}>
                                    <Edit size={16} />
                                </Link>
                                <RoleGuard permission="templates.create">
                                    <button className="action-btn" onClick={() => handleClone(template.id)} title={t('templates.clone')}>
                                        <Copy size={16} />
                                    </button>
                                </RoleGuard>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
