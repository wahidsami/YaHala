import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
    const [errorText, setErrorText] = useState('');
    const [lastTokenPreview, setLastTokenPreview] = useState('');
    const [lastTokenValue, setLastTokenValue] = useState('');
    const [lastRawValue, setLastRawValue] = useState('');
    const [lastScanAt, setLastScanAt] = useState('');
    const [requestState, setRequestState] = useState('idle');
    const [showDebug, setShowDebug] = useState(false);
    const [debugTokenInput, setDebugTokenInput] = useState('');
    const lastScanAtRef = useRef(0);

    useEffect(() => {
        if (!enabled) {
            setStatusText('Select an event first to activate scanning');
            setErrorText('');
            return;
        }

        setStatusText('Camera initializing...');
    }, [enabled]);

    function runScanToken({ token, rawValue = '', scannedAt = Date.now(), bypassThrottle = false }) {
        if (!enabled || busy) {
            return;
        }

        if (!bypassThrottle && scannedAt - lastScanAtRef.current < 1400) {
            return;
        }

        lastScanAtRef.current = scannedAt;
        setLastRawValue(rawValue);
        setLastScanAt(new Date(scannedAt).toISOString());

        if (!token) {
            setErrorText('QR detected but token is empty');
            setRequestState('failed');
            return;
        }

        setErrorText('');
        setLastTokenValue(token);
        setLastTokenPreview(token.slice(0, 18));
        setStatusText('Scanning QR...');
        setRequestState('sending');
        Promise.resolve(onScanned(token))
            .then(() => {
                setStatusText('Scan sent successfully');
                setRequestState('success');
                setTimeout(() => setStatusText('Camera ready'), 900);
            })
            .catch((error) => {
                const message = error?.response?.data?.message || 'Scan failed, try again';
                setStatusText('Scan failed');
                setErrorText(message);
                setRequestState('failed');
            });
    }

    function handleBarcodeScanned(result) {
        const rawValue = (result?.data || '').trim();
        const token = extractTokenFromScan(rawValue);
        runScanToken({ token, rawValue, scannedAt: Date.now(), bypassThrottle: false });
    }

    function handleDebugRunScan() {
        const rawValue = (debugTokenInput || '').trim();
        const token = extractTokenFromScan(rawValue);
        runScanToken({ token, rawValue, scannedAt: Date.now(), bypassThrottle: true });
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
                <View style={styles.headerActions}>
                    <Pressable style={styles.debugPillBtn} onPress={() => setShowDebug((prev) => !prev)}>
                        <Text style={[styles.debugPillText, textStyle]}>{showDebug ? 'Hide Debug' : 'Debug'}</Text>
                    </Pressable>
                    <Text style={[styles.livePill, textStyle]}>{busy ? 'Busy' : 'Live'}</Text>
                </View>
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
                        setErrorText(event?.nativeEvent?.message || 'Camera mount error');
                    }}
                />
            </View>

            <Text style={[styles.note, textStyle]}>{statusText}</Text>
            {!enabled ? <Text style={[styles.note, textStyle]}>Select an event first to activate scanning.</Text> : null}
            {lastTokenPreview ? <Text style={[styles.note, textStyle]}>Last token: {lastTokenPreview}...</Text> : null}
            {errorText ? <Text style={[styles.error, textStyle]}>{errorText}</Text> : null}

            {showDebug ? (
                <View style={styles.debugWrap}>
                    <Text style={[styles.debugTitle, textStyle]}>Scanner Debug</Text>
                    <Text style={[styles.debugLine, textStyle]}>enabled: {String(enabled)}</Text>
                    <Text style={[styles.debugLine, textStyle]}>busy: {String(Boolean(busy))}</Text>
                    <Text style={[styles.debugLine, textStyle]}>request: {requestState}</Text>
                    <Text style={[styles.debugLine, textStyle]}>lastScanAt: {lastScanAt || '-'}</Text>
                    <Text style={[styles.debugLine, textStyle]}>raw: {lastRawValue || '-'}</Text>
                    <Text style={[styles.debugLine, textStyle]}>token: {lastTokenValue || '-'}</Text>
                    <TextInput
                        style={[styles.debugInput, textStyle]}
                        value={debugTokenInput}
                        onChangeText={setDebugTokenInput}
                        placeholder="Paste token or invite URL then Run Test Scan"
                        autoCapitalize="none"
                    />
                    <Pressable style={styles.debugRunBtn} onPress={handleDebugRunScan}>
                        <Text style={[styles.debugRunBtnText, textStyle]}>Run Test Scan</Text>
                    </Pressable>
                </View>
            ) : null}
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
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
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
    debugPillBtn: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D7E6F5',
        backgroundColor: '#EEF5FB',
        paddingVertical: 4,
        paddingHorizontal: 10
    },
    debugPillText: {
        fontSize: 11,
        color: '#35516A',
        fontWeight: '700'
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
    error: {
        color: tokens.colors.danger,
        fontSize: 13
    },
    debugWrap: {
        borderWidth: 1,
        borderColor: '#E7EDF4',
        borderRadius: tokens.radius.md,
        backgroundColor: '#FAFCFF',
        padding: 10,
        gap: 4
    },
    debugTitle: {
        color: tokens.colors.textPrimary,
        fontSize: 12,
        fontWeight: '700'
    },
    debugLine: {
        color: '#35516A',
        fontSize: 11
    },
    debugInput: {
        height: 38,
        borderWidth: 1,
        borderColor: '#D7E6F5',
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        fontSize: 12,
        color: tokens.colors.textPrimary
    },
    debugRunBtn: {
        height: 36,
        borderRadius: 8,
        backgroundColor: '#1C7C54',
        justifyContent: 'center',
        alignItems: 'center'
    },
    debugRunBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700'
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
