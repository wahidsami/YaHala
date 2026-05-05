import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

export default function AccountScreen({ scannerUser, client, events }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    const assignedEvent = events.find(e => e.id === scannerUser.event_id);

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
            <Text style={[styles.title, textStyle]}>Account Information</Text>

            <View style={styles.infoSection}>
                <Text style={[styles.label, textStyle]}>Entity Name:</Text>
                <Text style={[styles.value, textStyle]}>{client?.name || 'N/A'}</Text>
            </View>

            <View style={styles.infoSection}>
                <Text style={[styles.label, textStyle]}>User Name:</Text>
                <Text style={[styles.value, textStyle]}>{scannerUser?.name || 'N/A'}</Text>
            </View>

            <View style={styles.infoSection}>
                <Text style={[styles.label, textStyle]}>Assigned Event:</Text>
                <Text style={[styles.value, textStyle]}>{assignedEvent ? (isArabic ? assignedEvent.name_ar : assignedEvent.name) : 'None'}</Text>
            </View>

            <View style={styles.infoSection}>
                <Text style={[styles.label, textStyle]}>PIN:</Text>
                <Text style={[styles.value, textStyle]}>{scannerUser?.pin || '****'}</Text>
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
    title: {
        fontSize: tokens.fontSize.xl,
        fontWeight: 'bold',
        color: tokens.colors.textPrimary,
        textAlign: 'center',
        marginBottom: tokens.spacing.lg,
    },
    infoSection: {
        marginBottom: tokens.spacing.lg,
    },
    label: {
        fontSize: tokens.fontSize.lg,
        fontWeight: 'bold',
        color: tokens.colors.textPrimary,
        marginBottom: tokens.spacing.sm,
    },
    value: {
        fontSize: tokens.fontSize.md,
        color: tokens.colors.textSecondary,
    },
});