import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const { i18n } = useTranslation();
    const [language, setLanguageState] = useState(i18n.language || 'ar');

    useEffect(() => {
        // Apply direction on language change
        const dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.dir = dir;
        document.documentElement.lang = language;
        localStorage.setItem('language', language);
    }, [language]);

    const setLanguage = useCallback((lang) => {
        i18n.changeLanguage(lang);
        setLanguageState(lang);
    }, [i18n]);

    const toggleLanguage = useCallback(() => {
        setLanguage(language === 'ar' ? 'en' : 'ar');
    }, [language, setLanguage]);

    const value = useMemo(() => ({
        language,
        direction: language === 'ar' ? 'rtl' : 'ltr',
        isRTL: language === 'ar',
        setLanguage,
        toggleLanguage
    }), [language, setLanguage, toggleLanguage]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
}
