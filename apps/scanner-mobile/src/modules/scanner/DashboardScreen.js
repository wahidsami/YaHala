import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchEventStats } from './scannerApi';
import EventStatsCard from '../stats/EventStatsCard';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function localizedName(language, en, ar) {
    return language === 'ar' ? (ar || en || '') : (en || ar || '');
}

export default function DashboardScreen({ scannerUser, client, events, activeEventId, setActiveEventId, onLogout }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    const [statsPayload, setStatsPayload] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const activeEvent = useMemo(() => {
        return events.find((event) => event.id === activeEventId) || events[0] || null;
    }, [events, activeEventId]);

    useEffect(() => {
        if (!activeEventId && events[0]?.id) {
            setActiveEventId(events[0].id);
        }
    }, [events, activeEventId, setActiveEventId]);

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
            <View style={styles.header}>
                <Text style={[styles.title, textStyle]}>{localizedName(i18n.language, client?.name, client?.name_ar)}</Text>
                <Text style={[styles.subtitle, textStyle]}>{scannerUser?.name}</Text>
            </View>

            <View style={styles.eventSelector}>
                <Text style={[styles.sectionTitle, textStyle]}>Select Event</Text>
                <View style={styles.eventChips}>
                    {events.map((event) => (
                        <Pressable
                            key={event.id}
                            style={[styles.eventChip, activeEventId === event.id && styles.activeChip]}
                            onPress={() => setActiveEventId(event.id)}
                        >
                            <Text style={[styles.eventChipText, textStyle, activeEventId === event.id && styles.activeChipText]}>
                                {localizedName(i18n.language, event.name, event.name_ar)}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {statsPayload && <EventStatsCard payload={statsPayload} />}

            <View style={styles.quickActions}>
                <Text style={[styles.sectionTitle, textStyle]}>Quick Actions</Text>
                {/* Add buttons for quick actions, e.g., navigate to scan */}
            </View>
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
    header: {
        marginBottom: tokens.spacing.lg,
    },
    title: {
        fontSize: tokens.fontSize.xl,
        fontWeight: 'bold',
        color: tokens.colors.textPrimary,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: tokens.fontSize.lg,
        color: tokens.colors.textSecondary,
        textAlign: 'center',
        marginTop: tokens.spacing.sm,
    },
    eventSelector: {
        marginBottom: tokens.spacing.lg,
    },
    sectionTitle: {
        fontSize: tokens.fontSize.lg,
        fontWeight: 'bold',
        color: tokens.colors.textPrimary,
        marginBottom: tokens.spacing.md,
    },
    eventChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    eventChip: {
        backgroundColor: tokens.colors.surface,
        paddingHorizontal: tokens.spacing.md,
        paddingVertical: tokens.spacing.sm,
        borderRadius: tokens.borderRadius.md,
        marginRight: tokens.spacing.sm,
        marginBottom: tokens.spacing.sm,
        borderWidth: 1,
        borderColor: tokens.colors.border,
    },
    activeChip: {
        backgroundColor: tokens.colors.primary,
        borderColor: tokens.colors.primary,
    },
    eventChipText: {
        fontSize: tokens.fontSize.md,
        color: tokens.colors.textPrimary,
    },
    activeChipText: {
        color: tokens.colors.onPrimary,
    },
    quickActions: {
        // Styles for quick actions
    },
});