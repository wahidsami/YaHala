import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, ChevronLeft, LogOut, MoonStar, Search, Settings, SunMedium } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import logo from '../../../../../LogoColor.svg';
import CommandPalette from './CommandPalette';
import './HubChrome.css';

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function buildCrumbs(pathname, i18n) {
    if (pathname === '/') {
        return [];
    }

    const map = [
        { test: pathname === '/events/new', items: [localize(i18n, 'Create Event', 'إنشاء فعالية')] },
        { test: pathname === '/guests', items: [localize(i18n, 'Manage Guests', 'إدارة الضيوف')] },
        { test: pathname === '/send', items: [localize(i18n, 'Send Invitations', 'إرسال الدعوات')] },
        { test: pathname === '/library' || pathname === '/templates', items: [localize(i18n, 'Library', 'المكتبة')] },
        { test: pathname.startsWith('/templates/new'), items: [localize(i18n, 'Library', 'المكتبة'), localize(i18n, 'Create Template', 'إنشاء قالب')] },
        { test: pathname.startsWith('/templates/') && pathname.endsWith('/preview'), items: [localize(i18n, 'Library', 'المكتبة'), localize(i18n, 'Preview', 'المعاينة')] },
        { test: pathname.startsWith('/templates/'), items: [localize(i18n, 'Library', 'المكتبة'), localize(i18n, 'Template Builder', 'محرر القالب')] },
        { test: pathname === '/events', items: [localize(i18n, 'Events', 'الفعاليات')] },
        { test: pathname.startsWith('/events/') && pathname.endsWith('/edit'), items: [localize(i18n, 'Events', 'الفعاليات'), localize(i18n, 'Edit Event', 'تعديل الفعالية')] },
        { test: pathname.startsWith('/events/'), items: [localize(i18n, 'Events', 'الفعاليات'), localize(i18n, 'Event Workspace', 'مساحة الفعالية')] },
        { test: pathname === '/clients', items: [localize(i18n, 'Clients', 'العملاء')] },
        { test: pathname.startsWith('/clients/new'), items: [localize(i18n, 'Clients', 'العملاء'), localize(i18n, 'New Client', 'عميل جديد')] },
        { test: pathname.startsWith('/clients/') && pathname.endsWith('/edit'), items: [localize(i18n, 'Clients', 'العملاء'), localize(i18n, 'Edit Client', 'تعديل العميل')] },
        { test: pathname.startsWith('/clients/'), items: [localize(i18n, 'Clients', 'العملاء'), localize(i18n, 'Client Profile', 'ملف العميل')] },
        { test: pathname.startsWith('/addons'), items: [localize(i18n, 'Addons', 'الإضافات')] },
        { test: pathname.startsWith('/invitation-projects'), items: [localize(i18n, 'Invitation Projects', 'مشاريع الدعوات')] },
        { test: pathname === '/reports', items: [localize(i18n, 'Reports', 'التقارير')] },
        { test: pathname === '/logs', items: [localize(i18n, 'Logs', 'السجلات')] },
        { test: pathname === '/settings', items: [localize(i18n, 'Settings', 'الإعدادات')] }
    ];

    return map.find((entry) => entry.test)?.items || [localize(i18n, 'Workspace', 'مساحة العمل')];
}

