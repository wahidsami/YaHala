import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, ChevronLeft, Globe, LogOut, MoonStar, Search, Settings, SunMedium } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { addDebugLog } from '../../utils/debugLogger';
import logo from '../../../../../LogoColor.svg';
import CommandPalette from './CommandPalette';
import './HubChrome.css';

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function buildCrumbs(pathname, i18n) {
    if (pathname === '/') return [];
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
    return map.find((e) => e.test)?.items || [localize(i18n, 'Workspace', 'مساحة العمل')];
}

export default function HubChrome() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const { language, toggleLanguage } = useLanguage();
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const [darkMode, setDarkMode] = useState(() =>
        typeof window !== 'undefined' && window.localStorage.getItem('yahala-admin-theme') === 'dark'
    );

    const crumbs = useMemo(() => buildCrumbs(location.pathname, i18n), [i18n, location.pathname]);
    const showBack = location.pathname !== '/';

    useEffect(() => {
        document.documentElement.classList.toggle('theme-dark', darkMode);
        window.localStorage.setItem('yahala-admin-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    useEffect(() => {
        function onKey(e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); return; }
            const tag = e.target?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
            if (e.key === '?') { e.preventDefault(); setPaletteOpen(true); return; }
            if (e.key === 'Escape') { setMenuOpen(false); return; }
            if (e.key.toLowerCase() === 'n') { e.preventDefault(); navigate('/events/new'); }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [navigate]);

    useEffect(() => {
        if (!menuOpen) {
            return undefined;
        }

        function onWindowClick(event) {
            if (!menuRef.current || menuRef.current.contains(event.target)) {
                return;
            }
            setMenuOpen(false);
        }

        window.addEventListener('click', onWindowClick);
        return () => window.removeEventListener('click', onWindowClick);
    }, [menuOpen]);

    function handleBack() {
        window.history.length > 1 ? navigate(-1) : navigate('/');
    }

    // Each action: close menu AFTER action queued in next tick
    function doLanguage() {
        addDebugLog('info', 'menu.language.clicked');
        setMenuOpen(false);
        setTimeout(() => toggleLanguage(), 0);
    }

    function doSettings() {
        addDebugLog('info', 'menu.settings.clicked', { from: location.pathname });
        setMenuOpen(false);
        setTimeout(() => navigate('/settings'), 0);
    }

    async function doLogout() {
        addDebugLog('info', 'menu.logout.clicked');
        setMenuOpen(false);
        setTimeout(async () => { await logout(); }, 0);
    }

    const firstName = (user?.name || '').trim().split(/\s+/)[0] || t('app.name');

    return (
        <>

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
                                <button type="button" onClick={() => navigate('/')}>{localize(i18n, 'Home', 'الرئيسية')}</button>
                                {crumbs.map((crumb) => <span key={crumb}>{crumb}</span>)}
                            </div>
                        )}
                    </div>

                    <button type="button" className="hub-search-pill" onClick={() => setPaletteOpen(true)}>
                        <Search size={18} />
                        <span>{localize(i18n, 'Search events, clients, guests, templates...', 'ابحث عن الفعاليات والعملاء والضيوف والقوالب...')}</span>
                        <kbd>⌘K</kbd>
                    </button>

                    <div className="hub-topbar__right">
                        <button type="button" className="hub-icon-button" onClick={() => setDarkMode((c) => !c)}
                            aria-label={darkMode ? 'Light mode' : 'Dark mode'}>
                            {darkMode ? <SunMedium size={18} /> : <MoonStar size={18} />}
                        </button>

                        <button type="button" className="hub-icon-button hub-notification">
                            <Bell size={18} />
                            <span className="hub-notification__dot" />
                        </button>

                        {/* User menu: dropdown sits at z-index 9000 — well above the backdrop at 8000 */}
                        <div ref={menuRef} className="hub-user-menu" style={{ position: 'relative', zIndex: 9000 }}>
                            <button type="button" className="hub-user-button" onClick={() => setMenuOpen((c) => !c)}>
                                <span className="hub-user-avatar">{firstName.slice(0, 1).toUpperCase()}</span>
                                <span className="hub-user-meta">
                                    <strong>{firstName}</strong>
                                    <small>{user?.role?.replace(/_/g, ' ') || localize(i18n, 'Admin', 'مشرف')}</small>
                                </span>
                                <ChevronDown size={16} />
                            </button>

                            {menuOpen && (
                                <div className="hub-user-dropdown" role="menu">
                                    <button type="button" role="menuitem" onClick={doLanguage}>
                                        <Globe size={16} />
                                        <span>{language === 'ar' ? 'English' : 'العربية'}</span>
                                    </button>
                                    <button type="button" role="menuitem" onClick={doSettings}>
                                        <Settings size={16} />
                                        <span>{localize(i18n, 'Settings', 'الإعدادات')}</span>
                                    </button>
                                    <div className="hub-user-dropdown__divider" />
                                    <button type="button" role="menuitem" className="logout-item" onClick={doLogout}>
                                        <LogOut size={16} />
                                        <span>{t('auth.logout')}</span>
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
        </>
    );
}
