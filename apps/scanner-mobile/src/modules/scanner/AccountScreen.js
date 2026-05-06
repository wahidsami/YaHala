import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function localizedName(language, en, ar) {
    return language === 'ar' ? (ar || en || '') : (en || ar || '');
}

export default function AccountScreen({ scannerUser, client, activeEvent, onLogout }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
            <Text style={[styles.title, textStyle]}>Account</Text>

            <View style={styles.infoSection}>
                <Text style={[styles.label, textStyle]}>Entity</Text>
                <Text style={[styles.value, textStyle]}>{localizedName(i18n.language, client?.name, client?.name_ar) || 'N/A'}</Text>
            </View>

            <View style={styles.infoSection}>
                <Text style={[styles.label, textStyle]}>Scanner User</Text>
                <Text style={[styles.value, textStyle]}>{scannerUser?.name || 'N/A'}</Text>
            </View>

            <View style={styles.infoSection}>
                <Text style={[styles.label, textStyle]}>Session Event</Text>
                <Text style={[styles.value, textStyle]}>
                    {activeEvent ? localizedName(i18n.language, activeEvent.name, activeEvent.name_ar) : 'N/A'}
                </Text>
            </View>

            <Pressable style={styles.logoutButton} onPress={onLogout}>
                <Text style={[styles.logoutText, textStyle]}>Logout</Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: tokens.colors.background
    },
    container: {
        padding: tokens.spacing.md
    },
    title: {
        fontSize: tokens.fontSize.xl,
        fontWeight: '700',
        color: tokens.colors.textPrimary,
        marginBottom: tokens.spacing.lg
    },
    infoSection: {
        marginBottom: tokens.spacing.md,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.borderRadius.md,
        backgroundColor: '#FFFFFF',
        padding: tokens.spacing.md
    },
    label: {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.textSecondary
    },
    value: {
        marginTop: 4,
        fontSize: tokens.fontSize.md,
        color: tokens.colors.textPrimary,
        fontWeight: '600'
    },
    logoutButton: {
        marginTop: tokens.spacing.md,
        backgroundColor: tokens.colors.danger,
        borderRadius: tokens.borderRadius.md,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center'
    },
    logoutText: {
        color: '#FFFFFF',
        fontSize: tokens.fontSize.md,
        fontWeight: '700'
    }
});
