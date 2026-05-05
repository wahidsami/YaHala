import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFonts, Cairo_400Regular, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../shared/i18n';
import api from '../shared/api/client';
import { clearAccessToken, getAccessToken, saveAccessToken } from '../modules/auth/sessionStorage';
import LoginScreen from '../modules/auth/LoginScreen';
import BrandedSplash from '../shared/components/BrandedSplash';
import { fontFamilyForLocale, tokens } from '../shared/theme/tokens';
import ScannerHomeScreen from '../modules/scanner/ScannerHomeScreen';
import { fetchScannerEvents, fetchScannerProfile } from '../modules/scanner/scannerApi';
import { appendRuntimeLog } from '../shared/debug/runtimeLogger';

function HomeScreen({ scannerUser, client, events, onLogout }) {
    const { t, i18n: i18nCtx } = useTranslation();
    const isArabic = i18nCtx.language === 'ar';
    const textStyle = useMemo(() => ({
        fontFamily: fontFamilyForLocale(isArabic)
    }), [isArabic]);

    if (!events.length) {
        return (
            <SafeAreaView style={styles.safe}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.homeCard}>
                    <Text style={[styles.homeTitle, textStyle]}>{t('appTitle')}</Text>
                    <Text style={[styles.homeSubtitle, textStyle]}>{scannerUser?.name}</Text>
                    <Text style={[styles.homeHint, textStyle]}>No events assigned yet.</Text>
                    <Text style={[styles.logout, textStyle]} onPress={onLogout}>Logout</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeFill}>
            <StatusBar barStyle="dark-content" />
            <ScannerHomeScreen
                scannerUser={scannerUser}
                client={client}
                events={events}
                onLogout={onLogout}
            />
        </SafeAreaView>
    );
}

function AppRoot() {
    const [loadingSession, setLoadingSession] = useState(true);
    const [session, setSession] = useState(null);
    const [events, setEvents] = useState([]);

    useEffect(() => {
        async function bootstrap() {
            try {
                await appendRuntimeLog('bootstrap:start');
                const accessToken = await getAccessToken();
                if (!accessToken) {
                    await appendRuntimeLog('bootstrap:no_access_token');
                    setSession(null);
                    setEvents([]);
                    return;
                }

                await appendRuntimeLog('bootstrap:token_found');
                api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
                const profile = await fetchScannerProfile();
                await appendRuntimeLog('bootstrap:profile_loaded');
                const list = await fetchScannerEvents();
                await appendRuntimeLog(`bootstrap:events_loaded count=${Array.isArray(list) ? list.length : 0}`);
                setSession({
                    accessToken,
                    scannerUser: profile.scannerUser,
                    client: profile.client
                });
                setEvents(list);
            } catch (error) {
                await appendRuntimeLog(`bootstrap:error ${error?.message || 'unknown'}`);
                try {
                    await clearAccessToken();
                } catch {
                    // Keep bootstrapping even when secure storage cleanup fails.
                }
                delete api.defaults.headers.common.Authorization;
                setSession(null);
                setEvents([]);
            } finally {
                await appendRuntimeLog('bootstrap:done');
                setLoadingSession(false);
            }
        }

        bootstrap();
    }, []);

    async function handleLoggedIn(payload) {
        await saveAccessToken(payload.accessToken);
        api.defaults.headers.common.Authorization = `Bearer ${payload.accessToken}`;

        const profile = await fetchScannerProfile();
        const list = await fetchScannerEvents();

        setSession({
            accessToken: payload.accessToken,
            scannerUser: profile.scannerUser,
            client: profile.client
        });
        setEvents(list);
    }

    async function handleLogout() {
        await clearAccessToken();
        delete api.defaults.headers.common.Authorization;
        setSession(null);
        setEvents([]);
    }

    if (loadingSession) {
        return <BrandedSplash />;
    }

    if (!session) {
        return <LoginScreen onLoggedIn={handleLoggedIn} />;
    }

    return (
        <HomeScreen
            scannerUser={session.scannerUser}
            client={session.client}
            events={events}
            onLogout={handleLogout}
        />
    );
}

export default function App() {
    const [fontsLoaded] = useFonts({
        Cairo_400Regular,
        Cairo_700Bold
    });

    if (!fontsLoaded) {
        return <BrandedSplash />;
    }

    return (
        <I18nextProvider i18n={i18n}>
            <AppRoot />
        </I18nextProvider>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: tokens.colors.background,
        padding: tokens.spacing.lg
    },
    safeFill: {
        flex: 1,
        backgroundColor: tokens.colors.background
    },
    homeCard: {
        marginTop: 40,
        backgroundColor: tokens.colors.surface,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.lg,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        gap: 10
    },
    homeTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: tokens.colors.textPrimary
    },
    homeSubtitle: {
        fontSize: 18,
        color: tokens.colors.textPrimary
    },
    homeHint: {
        marginTop: 10,
        fontSize: 13,
        color: tokens.colors.textSecondary
    },
    logout: {
        marginTop: 18,
        color: tokens.colors.accent,
        fontWeight: '700'
    }
});
