import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpenText, CalendarPlus, Mail, Users } from 'lucide-react';
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
            description: localize(i18n, 'Plan and launch a new event in guided steps.', 'خطط وأطلق فعالية جديدة عبر خطوات واضحة.'),
            path: '/events/new',
            icon: CalendarPlus,
            accent: 'coral',
            allowed: hasPermission('events.create')
        },
        {
            id: 'guests',
            title: localize(i18n, 'Manage Guests', 'إدارة الضيوف'),
            description: localize(i18n, 'Review guest records and follow the latest activity.', 'راجع سجلات الضيوف وتابع أحدث النشاطات.'),
            path: '/guests',
            icon: Users,
            accent: 'lavender',
            allowed: hasPermission('guests.view')
        },
        {
            id: 'send',
            title: localize(i18n, 'Send Invitations', 'إرسال الدعوات'),
            description: localize(i18n, 'Choose an event, preview the message, and send.', 'اختر فعالية واعرض الرسالة ثم أرسلها.'),
            path: '/send',
            icon: Mail,
            accent: 'mint',
            allowed: hasPermission('events.view')
        },
        {
            id: 'library',
            title: localize(i18n, 'Library & Templates', 'المكتبة والقوالب'),
            description: localize(i18n, 'Browse designs and jump into the builder.', 'تصفح التصاميم وادخل إلى محرر القوالب.'),
            path: '/library',
            icon: BookOpenText,
            accent: 'rose',
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

    return (
        <div className="home-hub-page">
            <section className="home-hub-hero">
                <p className="home-hub-hero__eyebrow">{new Date().toLocaleDateString(i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                <h1 className="hub-display-title">
                    {localize(i18n, `Good evening, ${firstName}`, `مساء الخير، ${firstName}`)}
                </h1>
                <p className="home-hub-hero__summary">
                    {loading
                        ? t('common.loading')
                        : localize(
                            i18n,
                            `${upcomingThisWeek} events coming up this week • ${totalGuests} guests in your workspace`,
                            `${upcomingThisWeek} فعاليات هذا الأسبوع • ${totalGuests} ضيف في مساحة العمل`
                        )}
                </p>
            </section>

            <section className="home-hub-actions">
                {actionCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Link key={card.id} to={card.path} className={`home-hub-card home-hub-card--${card.accent}`}>
                            <div className="home-hub-card__icon">
                                <Icon size={28} />
                            </div>
                            <div>
                                <h2>{card.title}</h2>
                                <p>{card.description}</p>
                            </div>
                            <span className="home-hub-card__arrow">
                                <ArrowRight size={18} />
                            </span>
                        </Link>
                    );
                })}
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
                                </Link>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
}
