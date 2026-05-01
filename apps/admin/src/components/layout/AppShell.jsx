import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopHeader from './TopHeader';
import SideNavigation from './SideNavigation';
import './AppShell.css';

export default function AppShell() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        return window.localStorage.getItem('rawaj-sidebar-collapsed') === 'true';
    });

    useEffect(() => {
        window.localStorage.setItem('rawaj-sidebar-collapsed', String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    return (
        <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <TopHeader />
            <SideNavigation
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
            />
            <main className="content-area">
                <Outlet />
            </main>
        </div>
    );
}
