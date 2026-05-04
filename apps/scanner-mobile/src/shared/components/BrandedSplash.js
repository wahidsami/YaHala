import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

export default function BrandedSplash() {
    return (
        <View style={styles.container}>
            <View style={styles.logoCard}>
                <Image source={require('../../../assets/splash-logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <ActivityIndicator size="small" color={tokens.colors.accent} />
            <Text style={styles.caption}>Loading scanner workspace...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        gap: 18
    },
    logoCard: {
        width: 150,
        height: 150,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0E1C2D',
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6
    },
    logo: {
        width: 110,
        height: 110
    },
    caption: {
        color: tokens.colors.textSecondary,
        fontSize: 14
    }
});
