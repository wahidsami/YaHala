import { useEffect, useMemo, useState } from 'react';
import { Link2, Mail, Palette, Search, Settings, Sparkles, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './CommandPalette.css';

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function normalizeResults(rows, type, getPath, i18n) {
    return (rows || []).map((row) => ({
        id: `${type}-${row.id}`,
        type,
        path: getPath(row),
        title:
            row.title ||
            localize(i18n, row.name || row.display_name || row.email || row.id, row.name_ar || row.display_name_ar || row.name || row.display_name || row.email || row.id),
        subtitle: localize(
            i18n,
            row.client_name || row.event_name || row.email || '',
            row.client_name_ar || row.event_name_ar || row.client_name || row.event_name || row.email || ''
        )
    }));
}

export default function CommandPalette({ open, onClose }) {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { hasPermission } = useAuth();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [sections, setSections] = useState([]);

    const quickActions = useMemo(() => {
        const items = [
            {
                id: 'create-event',
                title: localize(i18n, 'Create event', 'إنشاء فعالية'),
                subtitle: localize(i18n, 'Start the guided event wizard', 'ابدأ معالج إنشاء الفعالية'),
                path: '/events/new',
                icon: Sparkles,
                allowed: hasPermission('events.create')
            },
            {
                id: 'manage-guests',
                title: localize(i18n, 'Manage guests', 'إدارة الضيوف'),
                subtitle: localize(i18n, 'Browse your guest directory', 'تصفح دليل الضيوف'),
                path: '/guests',
                icon: Users,
                allowed: hasPermission('guests.view')
            },
            {
                id: 'send-invitations',
                title: localize(i18n, 'Send invitations', 'إرسال الدعوات'),
                subtitle: localize(i18n, 'Open the event send workspace', 'افتح مساحة إرسال الدعوات'),
                path: '/send',
                icon: Mail,
                allowed: hasPermission('events.view')
            },
            {
                id: 'library',
                title: localize(i18n, 'Library & templates', 'المكتبة والقوالب'),
                subtitle: localize(i18n, 'Browse and reuse templates', 'تصفح القوالب وأعد استخدامها'),
                path: '/library',
                icon: Palette,
                allowed: hasPermission('templates.view')
            },
            {
                id: 'reports',
                title: localize(i18n, 'Reports', 'التقارير'),
                subtitle: localize(i18n, 'Operational and RSVP reporting', 'تقارير العمليات والردود'),
                path: '/reports',
                icon: Link2,
                allowed: hasPermission('reports.view')
            },
            {
                id: 'settings',
                title: localize(i18n, 'Settings', 'الإعدادات'),
                subtitle: localize(i18n, 'Delivery and system configuration', 'إعدادات التسليم والنظام'),
                path: '/settings',
                icon: Settings,
                allowed: hasPermission('settings.view')
            }
        ];

        return items.filter((item) => item.allowed);
    }, [hasPermission, i18n]);

    useEffect(() => {
        if (!open) {
            setQuery('');
            setSections([]);
            setLoading(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open || query.trim().length < 2) {
            setSections([]);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setLoading(true);

            const jobs = [];
            if (hasPermission('events.view')) {
                jobs.push(api.get(`/admin/events?page=1&pageSize=5&search=${encodeURIComponent(query.trim())}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }
            if (hasPermission('clients.view')) {
                jobs.push(api.get(`/admin/clients?page=1&pageSize=5&search=${encodeURIComponent(query.trim())}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }
            if (hasPermission('templates.view')) {
                jobs.push(api.get(`/admin/templates?page=1&pageSize=5&search=${encodeURIComponent(query.trim())}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }
            if (hasPermission('guests.view')) {
                jobs.push(api.get(`/admin/guests?page=1&pageSize=5&search=${encodeURIComponent(query.trim())}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }
            if (hasPermission('events.view')) {
                jobs.push(api.get(`/admin/invitation-projects?page=1&pageSize=5&search=${encodeURIComponent(query.trim())}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }

            const settled = await Promise.allSettled(jobs);
            if (cancelled) {
                return;
            }

            const [eventsRes, clientsRes, templatesRes, guestsRes, projectsRes] = settled.map((result) => (
                result.status === 'fulfilled' ? result.value.data?.data || [] : []
            ));

            const nextSections = [
                {
                    label: localize(i18n, 'Events', 'الفعاليات'),
                    items: normalizeResults(eventsRes, 'event', (row) => `/events/${row.id}`, i18n)
                },
                {
                    label: localize(i18n, 'Clients', 'العملاء'),
                    items: normalizeResults(clientsRes, 'client', (row) => `/clients/${row.id}`, i18n)
                },
                {
                    label: localize(i18n, 'Templates', 'القوالب'),
                    items: normalizeResults(templatesRes, 'template', (row) => `/templates/${row.id}`, i18n)
                },
                {
                    label: localize(i18n, 'Guests', 'الضيوف'),
                    items: normalizeResults(guestsRes, 'guest', (row) => `/clients/${row.client_id}`, i18n)
                },
                {
                    label: localize(i18n, 'Invitation projects', 'مشاريع الدعوات'),
                    items: normalizeResults(projectsRes, 'project', (row) => `/invitation-projects/${row.id}`, i18n)
                }
            ].filter((section) => section.items.length > 0);

            setSections(nextSections);
            setLoading(false);
        }, 220);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [hasPermission, i18n, open, query]);

    if (!open) {
        return null;
    }

    function handleNavigate(path) {
        navigate(path);
        onClose();
    }

    return (
        <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
            <div className="command-palette" role="dialog" aria-modal="true" aria-label={localize(i18n, 'Search the admin workspace', 'ابحث في لوحة التحكم')} onClick={(event) => event.stopPropagation()}>
                <div className="command-palette__search">
                    <Search size={18} />
                    <input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={localize(i18n, 'Search events, guests, templates...', 'ابحث عن الفعاليات والضيوف والقوالب...')}
                        autoFocus
                    />
                    <span className="command-palette__hint">Esc</span>
                </div>

                {query.trim().length < 2 ? (
                    <div className="command-palette__quick-actions">
                        <div className="command-palette__section-title">{localize(i18n, 'Quick actions', 'إجراءات سريعة')}</div>
                        {quickActions.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button key={item.id} type="button" className="command-palette__item" onClick={() => handleNavigate(item.path)}>
                                    <span className="command-palette__icon">
                                        <Icon size={16} />
                                    </span>
                                    <span>
                                        <strong>{item.title}</strong>
                                        <small>{item.subtitle}</small>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : loading ? (
                    <div className="command-palette__empty">{t('common.loading')}</div>
                ) : sections.length === 0 ? (
                    <div className="command-palette__empty">{localize(i18n, 'No matching results', 'لا توجد نتائج مطابقة')}</div>
                ) : (
                    <div className="command-palette__results">
                        {sections.map((section) => (
                            <div key={section.label} className="command-palette__section">
                                <div className="command-palette__section-title">{section.label}</div>
                                {section.items.map((item) => (
                                    <button key={item.id} type="button" className="command-palette__item" onClick={() => handleNavigate(item.path)}>
                                        <span className="command-palette__icon">
                                            {item.type === 'event' && <Sparkles size={16} />}
                                            {item.type === 'client' && <Users size={16} />}
                                            {item.type === 'template' && <Palette size={16} />}
                                            {item.type === 'guest' && <Mail size={16} />}
                                            {item.type === 'project' && <Link2 size={16} />}
                                        </span>
                                        <span>
                                            <strong>{item.title}</strong>
                                            <small>{item.subtitle || localize(i18n, 'Open detail', 'افتح التفاصيل')}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
