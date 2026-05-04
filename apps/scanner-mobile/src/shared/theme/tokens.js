export const tokens = {
    colors: {
        background: '#F4F7FB',
        surface: '#FFFFFF',
        textPrimary: '#0E1C2D',
        textSecondary: '#5B6776',
        accent: '#0F6D9A',
        accentSoft: '#D9EFF8',
        border: '#E1E8F0',
        success: '#149A52',
        danger: '#D14343'
    },
    spacing: {
        xs: 6,
        sm: 10,
        md: 16,
        lg: 24,
        xl: 32
    },
    radius: {
        sm: 10,
        md: 16,
        lg: 22
    }
};

export function fontFamilyForLocale(isArabic) {
    return isArabic ? 'Cairo_400Regular' : undefined;
}