export default function HubChrome() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const { language, toggleLanguage } = useLanguage();
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }
        return window.localStorage.getItem('yahala-admin-theme') === 'dark';
    });

    const crumbs = useMemo(() => buildCrumbs(location.pathname, i18n), [i18n, location.pathname]);
    const showBack = location.pathname !== '/';

    useEffect(() => {
        document.documentElement.classList.toggle('theme-dark', darkMode);
        window.localStorage.setItem('yahala-admin-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    useEffect(() => {
        function handleKeyDown(event) {
            const target = event.target;
            const tagName = target?.tagName?.toLowerCase();
            const inField = tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setPaletteOpen(true);
                return;
            }

            if (inField) {
                return;
            }

            if (event.key === '?') {
                event.preventDefault();
                setPaletteOpen(true);
                return;
            }

            if (event.key.toLowerCase() === 'n') {
                event.preventDefault();
                navigate('/events/new');
            }

            if (event.key === 'Escape') {
                setMenuOpen(false);
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    function handleBack() {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/');
    }

    function handleLanguageToggle() {
        toggleLanguage();
        setMenuOpen(false);
    }

    function handleSettings() {
        navigate('/settings');
        setMenuOpen(false);
    }

    async function handleLogout() {
        setMenuOpen(false);
        await logout();
    }

    const firstName = (user?.name || '').trim().split(/\s+/)[0] || t('app.name');

    return (
        <div className="hub-shell">
            <div className="hub-shell__background hub-shell__background--one" />
            <div className="hub-shell__background hub-shell__background--two" />
            <div className="hub-shell__background hub-shell__background--three" />

            <header className="hub-topbar">
                <div className="hub-topbar__left">
                    <button type="button" className={`hub-back-button ${showBack ? '' : 'is-hidden'}`} onClick={handleBack} aria-label={t('common.back')}>
                        <ChevronLeft size={18} />
                    </button>

                    <button type="button" className="hub-brand" onClick={() => navigate('/')}>
                        <img src={logo} alt={t('app.name')} />
                        <span>{t('app.name')}</span>
                    </button>

                    {showBack && (
                        <div className="hub-breadcrumbs">
                            <button type="button" onClick={() => navigate('/')}>
                                {localize(i18n, 'Home', 'الرئيسية')}
                            </button>
                            {crumbs.map((crumb) => (
                                <span key={crumb}>{crumb}</span>
                            ))}
                        </div>
                    )}
                </div>

                <button type="button" className="hub-search-pill" onClick={() => setPaletteOpen(true)}>
                    <Search size={18} />
                    <span>{localize(i18n, 'Search events, clients, guests, templates...', 'ابحث عن الفعاليات والعملاء والضيوف والقوالب...')}</span>
                    <kbd>⌘K</kbd>
                </button>

                <div className="hub-topbar__right">
                    <button
                        type="button"
                        className="hub-icon-button"
                        onClick={() => setDarkMode((current) => !current)}
                        aria-label={darkMode ? localize(i18n, 'Switch to light mode', 'التبديل إلى الوضع الفاتح') : localize(i18n, 'Switch to dark mode', 'التبديل إلى الوضع الداكن')}
                    >
                        {darkMode ? <SunMedium size={18} /> : <MoonStar size={18} />}
                    </button>

                    <button type="button" className="hub-icon-button hub-notification">
                        <Bell size={18} />
                        <span className="hub-notification__dot" />
                    </button>

                    {/* User menu: uses transparent backdrop to close — avoids mousedown race condition */}
                    <div className="hub-user-menu">
                        {menuOpen && (
                            <div
                                className="hub-user-backdrop"
                                onClick={() => setMenuOpen(false)}
                                aria-hidden="true"
                            />
                        )}

                        <button
                            type="button"
                            className="hub-user-button"
                            onClick={() => setMenuOpen((current) => !current)}
                        >
                            <span className="hub-user-avatar">{firstName.slice(0, 1).toUpperCase()}</span>
                            <span className="hub-user-meta">
                                <strong>{firstName}</strong>
                                <small>{user?.role?.replace(/_/g, ' ') || localize(i18n, 'Admin', 'مشرف')}</small>
                            </span>
                            <ChevronDown size={16} />
                        </button>

                        {menuOpen && (
                            <div className="hub-user-dropdown" role="menu">
                                <button type="button" role="menuitem" onClick={handleLanguageToggle}>
                                    <span className="menu-item-icon">🌐</span>
                                    {language === 'ar' ? 'English' : 'العربية'}
                                </button>
                                <button type="button" role="menuitem" onClick={handleSettings}>
                                    <Settings size={16} className="menu-item-icon" />
                                    {localize(i18n, 'Settings', 'الإعدادات')}
                                </button>
                                <div className="hub-user-dropdown__divider" />
                                <button type="button" role="menuitem" className="logout-item" onClick={handleLogout}>
                                    <LogOut size={16} className="menu-item-icon" />
                                    {t('auth.logout')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="hub-content-shell">
                <Outlet />
            </main>

            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </div>
    );
}
