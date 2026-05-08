import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { enableRecipientAddon, fetchEventAddons, fetchRecipientAddons } from './scannerApi';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function localizedText(isArabic, en, ar) {
    return isArabic ? (ar || en || '') : (en || ar || '');
}

function addonTypeLabel(type) {
    if (type === 'questionnaire') return 'Questionnaire';
    if (type === 'poll') return 'Poll';
    if (type === 'instructions') return 'Instructions';
    return 'Addon';
}

export default function AddonsScreen({ activeEvent, scanResult }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    const [eventPayload, setEventPayload] = useState({ addons: [] });
    const [recipientPayload, setRecipientPayload] = useState({ addons: [] });
    const [loadingEventAddons, setLoadingEventAddons] = useState(false);
    const [loadingRecipientAddons, setLoadingRecipientAddons] = useState(false);
    const [enablingPageKey, setEnablingPageKey] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    const scannedRecipient = scanResult?.attendee?.id
        ? {
            id: scanResult.attendee.id,
            name: localizedText(isArabic, scanResult.attendee?.name, scanResult.attendee?.name_ar)
        }
        : null;

    useEffect(() => {
        let cancelled = false;
        async function loadEventAddons() {
            if (!activeEvent?.id) {
                setEventPayload({ addons: [] });
                return;
            }

            setLoadingEventAddons(true);
            try {
                const payload = await fetchEventAddons(activeEvent.id);
                if (!cancelled) {
                    setEventPayload(payload || { addons: [] });
                }
            } catch {
                if (!cancelled) {
                    setEventPayload({ addons: [] });
                }
            } finally {
                if (!cancelled) {
                    setLoadingEventAddons(false);
                }
            }
        }

        loadEventAddons();
        return () => {
            cancelled = true;
        };
    }, [activeEvent?.id]);

    useEffect(() => {
        let cancelled = false;
        async function loadRecipientAddons() {
            if (!scannedRecipient?.id) {
                setRecipientPayload({ addons: [] });
                return;
            }

            setLoadingRecipientAddons(true);
            try {
                const payload = await fetchRecipientAddons(scannedRecipient.id);
                if (!cancelled) {
                    setRecipientPayload(payload || { addons: [] });
                }
            } catch {
                if (!cancelled) {
                    setRecipientPayload({ addons: [] });
                }
            } finally {
                if (!cancelled) {
                    setLoadingRecipientAddons(false);
                }
            }
        }

        loadRecipientAddons();
        return () => {
            cancelled = true;
        };
    }, [scannedRecipient?.id]);

    async function handleEnableAddon(pageKey) {
        if (!scannedRecipient?.id || !pageKey || enablingPageKey) {
            return;
        }

        setEnablingPageKey(pageKey);
        setStatusMessage('');
        try {
            await enableRecipientAddon({ recipientId: scannedRecipient.id, pageKey });
            const payload = await fetchRecipientAddons(scannedRecipient.id);
            setRecipientPayload(payload || { addons: [] });
            setStatusMessage('Addon is now enabled for this guest.');
        } catch (error) {
            setStatusMessage(error?.response?.data?.message || 'Could not enable addon. Please try again.');
        } finally {
            setEnablingPageKey('');
        }
    }

    const eventName = activeEvent
        ? localizedText(isArabic, activeEvent.name, activeEvent.name_ar)
        : 'No event selected';

    const eventAddons = Array.isArray(eventPayload?.addons) ? eventPayload.addons : [];
    const recipientAddons = Array.isArray(recipientPayload?.addons) ? recipientPayload.addons : [];

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
            <View style={styles.hero}>
                <Text style={[styles.heroTitle, textStyle]}>Add-ons Control Center</Text>
                <Text style={[styles.heroSubtitle, textStyle]}>Detect event add-ons and enable them instantly for scanned guests.</Text>
            </View>

            <View style={styles.card}>
                <Text style={[styles.cardTitle, textStyle]}>Event</Text>
                <Text style={[styles.cardValue, textStyle]}>{eventName}</Text>
            </View>

            <View style={styles.card}>
                <Text style={[styles.cardTitle, textStyle]}>Event Add-ons</Text>
                {loadingEventAddons ? <ActivityIndicator color={tokens.colors.accent} /> : null}
                {!loadingEventAddons && !eventAddons.length ? (
                    <Text style={[styles.muted, textStyle]}>No poll/questionnaire add-ons configured for this event.</Text>
                ) : null}
                {eventAddons.map((addon) => (
                    <View key={`${addon.type}-${addon.addonId}`} style={styles.addonChip}>
                        <Text style={[styles.addonChipTitle, textStyle]}>
                            {addon.title || addonTypeLabel(addon.type)}
                        </Text>
                        <Text style={[styles.addonChipMeta, textStyle]}>
                            {addonTypeLabel(addon.type)} · {addon.activationRules?.liveWhenScannerEnabled ? 'Manual Enable Supported' : 'Auto Rules Only'}
                        </Text>
                    </View>
                ))}
            </View>

            <View style={styles.card}>
                <Text style={[styles.cardTitle, textStyle]}>Guest Add-ons</Text>
                {scannedRecipient ? (
                    <Text style={[styles.cardValue, textStyle]}>{scannedRecipient.name || scannedRecipient.id}</Text>
                ) : (
                    <Text style={[styles.muted, textStyle]}>Scan a guest in the Scan tab first, then return here.</Text>
                )}

                {loadingRecipientAddons ? <ActivityIndicator color={tokens.colors.accent} style={styles.loaderGap} /> : null}

                {!loadingRecipientAddons && scannedRecipient && !recipientAddons.length ? (
                    <Text style={[styles.muted, textStyle]}>No addon pages were found for this guest invitation project.</Text>
                ) : null}

                {recipientAddons.map((addon) => {
                    const supportsManualEnable = Boolean(addon?.activationRules?.liveWhenScannerEnabled);
                    const busy = enablingPageKey === addon.pageKey;
                    return (
                        <View key={addon.pageKey} style={styles.actionCard}>
                            <View style={styles.actionHeader}>
                                <Text style={[styles.actionTitle, textStyle]}>
                                    {localizedText(isArabic, addon.title, addon.titleAr) || addonTypeLabel(addon.pageType)}
                                </Text>
                                <Text style={[styles.actionType, textStyle]}>{addonTypeLabel(addon.pageType)}</Text>
                            </View>
                            <Text style={[styles.actionMeta, textStyle]}>
                                {supportsManualEnable ? 'This addon can be started manually by scanner user.' : 'Manual enable is not active for this addon rules.'}
                            </Text>
                            <Pressable
                                style={[styles.enableBtn, (!supportsManualEnable || busy) && styles.enableBtnDisabled]}
                                disabled={!supportsManualEnable || busy}
                                onPress={() => handleEnableAddon(addon.pageKey)}
                            >
                                <Text style={[styles.enableBtnText, textStyle]}>{busy ? 'Starting...' : 'Start Add-on'}</Text>
                            </Pressable>
                        </View>
                    );
                })}

                {statusMessage ? <Text style={[styles.statusMessage, textStyle]}>{statusMessage}</Text> : null}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: '#F4F8FC'
    },
    container: {
        padding: tokens.spacing.md,
        gap: tokens.spacing.md,
        paddingBottom: tokens.spacing.lg
    },
    hero: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DCE7F3',
        borderRadius: 16,
        padding: tokens.spacing.md
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#10243E'
    },
    heroSubtitle: {
        marginTop: 6,
        fontSize: 13,
        color: '#4D647F'
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DCE7F3',
        borderRadius: 16,
        padding: tokens.spacing.md,
        gap: 10
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#10243E'
    },
    cardValue: {
        fontSize: 14,
        color: '#1D3557'
    },
    muted: {
        fontSize: 13,
        color: '#6C7F98'
    },
    addonChip: {
        borderWidth: 1,
        borderColor: '#E1EAF5',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#FAFCFF'
    },
    addonChipTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#173356'
    },
    addonChipMeta: {
        marginTop: 2,
        fontSize: 12,
        color: '#5E7691'
    },
    loaderGap: {
        marginVertical: 8
    },
    actionCard: {
        borderWidth: 1,
        borderColor: '#D9E6F2',
        borderRadius: 12,
        padding: 12,
        gap: 8,
        backgroundColor: '#FDFEFF'
    },
    actionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8
    },
    actionTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#173356'
    },
    actionType: {
        fontSize: 12,
        color: '#5E7691'
    },
    actionMeta: {
        fontSize: 12,
        color: '#5E7691'
    },
    enableBtn: {
        height: 42,
        borderRadius: 10,
        backgroundColor: '#0A7EA4',
        justifyContent: 'center',
        alignItems: 'center'
    },
    enableBtnDisabled: {
        backgroundColor: '#9CB7C7'
    },
    enableBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700'
    },
    statusMessage: {
        marginTop: 6,
        fontSize: 13,
        color: '#0D6B4D'
    }
});
