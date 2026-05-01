import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Globe, LogOut, User } from 'lucide-react';
import './TopHeader.css';

export default function TopHeader() {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const { language, toggleLanguage } = useLanguage();

    return (
        <header className="top-header">
            <div className="header-title">
                <h1>{t('app.name')}</h1>
            </div>

            <div className="header-actions">
                {/* Language Toggle */}
                <button className="header-btn" onClick={toggleLanguage} title="Toggle Language">
                    <Globe size={20} />
                    <span>{language === 'ar' ? 'EN' : 'ع'}</span>
                </button>

                {/* User Menu */}
                <div className="user-menu">
                    <User size={20} />
                    <span className="user-name">{user?.name}</span>
                </div>

                {/* Logout */}
                <button className="header-btn logout-btn" onClick={logout} title={t('auth.logout')}>
                    <LogOut size={20} />
                </button>
            </div>
        </header>
    );
}
