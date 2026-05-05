import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

export default function AboutScreen() {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
            <Text style={[styles.title, textStyle]}>About YaHala Scanner</Text>

            <Text style={[styles.description, textStyle]}>
                YaHala Scanner is a mobile application designed for event staff to efficiently scan QR codes and manage guest check-ins at events.
            </Text>

            <Text style={[styles.version, textStyle]}>Version: 1.0.0</Text>
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
        alignItems: 'center',
    },
    title: {
        fontSize: tokens.fontSize.xl,
        fontWeight: 'bold',
        color: tokens.colors.textPrimary,
        textAlign: 'center',
        marginBottom: tokens.spacing.lg,
    },
    description: {
        fontSize: tokens.fontSize.md,
        color: tokens.colors.textSecondary,
        textAlign: 'center',
        marginBottom: tokens.spacing.lg,
    },
    version: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary,
        textAlign: 'center',
    },
});