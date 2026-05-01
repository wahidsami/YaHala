import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe } from 'lucide-react';
import loginLogo from '../../../../LogoColor.svg';
import './LoginPage.css';

export default function LoginPage() {
    const { t } = useTranslation();
    const { login, error, isLoading } = useAuth();
    const { language, toggleLanguage } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const from = location.state?.from?.pathname || '/dashboard';

    async function handleSubmit(e) {
        e.preventDefault();
        setIsSubmitting(true);

        const result = await login(email, password);

        if (result.success) {
            navigate(from, { replace: true });
        }

        setIsSubmitting(false);
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <img src={loginLogo} alt={t('app.name')} className="login-logo-img" />
                    <p className="login-subtitle">{t('app.name')}</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && (
                        <div className="login-error">
                            {t('auth.invalidCredentials')}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">{t('auth.email')}</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@yahala.com"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">{t('auth.password')}</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? t('common.loading') : t('auth.loginButton')}
                    </button>
                </form>

                <button className="language-toggle" onClick={toggleLanguage}>
                    <Globe size={18} />
                    <span>{language === 'ar' ? 'English' : 'العربية'}</span>
                </button>
            </div>
        </div>
    );
}
