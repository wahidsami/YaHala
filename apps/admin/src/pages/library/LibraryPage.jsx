import { useEffect, useMemo, useState } from 'react';
import {
    ArrowUpRight,
    Copy,
    Heart,
    LayoutTemplate,
    Palette,
    Plus,
    Search,
    Sparkles,
    UploadCloud
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import './LibraryPage.css';

const CATEGORY_ORDER = ['all', 'wedding', 'corporate', 'social', 'custom'];

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function formatCategoryKey(value) {
    return String(value || 'custom').toLowerCase();
}

function formatCategoryLabel(category, i18n) {
    const normalized = formatCategoryKey(category);

    if (normalized === 'wedding') {
        return localize(i18n, 'Wedding', 'زفاف');
    }
    if (normalized === 'corporate') {
        return localize(i18n, 'Corporate', 'مؤسسي');
    }
    if (normalized === 'social') {
        return localize(i18n, 'Social', 'اجتماعي');
    }
    if (normalized === 'custom') {
        return localize(i18n, 'Custom', 'مخصص');
    }

    const label = normalized.replace(/[_-]+/g, ' ').trim();
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function templateTone(template) {
    const category = formatCategoryKey(template.category);
    if (category === 'wedding') return 'rose';
    if (category === 'corporate') return 'ink';
    if (category === 'social') return 'mint';
    return 'lavender';
}

function templateMood(template, i18n) {
    const category = formatCategoryKey(template.category);
    if (category === 'wedding') {
        return localize(i18n, 'Romantic floral', 'زهري رومانسي');
    }
    if (category === 'corporate') {
        return localize(i18n, 'Executive clean', 'تنسيق مؤسسي أنيق');
    }
    if (category === 'social') {
        return localize(i18n, 'Festive gathering', 'أجواء احتفالية');
    }
    return localize(i18n, 'Custom canvas', 'لوحة مخصصة');
}

function templatePills(template, i18n) {
    const pills = [formatCategoryLabel(template.category, i18n)];

    if (template.is_system) {
        pills.push(localize(i18n, 'System', 'أساسي'));
    } else {
        pills.push(localize(i18n, 'Team', 'داخلي'));
    }

    if (template.status) {
        pills.push(formatCategoryLabel(template.status, i18n));
    }

    return pills.slice(0, 3);
}

function TemplatePreviewArt({ template, i18n }) {
    const title = localize(i18n, template.name || 'Untitled', template.name_ar || template.name || 'قالب');
    const tone = templateTone(template);

    return (
        <div className={`library-preview-art library-preview-art--${tone}`}>
            <div className="library-preview-art__card">
                <span>{formatCategoryLabel(template.category, i18n)}</span>
                <strong>{title}</strong>
                <small>{templateMood(template, i18n)}</small>
            </div>
            <div className="library-preview-art__sheet library-preview-art__sheet--back" />
            <div className="library-preview-art__sheet library-preview-art__sheet--front" />
        </div>
    );
}

export default function LibraryPage() {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cloningId, setCloningId] = useState('');
    const [notice, setNotice] = useState('');
    const [filters, setFilters] = useState({ search: '', category: 'all', savedOnly: false });
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
                const response = await api.get('/admin/templates?page=1&pageSize=120');
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
    }, []);

    useEffect(() => {
        window.localStorage.setItem('yahala-template-favorites', JSON.stringify(favorites));
    }, [favorites]);

    const categories = useMemo(() => {
        const dynamic = Array.from(new Set(
            templates
                .map((template) => formatCategoryKey(template.category))
                .filter(Boolean)
        ));

        const sorted = [
            ...CATEGORY_ORDER.filter((item) => item !== 'all' && dynamic.includes(item)),
            ...dynamic.filter((item) => !CATEGORY_ORDER.includes(item)).sort()
        ];

        return ['all', ...sorted];
    }, [templates]);

    const savedTemplates = useMemo(() => {
        const lookup = new Map(templates.map((template) => [template.id, template]));
        return favorites.map((id) => lookup.get(id)).filter(Boolean);
    }, [favorites, templates]);

    const filteredTemplates = useMemo(() => {
        const query = filters.search.trim().toLowerCase();

        return templates.filter((template) => {
            if (filters.savedOnly && !favorites.includes(template.id)) {
                return false;
            }

            if (filters.category !== 'all' && formatCategoryKey(template.category) !== filters.category) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [template.name, template.name_ar, template.category, template.status]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [favorites, filters.category, filters.savedOnly, filters.search, templates]);

    const featuredTemplate = filteredTemplates[0] || templates[0] || null;
    const systemCount = templates.filter((template) => template.is_system).length;
    const customCount = templates.filter((template) => formatCategoryKey(template.category) === 'custom').length;

    function toggleFavorite(templateId) {
        setFavorites((current) => (
            current.includes(templateId)
                ? current.filter((id) => id !== templateId)
                : [...current, templateId]
        ));
    }

    async function handleClone(templateId) {
        setCloningId(templateId);
        setNotice('');

        try {
            const response = await api.post(`/admin/templates/${templateId}/clone`);
            const cloned = response.data?.data;
            if (cloned) {
                setTemplates((current) => [cloned, ...current]);
                setNotice(localize(i18n, 'Template cloned into your library.', 'تم نسخ القالب إلى مكتبتك.'));
            }
        } catch (error) {
            console.error('Failed to clone template:', error);
        } finally {
            setCloningId('');
        }
    }

    return (
        <div className="library-page library-page--polished">
            <section className="library-page__hero">
                <div className="library-page__hero-copy">
                    <h1 className="hub-display-title">{localize(i18n, 'Library & Templates', 'المكتبة والقوالب')}</h1>
                    <p>{localize(i18n, 'Browse ready-made invitation looks, save the best ones, or open a fresh custom canvas.', 'تصفح قوالب الدعوات الجاهزة، واحفظ المفضلة، أو ابدأ تصميمًا مخصصًا من لوحة نظيفة.')}</p>
                </div>

                <div className="library-page__hero-actions">
                    <div className="library-page__search">
                        <Search size={18} />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                            placeholder={localize(i18n, 'Search templates, moods, or occasions...', 'ابحث عن القوالب أو المناسبات أو الأساليب...')}
                        />
                    </div>

                    <div className="library-page__hero-buttons">
                        <button type="button" className="library-ghost-button" onClick={() => navigate('/templates/new')}>
                            <UploadCloud size={16} />
                            <span>{localize(i18n, 'Upload your design', 'ارفع تصميمك')}</span>
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => navigate('/templates/new')}>
                            <Plus size={16} />
                            <span>{localize(i18n, 'Open builder', 'افتح المحرر')}</span>
                        </button>
                    </div>
                </div>
            </section>

            <div className="library-stats library-stats--compact">
                <article className="library-stat">
                    <span>{localize(i18n, 'In library', 'في المكتبة')}</span>
                    <strong>{templates.length}</strong>
                </article>
                <article className="library-stat">
                    <span>{localize(i18n, 'Saved', 'المحفوظة')}</span>
                    <strong>{savedTemplates.length}</strong>
                </article>
                <article className="library-stat">
                    <span>{localize(i18n, 'System set', 'القوالب الأساسية')}</span>
                    <strong>{systemCount}</strong>
                </article>
                <article className="library-stat">
                    <span>{localize(i18n, 'Custom-ready', 'جاهزة للتخصيص')}</span>
                    <strong>{customCount}</strong>
                </article>
            </div>

            <div className="library-showcase">
                <section className="library-featured">
                    {featuredTemplate ? (
                        <>
                            <div className="library-featured__copy">
                                <span className="library-kicker">{localize(i18n, 'Featured template', 'القالب المميز')}</span>
                                <h2>{localize(i18n, featuredTemplate.name || 'Untitled', featuredTemplate.name_ar || featuredTemplate.name || 'قالب')}</h2>
                                <p>{templateMood(featuredTemplate, i18n)}</p>
                                <div className="library-featured__pills">
                                    {templatePills(featuredTemplate, i18n).map((pill) => (
                                        <span key={pill}>{pill}</span>
                                    ))}
                                </div>
                                <div className="library-featured__actions">
                                    <Link to={`/events/new?templateId=${featuredTemplate.id}`} className="btn btn-primary">
                                        <Sparkles size={16} />
                                        <span>{localize(i18n, 'Use this template', 'استخدم هذا القالب')}</span>
                                    </Link>
                                    <button type="button" className="library-ghost-button" onClick={() => navigate(`/templates/${featuredTemplate.id}/preview`)}>
                                        <ArrowUpRight size={16} />
                                        <span>{localize(i18n, 'Preview', 'معاينة')}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="library-featured__preview">
                                <TemplatePreviewArt template={featuredTemplate} i18n={i18n} />
                            </div>
                        </>
                    ) : (
                        <div className="library-empty library-empty--soft">
                            <LayoutTemplate size={28} />
                            <span>{localize(i18n, 'No templates are available yet.', 'لا توجد قوالب متاحة بعد.')}</span>
                        </div>
                    )}
                </section>

                <aside className="library-upload-card">
                    <div className="library-upload-card__icon">
                        <Palette size={22} />
                    </div>
                    <h3>{localize(i18n, 'Bring your own design', 'أضف تصميمك الخاص')}</h3>
                    <p>{localize(i18n, 'Jump into the builder for a blank-canvas invitation, or start from a saved favorite and adapt it fast.', 'انتقل إلى المحرر لبدء دعوة من لوحة فارغة، أو ابدأ من قالب محفوظ وخصصه بسرعة.')}</p>
                    <div className="library-upload-card__actions">
                        <button type="button" className="btn btn-primary" onClick={() => navigate('/templates/new')}>
                            <Plus size={16} />
                            <span>{localize(i18n, 'Start custom design', 'ابدأ تصميمًا مخصصًا')}</span>
                        </button>
                        <button type="button" className="library-ghost-button" onClick={() => setFilters((current) => ({ ...current, savedOnly: true }))}>
                            <Heart size={16} />
                            <span>{localize(i18n, 'Work from saved', 'اعمل من المحفوظ')}</span>
                        </button>
                    </div>
                </aside>
            </div>

            <div className="library-page__chips">
                {categories.map((category) => (
                    <button
                        key={category}
                        type="button"
                        className={filters.category === category ? 'is-active' : ''}
                        onClick={() => setFilters((current) => ({ ...current, category }))}
                    >
                        {category === 'all' ? localize(i18n, 'All templates', 'كل القوالب') : formatCategoryLabel(category, i18n)}
                    </button>
                ))}
                <button
                    type="button"
                    className={filters.savedOnly ? 'is-active is-secondary' : 'is-secondary'}
                    onClick={() => setFilters((current) => ({ ...current, savedOnly: !current.savedOnly }))}
                >
                    <Heart size={15} />
                    <span>{localize(i18n, 'Saved only', 'المحفوظة فقط')}</span>
                </button>
            </div>

            {notice && <div className="status-banner success">{notice}</div>}

            <div className="library-page__layout">
                <section className="library-grid-wrap">
                    <div className="library-grid">
                        {loading ? (
                            <div className="library-empty">
                                <span>{localize(i18n, 'Loading templates...', 'جارٍ تحميل القوالب...')}</span>
                            </div>
                        ) : filteredTemplates.length === 0 ? (
                            <div className="library-empty">
                                <Palette size={26} />
                                <span>{localize(i18n, 'No templates matched your current filters.', 'لا توجد قوالب مطابقة للفلاتر الحالية.')}</span>
                            </div>
                        ) : (
                            filteredTemplates.map((template) => {
                                const title = localize(i18n, template.name || 'Untitled', template.name_ar || template.name || 'قالب');
                                const isSaved = favorites.includes(template.id);

                                return (
                                    <article key={template.id} className={`library-card library-card--${templateTone(template)}`}>
                                        <button
                                            type="button"
                                            className={`library-card__favorite ${isSaved ? 'is-active' : ''}`}
                                            onClick={() => toggleFavorite(template.id)}
                                            aria-label={localize(i18n, 'Save template', 'احفظ القالب')}
                                        >
                                            <Heart size={16} />
                                        </button>

                                        <div className="library-card__preview">
                                            <TemplatePreviewArt template={template} i18n={i18n} />
                                        </div>

                                        <div className="library-card__meta">
                                            <div className="library-card__copy">
                                                <div className="library-card__pills">
                                                    {templatePills(template, i18n).map((pill) => (
                                                        <span key={pill}>{pill}</span>
                                                    ))}
                                                </div>
                                                <h2>{title}</h2>
                                                <p>{templateMood(template, i18n)}</p>
                                            </div>

                                            <div className="library-card__actions">
                                                <Link to={`/events/new?templateId=${template.id}`}>{localize(i18n, 'Use template', 'استخدم القالب')}</Link>
                                                <button type="button" onClick={() => navigate(`/templates/${template.id}/preview`)}>
                                                    {localize(i18n, 'Preview', 'معاينة')}
                                                </button>
                                                <button type="button" onClick={() => navigate(`/templates/${template.id}`)}>
                                                    {localize(i18n, 'Edit', 'تحرير')}
                                                </button>
                                                <button type="button" onClick={() => handleClone(template.id)} disabled={cloningId === template.id}>
                                                    {cloningId === template.id ? localize(i18n, 'Cloning...', 'جارٍ النسخ...') : localize(i18n, 'Clone', 'نسخ')}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </div>
                </section>

                <aside className="library-sidebar">
                    <section className="library-sidebar__card">
                        <div className="library-sidebar__header">
                            <h3>{localize(i18n, 'Saved templates', 'القوالب المحفوظة')}</h3>
                            <span>{savedTemplates.length}</span>
                        </div>
                        {savedTemplates.length === 0 ? (
                            <p className="library-sidebar__empty">{localize(i18n, 'Tap the heart on any template to keep a shortlist here.', 'اضغط على القلب في أي قالب ليظهر هنا ضمن قائمتك المختصرة.')}</p>
                        ) : (
                            savedTemplates.slice(0, 6).map((template) => (
                                <button key={template.id} type="button" className="library-saved-item" onClick={() => navigate(`/templates/${template.id}`)}>
                                    <span>
                                        <strong>{localize(i18n, template.name || 'Untitled', template.name_ar || template.name || 'قالب')}</strong>
                                        <small>{formatCategoryLabel(template.category, i18n)}</small>
                                    </span>
                                    <Heart size={16} className="is-active" />
                                </button>
                            ))
                        )}
                    </section>

                    <section className="library-sidebar__card library-sidebar__upload">
                        <Sparkles size={24} />
                        <h3>{localize(i18n, 'Quick routes', 'مسارات سريعة')}</h3>
                        <div className="library-quick-links">
                            <button type="button" onClick={() => navigate('/templates/new')}>
                                <Plus size={15} />
                                <span>{localize(i18n, 'Blank canvas', 'لوحة فارغة')}</span>
                            </button>
                            <button type="button" onClick={() => navigate('/templates')}>
                                <LayoutTemplate size={15} />
                                <span>{localize(i18n, 'Browse all', 'تصفح الكل')}</span>
                            </button>
                            <button type="button" onClick={() => setFilters((current) => ({ ...current, savedOnly: true }))}>
                                <Heart size={15} />
                                <span>{localize(i18n, 'Saved set', 'المحفوظة')}</span>
                            </button>
                            <button type="button" onClick={() => featuredTemplate && navigate(`/templates/${featuredTemplate.id}/preview`)}>
                                <Copy size={15} />
                                <span>{localize(i18n, 'Preview latest', 'عاين الأحدث')}</span>
                            </button>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}

