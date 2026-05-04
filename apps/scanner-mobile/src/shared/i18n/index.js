import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    en: {
        translation: {
            appTitle: 'YaHala Scanner',
            subtitle: 'Fast event check-in with secure access',
            clientIdentifier: 'Client Email or ID',
            scannerName: 'Scanner Name',
            pin: 'PIN',
            login: 'Sign In',
            loggingIn: 'Signing in...',
            language: 'Language',
            invalidCredentials: 'Invalid credentials. Please check and try again.'
        }
    },
    ar: {
        translation: {
            appTitle: 'يا هلا سكانر',
            subtitle: 'تسجيل دخول سريع وآمن للفعاليات',
            clientIdentifier: 'معرّف العميل أو البريد الإلكتروني',
            scannerName: 'اسم جهاز المسح',
            pin: 'الرقم السري',
            login: 'تسجيل الدخول',
            loggingIn: 'جاري تسجيل الدخول...',
            language: 'اللغة',
            invalidCredentials: 'بيانات الدخول غير صحيحة، حاول مرة أخرى.'
        }
    }
};

i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
        escapeValue: false
    }
});

export default i18n;
