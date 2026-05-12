import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpenText, Briefcase, CalendarPlus, FolderOpen, Mail, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './HomeHubPage.css';

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

function formatShortDate(dateString, language) {
    if (!dateString) {
        return '';
    }
    const locale = language?.startsWith('ar') ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(dateString));
}

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
}

function ActionCard({ card }) {
    return (
        <Link to={card.path} className={`home-hub-card home-hub-card--${card.accent}`}>
            <div className="home-hub-card__art">
                <img
                    src={card.illustration}
                    alt={card.title}
                    className="home-hub-card__img"
                    draggable="false"
                />
            </div>
            <div className="home-hub-card__copy">
                <h2 className={`home-hub-card__title home-hub-card__title--${card.accent}`}>{card.title}</h2>
                <p>{card.description}</p>
            </div>
        </Link>
    );
}

export default function HomeHubPage() {
    const { t, i18n } = useTranslation();
    const { user, hasPermission } = useAuth();
    const [summary, setSummary] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const firstName = (user?.name || '').trim().split(/\s+/)[0] || t('app.name');

    useEffect(() => {
        let mounted = true;

        async function loadHub() {
            setLoading(true);

            const jobs = await Promise.allSettled([
                api.get('/admin/reports/overview'),
                hasPermission('events.view')
                    ? api.get('/admin/reports/events')
                    : Promise.resolve({ data: { data: [] } })
            ]);

            if (!mounted) {
                return;
            }

            if (jobs[0].status === 'fulfilled') {
                setSummary(jobs[0].value.data?.data || null);
            }
            if (jobs[1].status === 'fulfilled') {
                setEvents(jobs[1].value.data?.data || []);
            }

            setLoading(false);
        }

        loadHub();
        return () => {
            mounted = false;
        };
    }, [hasPermission]);

    const actionCards = useMemo(() => [
        {
            id: 'create-event',
            title: localize(i18n, 'Create Event', 'إنشاء فعالية'),
            description: localize(i18n, 'Start a new event with guided setup, schedule, and template selection.', 'خطط وأنشئ فعاليات رائعة في دقائق.'),
            path: '/events/new',
            icon: CalendarPlus,
            accent: 'coral',
            illustration: '/illustrations/card-create-event.png',
            allowed: hasPermission('events.create')
        },
        {
            id: 'guests',
            title: localize(i18n, 'Manage Guests', 'إدارة الضيوف'),
            description: localize(i18n, 'Import, segment, and track guest responses in one place.', 'عرض وتنظيم وإدارة قائمة ضيوفك.'),
            path: '/guests',
            icon: Users,
            accent: 'lavender',
            illustration: '/illustrations/card-manage-guests.png',
            allowed: hasPermission('guests.view')
        },
        {
            id: 'send',
            title: localize(i18n, 'Send Invitations', 'إرسال الدعوات'),
            description: localize(i18n, 'Choose channels, preview messages, and send confidently.', 'صمم الدعوات وأرسلها بسهولة تامة.'),
            path: '/send',
            icon: Mail,
            accent: 'mint',
            illustration: '/illustrations/card-send-invitations.png',
            allowed: hasPermission('events.view')
        },
        {
            id: 'library',
            title: localize(i18n, 'Library & Templates', 'المكتبة والقوالب'),
            description: localize(i18n, 'Find, preview, and reuse invitation templates quickly.', 'تصفح القوالب واحفظ مفضلاتك.'),
            path: '/library',
            icon: BookOpenText,
            accent: 'rose',
            illustration: '/illustrations/card-library-templates.png',
            allowed: hasPermission('templates.view')
        }
    ].filter((card) => card.allowed), [hasPermission, i18n]);

    const recentEvents = events.slice(0, 5);
    const upcomingThisWeek = events.filter((event) => {
        if (!event.start_datetime) {
            return false;
        }
        const target = new Date(event.start_datetime);
        const now = new Date();
        const diff = target.getTime() - now.getTime();
        return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    const totalGuests = summary?.summary?.guests_total || summary?.summary?.guests || 0;
    const totalClients = summary?.summary?.clients_total || 0;
    const activeClients = summary?.summary?.active_clients || 0;
    const clientActionsVisible = hasPermission('clients.view') || hasPermission('clients.create');

    const heroMetrics = [
        {
            id: 'clients',
            label: localize(i18n, 'Clients', 'العملاء'),
            value: formatNumber(totalClients)
        },
        {
            id: 'active-clients',
            label: localize(i18n, 'Active clients', 'العملاء النشطون'),
            value: formatNumber(activeClients)
        },
        {
            id: 'guests',
            label: localize(i18n, 'Guests', 'الضيوف'),
            value: formatNumber(totalGuests)
        },
        {
            id: 'this-week',
            label: localize(i18n, 'This week', 'هذا الأسبوع'),
            value: formatNumber(upcomingThisWeek)
        }
    ];

    return (
        <div className="home-hub-page">
            <section className="home-hub-hero">
                <div className="home-hub-hero__confetti" aria-hidden="true">
                    {Array.from({ length: 18 }).map((_, index) => (
                        <span key={index} className={`confetti-piece confetti-piece--${(index % 4) + 1}`} />
                    ))}
                </div>

                <p className="home-hub-hero__eyebrow">
                    {new Date().toLocaleDateString(i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })}
                </p>

                <h1 className="hub-display-title">
                    {localize(i18n, `Good morning, ${firstName}`, `صباح الخير، ${firstName}`)}{' '}
                    <span className="hub-display-title__accent">🎉</span>
                </h1>

                <p className="home-hub-hero__summary">
                    {localize(i18n, 'What would you like to do?', 'ماذا تريد أن تفعل اليوم؟')}
                </p>

                {clientActionsVisible && (
                    <div className="home-hub-workflow">
                        <div className="home-hub-workflow__copy">
                            <span>{localize(i18n, 'Client-first workflow', 'مسار العمل يبدأ من العميل')}</span>
                            <strong>{localize(i18n, 'Create or open a client before you create the event.', 'أنشئ العميل أو افتحه قبل إنشاء الفعالية.')}</strong>
                        </div>

                        <div className="home-hub-workflow__actions">
                            {hasPermission('clients.create') && (
                                <Link to="/clients/new" className="btn btn-primary home-hub-workflow__button">
                                    <Briefcase size={16} />
                                    <span>{localize(i18n, 'Create Client', 'إنشاء عميل')}</span>
                                </Link>
                            )}
                            {hasPermission('clients.view') && (
                                <Link to="/clients" className="btn btn-secondary home-hub-workflow__button">
                                    <FolderOpen size={16} />
                                    <span>{localize(i18n, 'Open Clients', 'فتح العملاء')}</span>
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {!loading && (
                    <div className="home-hub-metrics">
                        {heroMetrics.map((metric) => (
                            <div key={metric.id} className="home-hub-metric">
                                <strong>{metric.value}</strong>
                                <span>{metric.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="home-hub-actions">
                {actionCards.map((card) => (
                    <ActionCard key={card.id} card={card} />
                ))}
            </section>

            <section className="home-hub-recent">
                <div className="home-hub-recent__header">
                    <h2>{localize(i18n, 'Recent activity', 'النشاط الأخير')}</h2>
                    {hasPermission('events.view') && (
                        <Link to="/events">{localize(i18n, 'View all events', 'عرض كل الفعاليات')}</Link>
                    )}
                </div>

                <div className="home-hub-recent__list">
                    {recentEvents.length === 0 ? (
                        <div className="home-hub-empty">
                            {localize(i18n, 'No events yet. Create your first one to get started.', 'لا توجد فعاليات بعد. أنشئ أول فعالية للبدء.')}
                        </div>
                    ) : (
                        recentEvents.map((event) => {
                            const title = localize(i18n, event.name || 'Untitled event', event.name_ar || event.name || 'فعالية');
                            const client = localize(i18n, event.client_name || '', event.client_name_ar || event.client_name || '');
                            const imageUrl = resolveAssetUrl(event.event_logo_path || event.client_logo_path);

                            return (
                                <Link key={event.id} to={`/events/${event.id}`} className="recent-activity-card">
                                    <div className="recent-activity-card__thumb">
                                        {imageUrl ? <img src={imageUrl} alt={title} /> : <span>{title.slice(0, 1).toUpperCase()}</span>}
                                    </div>
                                    <div className="recent-activity-card__content">
                                        <strong>{title}</strong>
                                        <span>{client || localize(i18n, 'Event workspace', 'مساحة الفعالية')}</span>
                                        <small>{formatShortDate(event.start_datetime, i18n.language)}</small>
                                    </div>
                                    <span className={`recent-activity-card__status status-${event.status || 'draft'}`}>
                                        {event.status || localize(i18n, 'Draft', 'مسودة')}
                                    </span>
                                    <span className="recent-activity-card__chevron">
                                        <ArrowRight size={16} />
                                    </span>
                                </Link>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
}
