import { useMemo, useState } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { loginScanner } from './authApi';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';
import { appendRuntimeLogIfEnabled } from '../../shared/debug/runtimeLogger';

export default function LoginScreen({ onLoggedIn }) {
    const { t, i18n } = useTranslation();
    const [clientIdentifier, setClientIdentifier] = useState('');
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [pendingEvents, setPendingEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({
        fontFamily: fontFamilyForLocale(isArabic),
        writingDirection: isArabic ? 'rtl' : 'ltr'
    }), [isArabic]);

    async function onSubmit() {
        if (!clientIdentifier.trim() || !name.trim() || !pin.trim()) {
            setError(t('invalidCredentials'));
            return;
        }
        if (pendingEvents.length > 0 && !selectedEventId) {
            setError('Please select an event to continue.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await loginScanner({
                clientIdentifier,
                name,
                pin,
                eventId: selectedEventId || undefined
            });
            if (result.requiresEventSelection) {
                setPendingEvents(Array.isArray(result.events) ? result.events : []);
                if (Array.isArray(result.events) && result.events.length === 1) {
                    setSelectedEventId(result.events[0].id);
                }
                await appendRuntimeLogIfEnabled(`auth:loginScreen:event_selection_loaded count=${Array.isArray(result.events) ? result.events.length : 0}`);
                setLoading(false);
                return;
            }
            await appendRuntimeLogIfEnabled('auth:loginScreen:onSubmit:success');
            onLoggedIn(result);
        } catch (requestError) {
            await appendRuntimeLogIfEnabled(`auth:loginScreen:onSubmit:error ${requestError?.message || 'unknown'}`);
            setError(requestError.response?.data?.message || t('invalidCredentials'));
        } finally {
            setLoading(false);
        }
    }

    function switchLanguage() {
        const next = isArabic ? 'en' : 'ar';
        I18nManager.allowRTL(next === 'ar');
        i18n.changeLanguage(next);
    }

    return (
        <View style={styles.screen}>
            <View style={styles.card}>
                <Text style={[styles.title, textStyle]}>{t('appTitle')}</Text>
                <Text style={[styles.subtitle, textStyle]}>{t('subtitle')}</Text>
                <Text style={[styles.hint, textStyle]}>{t('loginFieldHelp')}</Text>

                <Text style={[styles.fieldLabel, textStyle]}>{t('clientIdentifier')}</Text>
                <TextInput
                    style={[styles.input, textStyle]}
                    value={clientIdentifier}
                    onChangeText={setClientIdentifier}
                    placeholder="Enter client email or ID"
                    autoCapitalize="none"
                />

                <Text style={[styles.fieldLabel, textStyle]}>{t('scannerName')}</Text>
                <TextInput
                    style={[styles.input, textStyle]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter scanner name"
                    autoCapitalize="none"
                />

                <Text style={[styles.fieldLabel, textStyle]}>{t('pin')}</Text>
                <TextInput
                    style={[styles.input, textStyle]}
                    value={pin}
                    onChangeText={setPin}
                    placeholder="Enter PIN"
                    secureTextEntry
                />

                {pendingEvents.length > 0 ? (
                    <View style={styles.eventPickerWrap}>
                        <Text style={[styles.fieldLabel, textStyle]}>Select Event</Text>
                        <View style={styles.eventChips}>
                            {pendingEvents.map((event) => (
                                <Pressable
                                    key={event.id}
                                    style={[styles.eventChip, selectedEventId === event.id && styles.eventChipActive]}
                                    onPress={() => setSelectedEventId(event.id)}
                                >
                                    <Text style={[styles.eventChipText, textStyle, selectedEventId === event.id && styles.eventChipTextActive]}>
                                        {isArabic ? (event.name_ar || event.name) : (event.name || event.name_ar)}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                ) : null}

                {error ? <Text style={[styles.error, textStyle]}>{error}</Text> : null}

                <Pressable style={[styles.button, loading && styles.buttonDisabled]} disabled={loading} onPress={onSubmit}>
                    <Text style={[styles.buttonText, textStyle]}>{loading ? t('loggingIn') : t('login')}</Text>
                </Pressable>

                <Pressable style={styles.langBtn} onPress={switchLanguage}>
                    <Text style={[styles.langText, textStyle]}>{t('language')}: {isArabic ? 'English' : 'العربية'}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: tokens.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 22
    },
    card: {
        width: '100%',
        backgroundColor: tokens.colors.surface,
        borderRadius: tokens.radius.lg,
        padding: 22,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        gap: 12,
        shadowColor: '#0E1C2D',
        shadowOpacity: 0.08,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 8
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: tokens.colors.textPrimary
    },
    subtitle: {
        fontSize: 14,
        color: tokens.colors.textSecondary,
        marginBottom: 8
    },
    fieldLabel: {
        fontSize: 13,
        color: tokens.colors.textSecondary
    },
    hint: {
        fontSize: 12,
        color: tokens.colors.textSecondary,
        marginBottom: 6
    },
    input: {
        height: 52,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.md,
        paddingHorizontal: 14,
        fontSize: 16,
        color: tokens.colors.textPrimary,
        backgroundColor: '#FFFFFF'
    },
    button: {
        marginTop: 6,
        height: 52,
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.colors.accent,
        alignItems: 'center',
        justifyContent: 'center'
    },
    buttonDisabled: {
        opacity: 0.7
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600'
    },
    langBtn: {
        marginTop: 6,
        alignItems: 'center'
    },
    langText: {
        color: tokens.colors.textSecondary,
        fontSize: 14
    },
    error: {
        color: tokens.colors.danger,
        fontSize: 13
    },
    eventPickerWrap: {
        gap: 8
    },
    eventChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    eventChip: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.md,
        paddingHorizontal: 12,
        paddingVertical: 10
    },
    eventChipActive: {
        backgroundColor: tokens.colors.primary,
        borderColor: tokens.colors.primary
    },
    eventChipText: {
        fontSize: 13,
        color: tokens.colors.textPrimary
    },
    eventChipTextActive: {
        color: '#FFFFFF'
    }
});
