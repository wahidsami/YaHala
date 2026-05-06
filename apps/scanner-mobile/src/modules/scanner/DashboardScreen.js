import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchEventStats } from './scannerApi';
import EventStatsCard from '../stats/EventStatsCard';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function localizedName(language, en, ar) {
    return language === 'ar' ? (ar || en || '') : (en || ar || '');
}

export default function DashboardScreen({ scannerUser, client, activeEvent }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);
    const [statsPayload, setStatsPayload] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function loadStats() {
            if (!activeEvent?.id) {
                setStatsPayload(null);
                return;
            }

            try {
                const payload = await fetchEventStats(activeEvent.id);
                if (!cancelled) setStatsPayload(payload);
            } catch {
                if (!cancelled) setStatsPayload(null);
            }
        }
        loadStats();
        return () => {
            cancelled = true;
        };
    }, [activeEvent?.id]);

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

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.hero}>
                <Text style={[styles.clientName, textStyle]}>{localizedName(i18n.language, client?.name, client?.name_ar)}</Text>
                <Text style={[styles.welcomeText, textStyle]}>Welcome, {scannerUser?.name}</Text>
                <Text style={[styles.eventText, textStyle]}>
                    Event: {activeEvent ? localizedName(i18n.language, activeEvent.name, activeEvent.name_ar) : 'Not selected'}
                </Text>
            </View>

            {statsPayload ? <EventStatsCard statsPayload={statsPayload} /> : null}
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
    hero: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.borderRadius.md,
        padding: tokens.spacing.md,
        gap: 6
    },
    clientName: {
        fontSize: tokens.fontSize.lg,
        color: tokens.colors.textPrimary,
        fontWeight: '700'
    },
    welcomeText: {
        fontSize: tokens.fontSize.md,
        color: tokens.colors.textSecondary
    },
    eventText: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    }
});
