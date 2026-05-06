import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import VisitorIntakeCard from './VisitorIntakeCard';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

export default function GuestsScreen({ activeEventId }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
            <Text style={[styles.title, textStyle]}>Guest Intake</Text>
            <Text style={[styles.subtitle, textStyle]}>
                Use voice-to-text or manual edits to add walk-in guests.
            </Text>
            <VisitorIntakeCard eventId={activeEventId} />
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
        gap: tokens.spacing.sm
    },
    title: {
        fontSize: tokens.fontSize.lg,
        color: tokens.colors.textPrimary,
        fontWeight: '700'
    },
    subtitle: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    }
});
