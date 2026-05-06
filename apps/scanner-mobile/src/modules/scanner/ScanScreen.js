import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { submitScan } from './scannerApi';
import CameraScanCard from './CameraScanCard';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function localizedName(language, en, ar) {
    return language === 'ar' ? (ar || en || '') : (en || ar || '');
}

export default function ScanScreen({ events, activeEventId, onScanResult }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    const [manualToken, setManualToken] = useState('');
    const [submittingScan, setSubmittingScan] = useState(false);
    const [result, setResult] = useState(null);
    const [recentScans, setRecentScans] = useState([]);

    const activeEvent = useMemo(() => {
        return events.find((event) => event.id === activeEventId) || null;
    }, [events, activeEventId]);

    async function doScan(token, mode) {
        const cleanToken = token.trim();
        if (!cleanToken || !activeEvent?.id || submittingScan) {
            return;
        }

        setSubmittingScan(true);
        try {
            const next = await submitScan({ token: cleanToken, eventId: activeEvent.id, mode });
            setResult(next);
            setRecentScans((prev) => [{
                token: cleanToken,
                label: localizedName(i18n.language, next.attendee?.name, next.attendee?.name_ar),
                status: next.status
            }, ...prev].slice(0, 6));
            setManualToken('');
            onScanResult(next);
        } catch (error) {
            setResult({
                status: 'failed',
                attendee: { name: 'Unknown guest', attendance_status: 'not_attended' },
                event: { name: error.response?.data?.message || 'Scan failed' }
            });
            throw error;
        } finally {
            setSubmittingScan(false);
        }
    }

    async function handleManualScan() {
        await doScan(manualToken, 'manual');
    }

    async function handleCameraScan(token) {
        await doScan(token, 'camera');
    }

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
            <View style={styles.contextCard}>
                <Text style={[styles.contextLabel, textStyle]}>Active Event</Text>
                <Text style={[styles.contextValue, textStyle]}>
                    {activeEvent ? localizedName(i18n.language, activeEvent.name, activeEvent.name_ar) : 'No event selected'}
                </Text>
            </View>

            <CameraScanCard enabled={Boolean(activeEvent?.id)} onScanned={handleCameraScan} busy={submittingScan} />

            <View style={styles.manualScan}>
                <Text style={[styles.sectionTitle, textStyle]}>Manual Scan</Text>
                <TextInput
                    style={[styles.input, textStyle]}
                    placeholder="Enter token"
                    value={manualToken}
                    onChangeText={setManualToken}
                    editable={!submittingScan}
                />
                <Pressable style={styles.button} onPress={handleManualScan} disabled={submittingScan}>
                    <Text style={styles.buttonText}>Scan</Text>
                </Pressable>
            </View>

            {result && (
                <View style={styles.result}>
                    <Text style={[styles.resultText, textStyle]}>
                        {result.status === 'attended' || result.status === 'duplicate' ? 'Success' : 'Failed'}: {localizedName(i18n.language, result.attendee?.name, result.attendee?.name_ar)}
                    </Text>
                </View>
            )}

            {recentScans.length > 0 && (
                <View style={styles.recent}>
                    <Text style={[styles.sectionTitle, textStyle]}>Recent Scans</Text>
                    {recentScans.map((scan, index) => (
                        <Text key={index} style={[styles.recentText, textStyle]}>
                            {scan.label} - {scan.status}
                        </Text>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: tokens.colors.background,
    },
    container: {
        padding: tokens.spacing.md,
    },
    manualScan: {
        marginVertical: tokens.spacing.lg,
    },
    contextCard: {
        marginBottom: tokens.spacing.md,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.borderRadius.md,
        backgroundColor: '#FFFFFF',
        padding: tokens.spacing.md
    },
    contextLabel: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    },
    contextValue: {
        marginTop: 4,
        fontSize: tokens.fontSize.lg,
        color: tokens.colors.textPrimary,
        fontWeight: '700'
    },
    sectionTitle: {
        fontSize: tokens.fontSize.lg,
        fontWeight: 'bold',
        color: tokens.colors.textPrimary,
        marginBottom: tokens.spacing.md,
    },
    input: {
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.borderRadius.md,
        padding: tokens.spacing.md,
        fontSize: tokens.fontSize.md,
        marginBottom: tokens.spacing.md,
    },
    button: {
        backgroundColor: tokens.colors.primary,
        padding: tokens.spacing.md,
        borderRadius: tokens.borderRadius.md,
        alignItems: 'center',
    },
    buttonText: {
        color: tokens.colors.onPrimary,
        fontSize: tokens.fontSize.md,
        fontWeight: 'bold',
    },
    result: {
        marginVertical: tokens.spacing.md,
        padding: tokens.spacing.md,
        backgroundColor: tokens.colors.surface,
        borderRadius: tokens.borderRadius.md,
    },
    resultText: {
        fontSize: tokens.fontSize.md,
        color: tokens.colors.textPrimary,
    },
    recent: {
        marginVertical: tokens.spacing.lg,
    },
    recentText: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary,
        marginBottom: tokens.spacing.sm,
    },
});
