import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { approveVisitorIntake, extractVisitorFromTranscript, transcribeVisitorAudio } from './scannerApi';
import { fontFamilyForLocale, tokens } from '../../shared/theme/tokens';

function createEmptyFields() {
    return {
        name: '',
        position: '',
        organization: '',
        email: '',
        mobileNumber: ''
    };
}

export default function VisitorIntakeCard({ eventId, onCompleted }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const textStyle = useMemo(() => ({ fontFamily: fontFamilyForLocale(isArabic) }), [isArabic]);

    const [transcript, setTranscript] = useState('');
    const [fields, setFields] = useState(createEmptyFields());
    const [extracting, setExtracting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [recording, setRecording] = useState(null);
    const [transcribing, setTranscribing] = useState(false);
    const [confidence, setConfidence] = useState(null);
    const [warnings, setWarnings] = useState([]);
    const [error, setError] = useState('');

    async function startRecording() {
        if (recording || transcribing || saving) {
            return;
        }

        setError('');
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
            setError('Microphone permission is required');
            return;
        }

        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true
        });

        const nextRecording = new Audio.Recording();
        await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await nextRecording.startAsync();
        setRecording(nextRecording);
    }

    async function stopRecordingAndTranscribe() {
        if (!recording || transcribing) {
            return;
        }

        setTranscribing(true);
        setError('');

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            if (!uri) {
                throw new Error('Recording file was not created');
            }

            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64
            });

            const stt = await transcribeVisitorAudio({
                audioBase64: base64,
                mimeType: 'audio/m4a',
                language: isArabic ? 'ar' : 'en'
            });

            setTranscript(stt.transcript || '');
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Transcription failed');
        } finally {
            setTranscribing(false);
        }
    }

    async function handleExtract() {
        if (!transcript.trim() || extracting) {
            return;
        }

        setExtracting(true);
        setError('');
        try {
            const payload = await extractVisitorFromTranscript({
                transcript,
                language: isArabic ? 'ar' : 'en'
            });
            setFields((prev) => ({ ...prev, ...payload.extracted }));
            setConfidence(payload.confidence || null);
            setWarnings(payload.warnings || []);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Extraction failed');
        } finally {
            setExtracting(false);
        }
    }

    function updateField(key, value) {
        setFields((prev) => ({ ...prev, [key]: value }));
    }

    async function handleApprove(action) {
        if (!fields.name.trim() || saving) {
            setError('Visitor name is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const result = await approveVisitorIntake({
                eventId,
                action,
                fields,
                sendInvitation: Boolean(fields.email?.trim())
            });
            onCompleted?.(result, action);
            setTranscript('');
            setFields(createEmptyFields());
            setConfidence(null);
            setWarnings([]);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not save visitor');
        } finally {
            setSaving(false);
        }
    }

    return (
        <View style={styles.card}>
            <Text style={[styles.title, textStyle]}>Walk-in Voice Intake</Text>
            <Text style={[styles.note, textStyle]}>Record or paste transcript, extract fields, then approve in one step.</Text>

            <TextInput
                style={[styles.input, styles.multiline, textStyle]}
                value={transcript}
                onChangeText={setTranscript}
                placeholder="Transcript from voice recognition"
                multiline
                textAlignVertical="top"
            />

            <View style={styles.actions}>
                <Pressable style={[styles.secondaryBtn, (recording || transcribing) && styles.btnDisabled]} onPress={startRecording}>
                    <Text style={[styles.secondaryBtnText, textStyle]}>{recording ? 'Recording...' : 'Record Voice'}</Text>
                </Pressable>
                <Pressable style={[styles.secondaryBtn, (!recording || transcribing) && styles.btnDisabled]} disabled={!recording} onPress={stopRecordingAndTranscribe}>
                    <Text style={[styles.secondaryBtnText, textStyle]}>{transcribing ? 'Transcribing...' : 'Stop & Transcribe'}</Text>
                </Pressable>
            </View>

            <Pressable style={[styles.secondaryBtn, extracting && styles.btnDisabled]} onPress={handleExtract}>
                <Text style={[styles.secondaryBtnText, textStyle]}>{extracting ? 'Extracting...' : 'Extract Data'}</Text>
            </Pressable>

            {confidence ? (
                <View style={styles.confidenceWrap}>
                    <Text style={[styles.subTitle, textStyle]}>Extraction Confidence</Text>
                    <View style={styles.chipRow}>
                        <View style={styles.chip}><Text style={[styles.chipText, textStyle]}>Name {Math.round((confidence.name || 0) * 100)}%</Text></View>
                        <View style={styles.chip}><Text style={[styles.chipText, textStyle]}>Email {Math.round((confidence.email || 0) * 100)}%</Text></View>
                        <View style={styles.chip}><Text style={[styles.chipText, textStyle]}>Mobile {Math.round((confidence.mobileNumber || 0) * 100)}%</Text></View>
                        <View style={styles.chip}><Text style={[styles.chipText, textStyle]}>Position {Math.round((confidence.position || 0) * 100)}%</Text></View>
                        <View style={styles.chip}><Text style={[styles.chipText, textStyle]}>Org {Math.round((confidence.organization || 0) * 100)}%</Text></View>
                    </View>
                </View>
            ) : null}

            {warnings.length ? (
                <View style={styles.warningBox}>
                    {warnings.map((warning) => (
                        <Text key={warning} style={[styles.warningText, textStyle]}>- {warning}</Text>
                    ))}
                </View>
            ) : null}

            <View style={styles.grid}>
                <TextInput style={[styles.input, textStyle]} placeholder="Name" value={fields.name} onChangeText={(v) => updateField('name', v)} />
                <TextInput style={[styles.input, textStyle]} placeholder="Position" value={fields.position} onChangeText={(v) => updateField('position', v)} />
                <TextInput style={[styles.input, textStyle]} placeholder="Organization" value={fields.organization} onChangeText={(v) => updateField('organization', v)} />
                <TextInput style={[styles.input, textStyle]} placeholder="Email" value={fields.email} onChangeText={(v) => updateField('email', v)} autoCapitalize="none" />
                <TextInput style={[styles.input, textStyle]} placeholder="Mobile Number" value={fields.mobileNumber} onChangeText={(v) => updateField('mobileNumber', v)} />
            </View>

            {error ? <Text style={[styles.error, textStyle]}>{error}</Text> : null}

            <View style={styles.actions}>
                <Pressable style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={() => handleApprove('add_only')}>
                    <Text style={[styles.primaryBtnText, textStyle]}>{saving ? 'Saving...' : 'Approve & Add'}</Text>
                </Pressable>
                <Pressable
                    style={[styles.primaryBtn, saving && styles.btnDisabled, !eventId && styles.btnDisabled]}
                    disabled={!eventId}
                    onPress={() => handleApprove('add_and_check_in')}
                >
                    <Text style={[styles.primaryBtnText, textStyle]}>{saving ? 'Saving...' : 'Approve & Check In'}</Text>
                </Pressable>
            </View>
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
    title: {
        color: tokens.colors.textPrimary,
        fontSize: 16,
        fontWeight: '700'
    },
    note: {
        color: tokens.colors.textSecondary,
        fontSize: 13
    },
    subTitle: {
        color: tokens.colors.textPrimary,
        fontSize: 13,
        fontWeight: '700'
    },
    confidenceWrap: {
        gap: 8
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6
    },
    chip: {
        backgroundColor: '#EEF5FB',
        borderWidth: 1,
        borderColor: '#D7E6F5',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5
    },
    chipText: {
        color: '#35516A',
        fontSize: 12
    },
    warningBox: {
        backgroundColor: '#FFF5F5',
        borderWidth: 1,
        borderColor: '#FFD0D0',
        borderRadius: tokens.radius.md,
        padding: 10,
        gap: 4
    },
    warningText: {
        color: '#B83333',
        fontSize: 12
    },
    grid: {
        gap: 8
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.md,
        paddingHorizontal: 12,
        fontSize: 14,
        color: tokens.colors.textPrimary
    },
    multiline: {
        minHeight: 90,
        height: 90,
        paddingTop: 10
    },
    actions: {
        gap: 8
    },
    primaryBtn: {
        height: 46,
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.colors.accent,
        justifyContent: 'center',
        alignItems: 'center'
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14
    },
    secondaryBtn: {
        height: 42,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: tokens.colors.accent,
        justifyContent: 'center',
        alignItems: 'center'
    },
    secondaryBtnText: {
        color: tokens.colors.accent,
        fontWeight: '700'
    },
    btnDisabled: {
        opacity: 0.7
    },
    error: {
        color: tokens.colors.danger,
        fontSize: 13
    }
});
