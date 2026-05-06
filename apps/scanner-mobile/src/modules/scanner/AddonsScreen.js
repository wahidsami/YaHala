import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

export default function AddonsScreen({ activeEvent }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
            <Text style={[styles.title, textStyle]}>Event Addons</Text>
            <Text style={[styles.subtitle, textStyle]}>
                Addons support is prepared for this event scope.
            </Text>

            <View style={styles.card}>
                <Text style={[styles.cardTitle, textStyle]}>Current Event</Text>
                <Text style={[styles.cardValue, textStyle]}>
                    {activeEvent ? (isArabic ? (activeEvent.name_ar || activeEvent.name) : (activeEvent.name || activeEvent.name_ar)) : 'No event selected'}
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={[styles.cardTitle, textStyle]}>Planned Addon Modules</Text>
                <Text style={[styles.item, textStyle]}>- Poll participation and live voting visibility</Text>
                <Text style={[styles.item, textStyle]}>- Invitation project quick actions</Text>
                <Text style={[styles.item, textStyle]}>- Memory-book quick links (event scoped)</Text>
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
    card: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.borderRadius.md,
        padding: tokens.spacing.md,
        gap: 8
    },
    cardTitle: {
        fontSize: tokens.fontSize.md,
        color: tokens.colors.textPrimary,
        fontWeight: '700'
    },
    cardValue: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    },
    item: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    }
});
