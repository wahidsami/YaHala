import { useEffect, useMemo, useState } from 'react';
import { Heart, Palette, Plus, Search, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import './LibraryPage.css';

const CATEGORY_OPTIONS = [
    { id: 'all', en: 'All', ar: 'الكل' },
    { id: 'wedding', en: 'Wedding', ar: 'زفاف' },
    { id: 'corporate', en: 'Corporate', ar: 'شركات' },
    { id: 'social', en: 'Social', ar: 'اجتماعي' },
    { id: 'custom', en: 'Custom', ar: 'مخصص' }
];

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function templateTone(template) {
    const category = template.category || 'custom';
    if (category === 'wedding') return 'rose';
    if (category === 'corporate') return 'ink';
    if (category === 'social') return 'mint';
    return 'lavender';
}

export default function LibraryPage() {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', category: 'all' });
    const [favorites, setFavorites] = useState(() => {
        if (typeof window === 'undefined') {
            return [];
        }
        try {
            return JSON.parse(window.localStorage.getItem('yahala-template-favorites') || '[]');
        } catch {
            return [];
        }
    });

    useEffect(() => {
        let mounted = true;

        async function loadTemplates() {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    page: '1',
                    pageSize: '60',
                    ...(filters.search.trim() && { search: filters.search.trim() }),
                    ...(filters.category !== 'all' && { category: filters.category })
                });
                const response = await api.get(`/admin/templates?${params.toString()}`);
                if (mounted) {
                    setTemplates(response.data?.data || []);
                }
            } catch (error) {
                console.error('Failed to load templates:', error);
                if (mounted) {
                    setTemplates([]);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadTemplates();
        return () => {
            mounted = false;
        };
    }, [filters.category, filters.search]);

    useEffect(() => {
        window.localStorage.setItem('yahala-template-favorites', JSON.stringify(favorites));
    }, [favorites]);

    const favoriteTemplates = useMemo(
        () => templates.filter((template) => favorites.includes(template.id)).slice(0, 4),
        [favorites, templates]
    );

    function toggleFavorite(templateId) {
        setFavorites((current) => (
            current.includes(templateId)
                ? current.filter((id) => id !== templateId)
                : [...current, templateId]
        ));
    }

    return (
        <div className="library-page">
            <section className="library-page__hero">
                <div>
                    <h1 className="hub-display-title">{localize(i18n, 'Library & Templates', 'المكتبة والقوالب')}</h1>
                    <p>{localize(i18n, 'Beautiful invitations, ready to personalize.', 'دعوات جميلة جاهزة للتخصيص.')}</p>
                </div>
                <div className="library-page__search">
                    <Search size={18} />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                        placeholder={localize(i18n, 'Search templates...', 'ابحث عن القوالب...')}
                    />
                </div>
            </section>

            <div className="library-page__chips">
                {CATEGORY_OPTIONS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        className={filters.category === option.id ? 'is-active' : ''}
                        onClick={() => setFilters((current) => ({ ...current, category: option.id }))}
                    >
                        {localize(i18n, option.en, option.ar)}
                    </button>
                ))}
            </div>

            <div className="library-page__layout">
                <section className="library-grid">
                    {loading ? (
                        <div className="library-empty">{localize(i18n, 'Loading templates...', 'جاري تحميل القوالب...')}</div>
                    ) : templates.length === 0 ? (
                        <div className="library-empty">
                            <Palette size={26} />
                            <span>{localize(i18n, 'No templates matched your search.', 'لا توجد قوالب مطابقة لبحثك.')}</span>
                        </div>
                    ) : (
                        templates.map((template) => (
                            <article key={template.id} className={`library-card library-card--${templateTone(template)}`}>
                                <button type="button" className={`library-card__favorite ${favorites.includes(template.id) ? 'is-active' : ''}`} onClick={() => toggleFavorite(template.id)} aria-label={localize(i18n, 'Save template', 'احفظ القالب')}>
                                    <Heart size={16} />
                                </button>
                                <div className="library-card__preview">
                                    <div className="library-card__frame">
                                        <span className="library-card__eyebrow">{localize(i18n, 'Invitation', 'دعوة')}</span>
                                        <strong>{localize(i18n, template.name || 'Untitled', template.name_ar || template.name || 'قالب')}</strong>
                                        <small>{localize(i18n, template.category || 'custom', template.category || 'مخصص')}</small>
                                    </div>
                                </div>
                                <div className="library-card__meta">
                                    <div>
                                        <h2>{localize(i18n, template.name || 'Untitled', template.name_ar || template.name || 'قالب')}</h2>
                                        <span>{localize(i18n, template.category || 'custom', template.category || 'مخصص')}</span>
                                    </div>
                                    <div className="library-card__actions">
                                        <Link to={`/events/new?templateId=${template.id}`}>{localize(i18n, 'Use template', 'استخدم القالب')}</Link>
                                        <button type="button" onClick={() => navigate(`/templates/${template.id}`)}>
                                            {localize(i18n, 'Edit', 'تحرير')}
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </section>

                <aside className="library-sidebar">
                    <section className="library-sidebar__card">
                        <div className="library-sidebar__header">
                            <h3>{localize(i18n, 'Saved', 'المحفوظة')}</h3>
                            <span>{favoriteTemplates.length}</span>
                        </div>
                        {favoriteTemplates.length === 0 ? (
                            <p className="library-sidebar__empty">{localize(i18n, 'Tap the heart on a template to keep it close.', 'اضغط على القلب لحفظ القالب.')}</p>
                        ) : (
                            favoriteTemplates.map((template) => (
                                <button key={template.id} type="button" className="library-saved-item" onClick={() => navigate(`/templates/${template.id}`)}>
                                    <span>
                                        <strong>{localize(i18n, template.name || 'Untitled', template.name_ar || template.name || 'قالب')}</strong>
                                        <small>{localize(i18n, template.category || 'custom', template.category || 'مخصص')}</small>
                                    </span>
                                    <Heart size={16} className="is-active" />
                                </button>
                            ))
                        )}
                    </section>

                    <section className="library-sidebar__card library-sidebar__upload">
                        <Sparkles size={24} />
                        <h3>{localize(i18n, 'Create your own design', 'أنشئ تصميمك الخاص')}</h3>
                        <p>{localize(i18n, 'Jump straight into the builder and start from a clean canvas.', 'انتقل مباشرة إلى المحرر وابدأ من لوحة فارغة.')}</p>
                        <button type="button" className="btn btn-primary" onClick={() => navigate('/templates/new')}>
                            <Plus size={16} />
                            <span>{localize(i18n, 'Open Builder', 'افتح المحرر')}</span>
                        </button>
                    </section>
                </aside>
            </div>
        </div>
    );
}
