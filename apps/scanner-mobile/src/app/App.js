import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFonts, Cairo_400Regular, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../shared/i18n';
import api from '../shared/api/client';
import { clearAccessToken, getAccessToken, saveAccessToken } from '../modules/auth/sessionStorage';
import LoginScreen from '../modules/auth/LoginScreen';
import BrandedSplash from '../shared/components/BrandedSplash';
import { fontFamilyForLocale, tokens } from '../shared/theme/tokens';
import DashboardScreen from '../modules/scanner/DashboardScreen';
import ScanScreen from '../modules/scanner/ScanScreen';
import GuestsScreen from '../modules/scanner/GuestsScreen';
import ReportsScreen from '../modules/scanner/ReportsScreen';
import AddonsScreen from '../modules/scanner/AddonsScreen';
import AccountScreen from '../modules/scanner/AccountScreen';
import AboutScreen from '../modules/scanner/AboutScreen';
import { fetchScannerEvents, fetchScannerProfile } from '../modules/scanner/scannerApi';
import { appendRuntimeLog, appendRuntimeLogIfEnabled, isRuntimeDebugEnabled } from '../shared/debug/runtimeLogger';

function HomeScreen({ scannerUser, client, events, onLogout }) {
    const { i18n: i18nCtx } = useTranslation();
    const isArabic = i18nCtx.language === 'ar';
    const textStyle = useMemo(() => ({
        fontFamily: fontFamilyForLocale(isArabic)
    }), [isArabic]);

    const [activeTab, setActiveTab] = useState('dashboard');
    const [scanResult, setScanResult] = useState(null);
    const activeEvent = events[0] || null;

    const tabs = [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'scan', label: 'Scan' },
        { key: 'guests', label: 'Guests' },
        { key: 'reports', label: 'Reports' },
        { key: 'addons', label: 'Addons' },
        { key: 'account', label: 'Account' },
        { key: 'about', label: 'About' }
    ];

    function renderTabContent() {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <DashboardScreen
                        scannerUser={scannerUser}
                        client={client}
                        activeEvent={activeEvent}
                    />
                );
            case 'scan':
                return (
                    <ScanScreen
                        events={events}
                        activeEventId={activeEvent?.id || ''}
                        onScanResult={setScanResult}
                    />
                );
            case 'guests':
                return <GuestsScreen activeEventId={activeEvent?.id || ''} />;
            case 'reports':
                return <ReportsScreen activeEvent={activeEvent} />;
            case 'addons':
                return <AddonsScreen activeEvent={activeEvent} />;
            case 'account':
                return (
                    <AccountScreen
                        scannerUser={scannerUser}
                        client={client}
                        activeEvent={activeEvent}
                        onLogout={onLogout}
                    />
                );
            case 'about':
                return <AboutScreen />;
            default:
                return null;
        }
    }

    if (!events.length) {
        return (
            <SafeAreaView style={styles.safe}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.homeCard}>
                    <Text style={[styles.homeTitle, textStyle]}>No events available for this scanner user.</Text>
                    <Text style={[styles.homeHint, textStyle]}>Please contact admin to assign an event.</Text>
                    <Text style={[styles.logout, textStyle]} onPress={onLogout}>Logout</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeFill}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>
                <View style={styles.topHeader}>
                    <View style={styles.topHeaderTextWrap}>
                        <Text style={[styles.topHeaderTitle, textStyle]}>Welcome, {scannerUser?.name}</Text>
                        <Text style={[styles.topHeaderSubtitle, textStyle]}>
                            {isArabic ? (activeEvent?.name_ar || activeEvent?.name) : (activeEvent?.name || activeEvent?.name_ar)}
                        </Text>
                    </View>
                    <Pressable style={styles.topHeaderLogoutBtn} onPress={onLogout}>
                        <Text style={[styles.topHeaderLogoutText, textStyle]}>Logout</Text>
                    </Pressable>
                </View>

                <View style={styles.content}>
                    {renderTabContent()}
                </View>
                <View style={styles.tabBar}>
                    {tabs.map((tab) => (
                        <Pressable
                            key={tab.key}
                            style={[styles.tabItem, activeTab === tab.key && styles.activeTabItem]}
                            onPress={() => setActiveTab(tab.key)}
                        >
                            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText, textStyle]}>
                                {tab.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>
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
                const list = await fetchScannerEvents();
                setSession({
                    accessToken,
                    scannerUser: profile.scannerUser,
                    client: profile.client
                });
                setEvents(Array.isArray(list) ? list : []);
            } catch (error) {
                await appendRuntimeLog(`bootstrap:error ${error?.message || 'unknown'}`);
                try {
                    await clearAccessToken();
                } catch {
                    // Ignore secure-store clear errors in bootstrap recovery.
                }
                delete api.defaults.headers.common.Authorization;
                setSession(null);
                setEvents([]);
            } finally {
                setLoadingSession(false);
            }
        }

        bootstrap();
    }, []);

    async function handleLoggedIn(payload) {
        await appendRuntimeLog('auth:handleLoggedIn:start');
        await saveAccessToken(payload.accessToken);
        api.defaults.headers.common.Authorization = `Bearer ${payload.accessToken}`;

        const profile = await fetchScannerProfile();
        const list = await fetchScannerEvents();

        setSession({
            accessToken: payload.accessToken,
            scannerUser: profile.scannerUser,
            client: profile.client
        });
        setEvents(Array.isArray(list) ? list : []);
        await appendRuntimeLog(`auth:handleLoggedIn:success events=${Array.isArray(list) ? list.length : 0}`);
    }

    async function handleLogout() {
        await appendRuntimeLogIfEnabled('auth:logout:start');
        await clearAccessToken();
        delete api.defaults.headers.common.Authorization;
        setSession(null);
        setEvents([]);
        await appendRuntimeLogIfEnabled('auth:logout:done');
    }

    if (loadingSession) return <BrandedSplash />;
    if (!session) return <LoginScreen onLoggedIn={handleLoggedIn} />;

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

    useEffect(() => {
        appendRuntimeLog(`app:init debug=${String(isRuntimeDebugEnabled())}`);
    }, []);

    useEffect(() => {
        appendRuntimeLogIfEnabled(`app:fontsLoaded=${String(fontsLoaded)}`);
    }, [fontsLoaded]);

    if (!fontsLoaded) return <BrandedSplash />;

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
        fontSize: 20,
        fontWeight: '700',
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
    },
    container: {
        flex: 1
    },
    topHeader: {
        paddingHorizontal: tokens.spacing.md,
        paddingTop: tokens.spacing.sm,
        paddingBottom: tokens.spacing.sm,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: tokens.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.spacing.sm
    },
    topHeaderTextWrap: {
        flex: 1
    },
    topHeaderTitle: {
        color: tokens.colors.textPrimary,
        fontSize: tokens.fontSize.md,
        fontWeight: '700'
    },
    topHeaderSubtitle: {
        marginTop: 2,
        color: tokens.colors.textSecondary,
        fontSize: tokens.fontSize.sm
    },
    topHeaderLogoutBtn: {
        backgroundColor: tokens.colors.danger,
        borderRadius: tokens.borderRadius.md,
        paddingHorizontal: 12,
        paddingVertical: 8
    },
    topHeaderLogoutText: {
        color: '#FFFFFF',
        fontSize: tokens.fontSize.sm,
        fontWeight: '700'
    },
    content: {
        flex: 1
    },
    tabBar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: tokens.colors.surface,
        borderTopWidth: 1,
        borderTopColor: tokens.colors.border
    },
    tabItem: {
        width: '33.33%',
        paddingVertical: tokens.spacing.sm,
        alignItems: 'center'
    },
    activeTabItem: {
        backgroundColor: '#EEF5FB'
    },
    tabText: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    },
    activeTabText: {
        color: tokens.colors.primary,
        fontWeight: '700'
    }
});
