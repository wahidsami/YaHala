import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchEventStats } from './scannerApi';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function StatItem({ label, value }) {
    return (
        <View style={styles.statItem}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    );
}

export default function ReportsScreen({ activeEvent }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);
    const [payload, setPayload] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!activeEvent?.id) {
                setPayload(null);
                return;
            }
            try {
                const next = await fetchEventStats(activeEvent.id);
                if (!cancelled) setPayload(next);
            } catch {
                if (!cancelled) setPayload(null);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [activeEvent?.id]);

    async function onRefresh() {
        if (!activeEvent?.id) return;
        setRefreshing(true);
        try {
            const next = await fetchEventStats(activeEvent.id);
            setPayload(next);
        } finally {
            setRefreshing(false);
        }
    }

    const stats = payload?.stats || {};
    const recentScans = payload?.recentScans || [];

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <Text style={[styles.title, textStyle]}>Event Reports</Text>
            <Text style={[styles.subtitle, textStyle]}>
                {activeEvent ? (isArabic ? (activeEvent.name_ar || activeEvent.name) : (activeEvent.name || activeEvent.name_ar)) : 'No event selected'}
            </Text>

            <View style={styles.statGrid}>
                <StatItem label="Invites" value={stats.invitedTotal ?? 0} />
                <StatItem label="Checked In" value={stats.checkedInTotal ?? 0} />
                <StatItem label="Pending" value={stats.invitedPending ?? 0} />
                <StatItem label="Walk-ins Added" value={stats.walkInTotal ?? 0} />
                <StatItem label="Walk-ins Checked In" value={stats.walkInCheckedIn ?? 0} />
                <StatItem label="Duplicate Scans" value={stats.duplicateScanCount ?? 0} />
            </View>

            <View style={styles.recentWrap}>
                <Text style={[styles.recentTitle, textStyle]}>Latest Scan Activity</Text>
                {recentScans.length ? recentScans.map((item, idx) => (
                    <Text key={`${item.created_at}-${idx}`} style={[styles.recentLine, textStyle]}>
                        {item.action} • {new Date(item.created_at).toLocaleTimeString()}
                    </Text>
                )) : <Text style={[styles.recentLine, textStyle]}>No scan activity yet.</Text>}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: tokens.colors.background
    },
    container: {
        padding: tokens.spacing.md,
        gap: tokens.spacing.md
    },
    title: {
        fontSize: tokens.fontSize.lg,
        color: tokens.colors.textPrimary,
        fontWeight: '700'
    },
    subtitle: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    },
    statGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: tokens.spacing.sm
    },
    statItem: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.borderRadius.md,
        padding: tokens.spacing.sm
    },
    statLabel: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    },
    statValue: {
        marginTop: 6,
        fontSize: tokens.fontSize.xl,
        color: tokens.colors.textPrimary,
        fontWeight: '700'
    },
    recentWrap: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.borderRadius.md,
        padding: tokens.spacing.md,
        gap: 6
    },
    recentTitle: {
        fontSize: tokens.fontSize.md,
        color: tokens.colors.textPrimary,
        fontWeight: '700'
    },
    recentLine: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    }
});
