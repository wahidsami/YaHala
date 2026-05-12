import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function extractTokenFromScan(rawValue) {
    const raw = (rawValue || '').trim();
    if (!raw) return '';
    if (!raw.includes('://')) return raw;

    try {
        const parsed = new URL(raw);
        const parts = parsed.pathname.split('/').filter(Boolean);
        const inviteIndex = parts.findIndex((part) => part === 'invite' || part === 'i');
        if (inviteIndex >= 0 && parts[inviteIndex + 1]) {
            return parts[inviteIndex + 1].trim();
        }
        const queryToken = parsed.searchParams.get('token') || parsed.searchParams.get('invite');
        if (queryToken) return queryToken.trim();
    } catch {
        return raw;
    }

    return raw;
}

export default function CameraScanCard({ enabled, onScanned, busy }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);
    const [permission, requestPermission] = useCameraPermissions();
    const [statusText, setStatusText] = useState('Camera ready');
    const [lastTokenPreview, setLastTokenPreview] = useState('');
    const lastScanAtRef = useRef(0);
    const scanLockedRef = useRef(false);

    useEffect(() => {
        if (!enabled) {
            setStatusText('Select an event first to activate scanning');
            return;
        }

        setStatusText('Camera initializing...');
    }, [enabled]);

    useEffect(() => {
        if (!busy) {
            scanLockedRef.current = false;
        }
    }, [busy]);

    function runScanToken({ token, rawValue = '', scannedAt = Date.now(), bypassThrottle = false }) {
        if (!enabled || busy) {
            return;
        }
        if (scanLockedRef.current && !bypassThrottle) {
            return;
        }

        if (!bypassThrottle && scannedAt - lastScanAtRef.current < 1400) {
            return;
        }

        lastScanAtRef.current = scannedAt;
        scanLockedRef.current = true;
        if (!token) {
            Alert.alert('Scan warning', 'QR detected but token is empty');
            scanLockedRef.current = false;
            return;
        }

        setLastTokenPreview(token.slice(0, 18));
        setStatusText('Scanning QR...');
        Promise.resolve(onScanned(token))
            .then(() => {
                setStatusText('Scan sent successfully');
                setTimeout(() => setStatusText('Camera ready'), 900);
            })
            .catch((error) => {
                const message = error?.response?.data?.message || 'Scan failed, try again';
                setStatusText('Scan failed');
                Alert.alert('Scan failed', message);
                scanLockedRef.current = false;
            });
    }

    function handleBarcodeScanned(result) {
        const rawValue = (result?.data || '').trim();
        const token = extractTokenFromScan(rawValue);
        runScanToken({ token, rawValue, scannedAt: Date.now(), bypassThrottle: false });
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
                    onCameraReady={() => setStatusText('Camera ready')}
                    onMountError={(event) => {
                        setStatusText('Camera failed to start');
                        Alert.alert('Camera error', event?.nativeEvent?.message || 'Camera mount error');
                    }}
                />
            </View>

            <Text style={[styles.note, textStyle]}>{statusText}</Text>
            {!enabled ? <Text style={[styles.note, textStyle]}>Select an event first to activate scanning.</Text> : null}
            {lastTokenPreview ? <Text style={[styles.note, textStyle]}>Last token: {lastTokenPreview}...</Text> : null}
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
