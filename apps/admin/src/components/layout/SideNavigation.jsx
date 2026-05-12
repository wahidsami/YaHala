import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import RoleGuard from '../auth/RoleGuard';
import {
    LayoutDashboard,
    Users,
    Calendar,
    LayoutGrid,
    Palette,
    Mail,
    UserCheck,
    BarChart3,
    FileText,
    Settings,
    ChevronDown,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import dashboardLogo from '../../../../../Logowhite.svg';
import './SideNavigation.css';

const NAV_ITEMS = [
    { id: 'dashboard', icon: LayoutDashboard, path: '/', permission: null },
    { id: 'clients', icon: Users, path: '/clients', permission: 'clients.view' },
    { id: 'events', icon: Calendar, path: '/events', permission: 'events.view' },
    { id: 'addons', icon: LayoutGrid, path: '/addons', permission: null },
    { id: 'invitationProjects', icon: Mail, path: '/invitation-projects', permission: 'events.view' },
    { id: 'templates', icon: Palette, path: '/templates', permission: 'templates.view' },
    { id: 'guests', icon: UserCheck, path: '/guests', permission: 'guests.view' },
    { id: 'reports', icon: BarChart3, path: '/reports', permission: 'reports.view' },
    { id: 'logs', icon: FileText, path: '/logs', permission: 'logs.view' },
    { id: 'settings', icon: Settings, path: '/settings', permission: 'settings.view' }
];

const ADDON_SUB_ITEMS = [
    { id: 'polls', label: 'Polls', path: '/addons/polls' },
    { id: 'questionnaires', label: 'Questionnaires', path: '/addons/questionnaires' },
    { id: 'instructions', label: 'Instructions', path: '/addons/instructions' },
    { id: 'guestbook', label: 'Guestbook', path: '/addons/guestbook' },
    { id: 'quiz', label: 'Quiz', path: '/addons/quiz' },
    { id: 'files-downloads', label: 'Files & Downloads', path: '/addons/files-downloads' }
];

export default function SideNavigation({ collapsed = false, onToggleCollapse }) {
    const { t, i18n } = useTranslation();
    const { hasPermission, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const isAddonsRoute = location.pathname.startsWith('/addons');
    const [addonsOpen, setAddonsOpen] = useState(isAddonsRoute);
    const isArabic = i18n.language?.startsWith('ar');
    const CollapseIcon = isArabic
        ? (collapsed ? ChevronLeft : ChevronRight)
        : (collapsed ? ChevronRight : ChevronLeft);

    useEffect(() => {
        if (isAddonsRoute) {
            setAddonsOpen(true);
        }
    }, [isAddonsRoute]);

    function handleAddonsClick(event) {
        event.preventDefault();
        if (collapsed) {
            navigate('/addons/polls');
            return;
        }

        setAddonsOpen((prev) => !prev);
        if (!isAddonsRoute) {
            navigate('/addons/polls');
        }
    }

    return (
        <nav className={`side-navigation ${collapsed ? 'is-collapsed' : ''}`}>
            <div className="nav-brand">
                <img src={dashboardLogo} alt={t('app.name')} className="brand-logo" />
                <span className="brand-role">{user?.role?.replace('_', ' ')}</span>
                <button
                    type="button"
                    className="collapse-toggle"
                    onClick={onToggleCollapse}
                    aria-label={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
                    title={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
                >
                    <CollapseIcon size={18} />
                </button>
            </div>

            <ul className="nav-list">
                {NAV_ITEMS.map((item) => {
                    // Check permission
                    if (item.permission && !hasPermission(item.permission)) {
                        return null;
                    }

                    const Icon = item.icon;

                    if (item.id === 'addons') {
                        return (
                            <li key={item.id} className={`nav-group ${addonsOpen ? 'open' : ''}`}>
                                <a
                                    href={item.path}
                                    className={`nav-item ${isAddonsRoute ? 'active' : ''}`}
                                    title={collapsed ? t(`nav.${item.id}`) : undefined}
                                    onClick={handleAddonsClick}
                                >
                                    <Icon size={20} />
                                    <span>{t(`nav.${item.id}`)}</span>
                                    {!collapsed && <ChevronDown size={16} className={`nav-group-chevron ${addonsOpen ? 'open' : ''}`} />}
                                </a>
                                {!collapsed && addonsOpen && (
                                    <ul className="nav-sub-list">
                                        {ADDON_SUB_ITEMS.map((subItem) => (
                                            <li key={subItem.id}>
                                                <NavLink
                                                    to={subItem.path}
                                                    className={({ isActive }) => `nav-sub-item ${isActive ? 'active' : ''}`}
                                                >
                                                    {subItem.label}
                                                </NavLink>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    }

                    return (
                        <li key={item.id}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                title={collapsed ? t(`nav.${item.id}`) : undefined}
                            >
                                <Icon size={20} />
                                <span>{t(`nav.${item.id}`)}</span>
                            </NavLink>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
