import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchEventStats, submitScan } from './scannerApi';
import EventStatsCard from '../stats/EventStatsCard';
import CameraScanCard from './CameraScanCard';
import VisitorIntakeCard from './VisitorIntakeCard';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function localizedName(language, en, ar) {
    return language === 'ar' ? (ar || en || '') : (en || ar || '');
}

export default function ScannerHomeScreen({ scannerUser, client, events, onLogout }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    const [activeEventId, setActiveEventId] = useState('');
    const [manualToken, setManualToken] = useState('');
    const [submittingScan, setSubmittingScan] = useState(false);
    const [result, setResult] = useState(null);
    const [recentScans, setRecentScans] = useState([]);
    const [statsPayload, setStatsPayload] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const activeEvent = useMemo(() => {
        return events.find((event) => event.id === activeEventId) || events[0] || null;
    }, [events, activeEventId]);

    useEffect(() => {
        if (!activeEventId && events[0]?.id) {
            setActiveEventId(events[0].id);
        }
    }, [events, activeEventId]);

    useEffect(() => {
        async function loadStats() {
            if (!activeEvent?.id) {
                setStatsPayload(null);
                return;
            }

            try {
                const payload = await fetchEventStats(activeEvent.id);
                setStatsPayload(payload);
            } catch {
                setStatsPayload(null);
            }
        }

        loadStats();
    }, [activeEvent?.id]);

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
            const payload = await fetchEventStats(activeEvent.id);
            setStatsPayload(payload);
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

    async function onRefresh() {
        if (!activeEvent?.id) return;
        setRefreshing(true);
        try {
            const payload = await fetchEventStats(activeEvent.id);
            setStatsPayload(payload);
        } finally {
            setRefreshing(false);
        }
    }

    function handleVisitorCompleted(payload, action) {
        const activityStatus = action === 'add_and_check_in' ? 'attended' : 'added';
        const invitationStatus = payload?.invitation?.status;
        const invitationLabel = invitationStatus === 'queued'
            ? 'Invitation queued'
            : invitationStatus === 'skipped'
                ? `Invitation skipped (${payload?.invitation?.reason || 'not available'})`
                : 'Invitation not requested';
        setResult({
            status: activityStatus,
            attendee: {
                name: payload?.guest?.name || 'Walk-in guest'
            },
            event: {
                name: payload?.attendance?.eventName || 'Guest list'
            },
            invitationLabel
        });
        setRecentScans((prev) => [
            {
                token: payload?.guest?.id || `${Date.now()}`,
                label: payload?.guest?.name || 'Walk-in guest',
                status: activityStatus
            },
            ...prev
        ].slice(0, 6));
    }

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.topbar}>
                <View>
                    <Text style={[styles.eyebrow, textStyle]}>Scanner Session</Text>
                    <Text style={[styles.clientName, textStyle]}>{localizedName(i18n.language, client?.name, client?.name_ar)}</Text>
                    <Text style={[styles.meta, textStyle]}>{scannerUser?.name}</Text>
                </View>
                <Pressable onPress={onLogout}><Text style={[styles.logout, textStyle]}>Logout</Text></Pressable>
            </View>

            <View style={styles.card}>
                <Text style={[styles.sectionTitle, textStyle]}>Assigned Events</Text>
                <View style={styles.eventList}>
                    {events.map((event) => {
                        const active = event.id === (activeEvent?.id || activeEventId);
                        return (
                            <Pressable
                                key={event.id}
                                onPress={() => setActiveEventId(event.id)}
                                style={[styles.eventChip, active && styles.eventChipActive]}
                            >
                                <Text style={[styles.eventChipText, active && styles.eventChipTextActive, textStyle]}>
                                    {localizedName(i18n.language, event.name, event.name_ar)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            <CameraScanCard enabled={Boolean(activeEvent?.id)} busy={submittingScan} onScanned={handleCameraScan} />

            <EventStatsCard statsPayload={statsPayload} />

            <VisitorIntakeCard eventId={activeEvent?.id} onCompleted={handleVisitorCompleted} />

            <View style={styles.card}>
                <Text style={[styles.sectionTitle, textStyle]}>Manual Scan</Text>
                <TextInput
                    style={[styles.input, textStyle]}
                    value={manualToken}
                    onChangeText={setManualToken}
                    placeholder="Paste invitation token or URL"
                    autoCapitalize="none"
                />
                <Pressable style={[styles.primaryBtn, submittingScan && styles.primaryBtnDisabled]} onPress={handleManualScan}>
                    <Text style={[styles.primaryBtnText, textStyle]}>{submittingScan ? 'Scanning...' : 'Mark Attended'}</Text>
                </Pressable>
            </View>

            <View style={styles.card}>
                <Text style={[styles.sectionTitle, textStyle]}>Latest Result</Text>
                {result ? (
                    <>
                        <Text style={[styles.resultLine, textStyle]}>Status: {result.status}</Text>
                        <Text style={[styles.resultLine, textStyle]}>{localizedName(i18n.language, result.attendee?.name, result.attendee?.name_ar)}</Text>
                        <Text style={[styles.resultLineMuted, textStyle]}>{localizedName(i18n.language, result.event?.name, result.event?.name_ar)}</Text>
                        {result.invitationLabel ? <Text style={[styles.resultLineMuted, textStyle]}>{result.invitationLabel}</Text> : null}
                    </>
                ) : (
                    <Text style={[styles.resultLineMuted, textStyle]}>Waiting for first scan...</Text>
                )}
            </View>

            <View style={styles.card}>
                <Text style={[styles.sectionTitle, textStyle]}>Recent Scans</Text>
                {recentScans.length ? recentScans.map((scan, index) => (
                    <View style={styles.row} key={`${scan.token}-${index}`}>
                        <Text style={[styles.rowPrimary, textStyle]}>{scan.label || scan.token.slice(0, 10)}</Text>
                        <Text style={[styles.rowStatus, textStyle]}>{scan.status}</Text>
                    </View>
                )) : <Text style={[styles.resultLineMuted, textStyle]}>No scans yet.</Text>}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.colors.background },
    content: { padding: tokens.spacing.md, gap: tokens.spacing.md, paddingBottom: 44 },
    topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    eyebrow: { color: tokens.colors.textSecondary, fontSize: 12 },
    clientName: { color: tokens.colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 2 },
    meta: { color: tokens.colors.textSecondary, fontSize: 13, marginTop: 4 },
    logout: { color: tokens.colors.accent, fontWeight: '700', marginTop: 10 },
    card: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.md,
        gap: 10
    },
    sectionTitle: { color: tokens.colors.textPrimary, fontSize: 16, fontWeight: '700' },
    eventList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    eventChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F2F6FB', borderWidth: 1, borderColor: '#DCE6F3' },
    eventChipActive: { backgroundColor: tokens.colors.accentSoft, borderColor: tokens.colors.accent },
    eventChipText: { color: tokens.colors.textPrimary, fontSize: 13 },
    eventChipTextActive: { color: '#0A4B67', fontWeight: '700' },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.md,
        paddingHorizontal: 14,
        fontSize: 15,
        color: tokens.colors.textPrimary
    },
    primaryBtn: { height: 48, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.accent, justifyContent: 'center', alignItems: 'center' },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    resultLine: { color: tokens.colors.textPrimary, fontSize: 15 },
    resultLineMuted: { color: tokens.colors.textSecondary, fontSize: 14 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF3F8' },
    rowPrimary: { color: tokens.colors.textPrimary, fontSize: 14, flex: 1 },
    rowStatus: { color: tokens.colors.textSecondary, fontSize: 13, textTransform: 'capitalize' }
});
