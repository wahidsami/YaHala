import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

export default function CameraScanCard({ enabled, onScanned, busy }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);
    const [permission, requestPermission] = useCameraPermissions();
    const [statusText, setStatusText] = useState('Camera ready');
    const lastScanAtRef = useRef(0);

    function handleBarcodeScanned(result) {
        if (!enabled || busy) {
            return;
        }

        const now = Date.now();
        if (now - lastScanAtRef.current < 1400) {
            return;
        }

        lastScanAtRef.current = now;
        const token = result?.data || '';

        if (!token) {
            return;
        }

        setStatusText('Scanning QR...');
        onScanned(token)
            .then(() => setStatusText('Camera ready'))
            .catch(() => setStatusText('Scan failed, try again'));
    }

    if (!permission) {
        return (
            <View style={styles.card}>
                <Text style={[styles.title, textStyle]}>Live QR Scan</Text>
                <Text style={[styles.note, textStyle]}>Checking camera permission...</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.card}>
                <Text style={[styles.title, textStyle]}>Live QR Scan</Text>
                <Text style={[styles.note, textStyle]}>Camera permission is required to scan invitation QR codes.</Text>
                <Pressable style={styles.button} onPress={requestPermission}>
                    <Text style={[styles.buttonText, textStyle]}>Enable Camera</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={[styles.title, textStyle]}>Live QR Scan</Text>
                <Text style={[styles.livePill, textStyle]}>{busy ? 'Busy' : 'Live'}</Text>
            </View>

            <View style={styles.cameraWrap}>
                <CameraView
                    style={styles.camera}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={enabled ? handleBarcodeScanned : undefined}
                />
            </View>

            <Text style={[styles.note, textStyle]}>{statusText}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.md,
        gap: 10
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    title: {
        color: tokens.colors.textPrimary,
        fontSize: 16,
        fontWeight: '700'
    },
    livePill: {
        fontSize: 12,
        color: '#166C4E',
        backgroundColor: '#DCF7EA',
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
        overflow: 'hidden'
    },
    cameraWrap: {
        height: 280,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#DCE6F3',
        backgroundColor: '#0D1522'
    },
    camera: {
        flex: 1
    },
    note: {
        color: tokens.colors.textSecondary,
        fontSize: 13
    },
    button: {
        alignSelf: 'flex-start',
        backgroundColor: tokens.colors.accent,
        borderRadius: tokens.radius.md,
        paddingHorizontal: 14,
        paddingVertical: 10
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '700'
    }
});
