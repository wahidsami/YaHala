import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
    const [confirmingScan, setConfirmingScan] = useState(false);
    const [result, setResult] = useState(null);
    const [recentScans, setRecentScans] = useState([]);
    const [pendingScan, setPendingScan] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

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
            const next = await submitScan({ token: cleanToken, eventId: activeEvent.id, mode, confirmCheckIn: false });
            setPendingScan({
                ...next,
                token: cleanToken,
                eventId: activeEvent.id,
                mode
            });
            setModalVisible(true);
            if (next.status === 'duplicate') {
                setResult(next);
                setRecentScans((prev) => [{
                    token: cleanToken,
                    label: localizedName(i18n.language, next.attendee?.name, next.attendee?.name_ar),
                    status: next.status
                }, ...prev].slice(0, 6));
            }
            setManualToken('');
            onScanResult(next);
        } catch (error) {
            Alert.alert('Scan failed', error.response?.data?.message || 'Scan failed');
            setResult({
                status: 'failed',
                attendee: { name: 'Unknown guest', attendance_status: 'not_attended' },
                event: { name: error.response?.data?.message || 'Scan failed' }
            });
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

    async function handleConfirmScan() {
        if (!pendingScan?.token || !pendingScan?.eventId) {
            return;
        }
        setConfirmingScan(true);
        try {
            const next = await submitScan({
                token: pendingScan.token,
                eventId: pendingScan.eventId,
                mode: pendingScan.mode || 'camera',
                confirmCheckIn: true
            });
            setResult(next);
            setRecentScans((prev) => [{
                token: pendingScan.token,
                label: localizedName(i18n.language, next.attendee?.name, next.attendee?.name_ar),
                status: next.status
            }, ...prev].slice(0, 6));
            setModalVisible(false);
            setPendingScan(null);
            onScanResult(next);
        } catch (error) {
            Alert.alert('Check-in failed', error.response?.data?.message || 'Check-in failed');
            setResult({
                status: 'failed',
                attendee: { name: 'Unknown guest', attendance_status: 'not_attended' },
                event: { name: error.response?.data?.message || 'Check-in failed' }
            });
            setModalVisible(false);
            setPendingScan(null);
        } finally {
            setConfirmingScan(false);
        }
    }

    function handleCloseModal() {
        setModalVisible(false);
        setPendingScan(null);
    }

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
            <View style={styles.contextCard}>
                <Text style={[styles.contextLabel, textStyle]}>Active Event</Text>
                <Text style={[styles.contextValue, textStyle]}>
                    {activeEvent ? localizedName(i18n.language, activeEvent.name, activeEvent.name_ar) : 'No event selected'}
                </Text>
            </View>

            <CameraScanCard enabled={Boolean(activeEvent?.id)} onScanned={handleCameraScan} busy={submittingScan || confirmingScan || modalVisible} />

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
                    {result.attendee?.questionnaire ? (
                        <Text style={[styles.recentText, textStyle]}>
                            Questionnaire: {result.attendee.questionnaire.submittedQuestionnaires || 0}/{result.attendee.questionnaire.totalQuestionnaires || 0}
                        </Text>
                    ) : null}
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

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={handleCloseModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={[styles.modalTitle, textStyle]}>
                            {pendingScan?.status === 'duplicate' ? 'QR already scanned' : 'Guest found'}
                        </Text>
                        <Text style={[styles.modalName, textStyle]}>
                            {localizedName(i18n.language, pendingScan?.attendee?.name, pendingScan?.attendee?.name_ar)}
                        </Text>
                        <Text style={[styles.modalEvent, textStyle]}>
                            {localizedName(i18n.language, pendingScan?.event?.name, pendingScan?.event?.name_ar)}
                        </Text>
                        {pendingScan?.status === 'duplicate' ? (
                            <Text style={[styles.modalCopy, textStyle]}>
                                Already checked in at {pendingScan?.attendee?.attended_at ? new Date(pendingScan.attendee.attended_at).toLocaleString() : 'unknown time'}.
                            </Text>
                        ) : (
                            <Text style={[styles.modalCopy, textStyle]}>Review guest details, then click Check In.</Text>
                        )}

                        <View style={styles.modalActions}>
                            {pendingScan?.status === 'duplicate' ? (
                                <Pressable style={styles.button} onPress={handleCloseModal}>
                                    <Text style={styles.buttonText}>OK</Text>
                                </Pressable>
                            ) : (
                                <>
                                    <Pressable style={styles.secondaryButton} onPress={handleCloseModal} disabled={confirmingScan}>
                                        <Text style={[styles.secondaryButtonText, textStyle]}>Cancel</Text>
                                    </Pressable>
                                    <Pressable style={styles.button} onPress={handleConfirmScan} disabled={confirmingScan}>
                                        <Text style={styles.buttonText}>{confirmingScan ? 'Checking in...' : 'Check In'}</Text>
                                    </Pressable>
                                </>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(8, 17, 31, 0.45)',
        justifyContent: 'center',
        padding: tokens.spacing.lg
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: tokens.borderRadius.lg,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        padding: tokens.spacing.lg
    },
    modalTitle: {
        fontSize: tokens.fontSize.lg,
        fontWeight: '700',
        color: tokens.colors.textPrimary
    },
    modalName: {
        marginTop: tokens.spacing.sm,
        fontSize: tokens.fontSize.md,
        fontWeight: '700',
        color: tokens.colors.textPrimary
    },
    modalEvent: {
        marginTop: 4,
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    },
    modalCopy: {
        marginTop: tokens.spacing.md,
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    },
    modalActions: {
        marginTop: tokens.spacing.lg,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: tokens.spacing.sm
    },
    secondaryButton: {
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.borderRadius.md,
        paddingVertical: tokens.spacing.md,
        paddingHorizontal: tokens.spacing.lg
    },
    secondaryButtonText: {
        color: tokens.colors.textPrimary,
        fontSize: tokens.fontSize.md,
        fontWeight: '700'
    }
});
