import { NavLink } from 'react-router-dom';
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
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import dashboardLogo from '../../../../../Logowhite.svg';
import './SideNavigation.css';

const NAV_ITEMS = [
    { id: 'dashboard', icon: LayoutDashboard, path: '/dashboard', permission: null },
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

export default function SideNavigation({ collapsed = false, onToggleCollapse }) {
    const { t, i18n } = useTranslation();
    const { hasPermission, user } = useAuth();
    const isArabic = i18n.language?.startsWith('ar');
    const CollapseIcon = isArabic
        ? (collapsed ? ChevronLeft : ChevronRight)
        : (collapsed ? ChevronRight : ChevronLeft);

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
