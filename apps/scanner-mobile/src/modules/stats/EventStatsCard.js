import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function StatCard({ label, value, accent }) {
    return (
        <View style={[styles.statCard, { borderColor: accent }]}> 
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    );
}

function EventStatsCard({ statsPayload }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = { fontFamily: fontFamilyForLocale(isArabic) };

    const stats = statsPayload?.stats || {};

    return (
        <View style={styles.container}>
            <Text style={[styles.title, textStyle]}>Event Realtime</Text>
            <View style={styles.grid}>
                <StatCard label="Invited" value={stats.invitedTotal ?? 0} accent="#8DB6F5" />
                <StatCard label="Checked In" value={stats.checkedInTotal ?? 0} accent="#7FDFA5" />
                <StatCard label="Pending" value={stats.invitedPending ?? 0} accent="#F0C36E" />
                <StatCard label="Walk-ins" value={stats.walkInTotal ?? 0} accent="#C5A8F2" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        padding: tokens.spacing.md,
        gap: tokens.spacing.sm
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: tokens.colors.textPrimary
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    statCard: {
        width: '48%',
        minHeight: 70,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        padding: 10,
        backgroundColor: '#F9FBFD',
        justifyContent: 'space-between'
    },
    statLabel: {
        fontSize: 12,
        color: tokens.colors.textSecondary
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: tokens.colors.textPrimary
    }
});

export default memo(EventStatsCard);
