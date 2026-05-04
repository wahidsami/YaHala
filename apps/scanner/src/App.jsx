import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ChevronRight, LogOut, Mic, ScanLine, ShieldCheck, Smartphone, Square, UserCircle2, UserPlus } from 'lucide-react';
import jsQR from 'jsqr';
import api, { SCANNER_STORAGE_KEY } from './services/api';

function toDate(value) {
    if (!value) {
        return 'Not scheduled';
    }

    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value));
}

function localizedName(language, en, ar) {
    return language === 'ar' ? (ar || en || '') : (en || ar || '');
}

function createEmptyVisitorForm() {
    return {
        name: '',
        position: '',
        organization: '',
        email: '',
        mobileNumber: ''
    };
}

function getSpeechRecognitionCtor() {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function normalizeTranscriptDigits(value) {
    return (value || '')
        .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

function cleanupSpokenSegment(value) {
    return normalizeTranscriptDigits(value)
        .replace(/\b(my name is|this is|name is|i am|i'm|email is|mobile number is|phone number is|position is|organization is|company is)\b/gi, '')
        .replace(/^(اسمي|أنا|هذا|الايميل|البريد الإلكتروني|رقم الجوال|رقم الهاتف|المنصب|الشركة|المؤسسة|الجهة)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TRANSCRIPT_FIELD_ALIASES = {
    name: ['full name', 'name', 'my name is', 'name is', 'الاسم', 'اسمي'],
    position: ['job title', 'position', 'title', 'role', 'المنصب', 'الوظيفة'],
    organization: ['organization', 'company', 'institution', 'working at', 'from company', 'الشركة', 'المؤسسة', 'الجهة'],
    email: ['email address', 'email', 'الايميل', 'البريد الإلكتروني'],
    mobileNumber: ['mobile number', 'phone number', 'mobile', 'phone', 'رقم الجوال', 'رقم الهاتف']
};

const ALL_TRANSCRIPT_LABELS = Object.values(TRANSCRIPT_FIELD_ALIASES)
    .flat()
    .sort((left, right) => right.length - left.length)
    .map((label) => escapeRegExp(label))
    .join('|');

function extractLabeledTranscriptValue(source, aliases) {
    const aliasPattern = aliases
        .slice()
        .sort((left, right) => right.length - left.length)
        .map((label) => escapeRegExp(label))
        .join('|');
    const pattern = new RegExp(
        `(?:^|[\\n,;]|\\s)(?:${aliasPattern})\\s*(?::|=|\\bis\\b)?\\s*(.+?)(?=(?:(?:[\\n,;]|\\s)+(?:${ALL_TRANSCRIPT_LABELS})\\s*(?::|=|\\bis\\b)?)|$)`,
        'i'
    );
    const match = source.match(pattern);

    return cleanupSpokenSegment(match?.[1] || '');
}

function normalizeSpokenEmail(value) {
    return cleanupSpokenSegment(value)
        .replace(/\(at\)|\[at\]/gi, '@')
        .replace(/\b(at)\b/gi, '@')
        .replace(/\b(dot)\b/gi, '.')
        .replace(/\s+/g, '');
}

function normalizeSpokenPhone(value) {
    const digits = normalizeTranscriptDigits(value).replace(/[^\d+]/g, '');

    if (/^\+9665\d{8}$/.test(digits)) {
        return digits;
    }

    if (/^05\d{8}$/.test(digits)) {
        return digits;
    }

    return '';
}

function pickSegment(segments, matcher) {
    const index = segments.findIndex((segment) => matcher(segment));
    if (index === -1) {
        return null;
    }

    const [segment] = segments.splice(index, 1);
    return cleanupSpokenSegment(segment);
}

function parseVisitorTranscript(transcript) {
    const source = normalizeTranscriptDigits(transcript);
    if (!source.trim()) {
        return createEmptyVisitorForm();
    }

    const normalizedSource = source.replace(/[،؛]/g, ',');
    const emailMatch = normalizedSource.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const spokenEmail = extractLabeledTranscriptValue(normalizedSource, TRANSCRIPT_FIELD_ALIASES.email);
    const email = (emailMatch?.[0] || normalizeSpokenEmail(spokenEmail) || '').toLowerCase();

    const mobileMatch = normalizedSource.match(/(?:\+966[\s-]*5(?:[\s-]*\d){8}|0[\s-]*5(?:[\s-]*\d){8})/);
    const spokenMobile = extractLabeledTranscriptValue(normalizedSource, TRANSCRIPT_FIELD_ALIASES.mobileNumber);
    const mobileNumber = normalizeSpokenPhone(mobileMatch?.[0] || spokenMobile);

    const stripped = normalizedSource
        .replace(emailMatch?.[0] || '', ' ')
        .replace(mobileMatch?.[0] || '', ' ');

    const segments = stripped
        .split(/[\n,;]+/)
        .map((segment) => cleanupSpokenSegment(segment))
        .filter(Boolean);

    const labeledName = extractLabeledTranscriptValue(normalizedSource, TRANSCRIPT_FIELD_ALIASES.name);
    const labeledPosition = extractLabeledTranscriptValue(normalizedSource, TRANSCRIPT_FIELD_ALIASES.position);
    const labeledOrganization = extractLabeledTranscriptValue(normalizedSource, TRANSCRIPT_FIELD_ALIASES.organization);

    const organization = pickSegment(
        segments,
        (segment) => /\b(from|company|organization|org|working at)\b/i.test(segment) || /(شركة|مؤسسة|جهة|من شركة|من مؤسسة)/.test(segment)
    ) || labeledOrganization || '';

    const position = pickSegment(
        segments,
        (segment) => /\b(position|title|role|manager|director|engineer|officer|coordinator|specialist|supervisor)\b/i.test(segment) || /(منصب|وظيفة|مدير|مهندس|مسؤول|منسق|أخصائي|مشرف)/.test(segment)
    ) || labeledPosition || segments[1] || '';

    const name = labeledName || segments[0] || cleanupSpokenSegment(
        normalizedSource.split(/[\n,;]+/)[0] || ''
    );

    return {
        name,
        position: cleanupSpokenSegment(position),
        organization: cleanupSpokenSegment(organization || segments[2] || ''),
        email,
        mobileNumber
    };
}

function LoginCard({ onLogin, loading, error }) {
    const [clientId, setClientId] = useState('');
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        onLogin({ clientId, name, pin });
    }

    return (
        <div className="auth-screen">
            <div className="auth-shell">
                <div className="auth-hero">
                    <div className="brand-mark">
                        <ShieldCheck size={22} />
                    </div>
                    <p className="eyebrow">Entity Scanner</p>
                    <h1>Fast door check-in for invited guests</h1>
                    <p className="hero-copy">
                        Staff sign in with their entity login, pick the event, and scan the invitation QR from any phone camera.
                    </p>
                </div>

                <form className="auth-card" onSubmit={handleSubmit}>
                    <label>
                        <span>Entity Email or ID</span>
                        <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="client@email.com or UUID" autoComplete="off" />
                    </label>

                    <label>
                        <span>Scanner Name</span>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="scanner1" autoComplete="off" />
                    </label>

                    <label>
                        <span>PIN</span>
                        <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" type="password" autoComplete="off" />
                    </label>

                    {error && <div className="form-alert">{error}</div>}

                    <button className="primary-btn" type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign in'}
                        <ChevronRight size={18} />
                    </button>

                    <p className="auth-note">
                        Use the scanner credentials assigned to the entity. The app stays scoped to that client automatically after login.
                    </p>
                </form>
            </div>
        </div>
    );
}

function CameraScanner({ enabled, onScan, onStatus }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const detectorRef = useRef(null);
    const fallbackCanvasRef = useRef(null);
    const lastScanRef = useRef(0);
    const lastDecodeAttemptRef = useRef(0);
    const onScanRef = useRef(onScan);
    const onStatusRef = useRef(onStatus);

    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    useEffect(() => {
        onStatusRef.current = onStatus;
    }, [onStatus]);

    useEffect(() => {
        let cancelled = false;
        let rafId = null;

        function emitScan(value) {
            const now = Date.now();
            if (now - lastScanRef.current > 1400) {
                lastScanRef.current = now;
                onScanRef.current(value);
            }
        }

        async function detectWithJsQr(videoElement) {
            const width = videoElement.videoWidth;
            const height = videoElement.videoHeight;

            if (!width || !height) {
                return null;
            }

            if (!fallbackCanvasRef.current) {
                fallbackCanvasRef.current = document.createElement('canvas');
            }

            const canvas = fallbackCanvasRef.current;
            const context = canvas.getContext('2d', { willReadFrequently: true });

            if (!context) {
                return null;
            }

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            context.drawImage(videoElement, 0, 0, width, height);
            const imageData = context.getImageData(0, 0, width, height);
            const code = jsQR(imageData.data, width, height, {
                inversionAttempts: 'attemptBoth'
            });

            return code?.data || null;
        }

        async function createNativeDetector() {
            if (!('BarcodeDetector' in window)) {
                return null;
            }

            try {
                if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
                    const formats = await window.BarcodeDetector.getSupportedFormats();
                    if (!formats.includes('qr_code')) {
                        return null;
                    }
                }

                return new window.BarcodeDetector({ formats: ['qr_code'] });
            } catch {
                return null;
            }
        }

        async function optimizeVideoTrack(track) {
            if (!track?.getCapabilities || !track?.applyConstraints) {
                return;
            }

            try {
                const capabilities = track.getCapabilities();
                const advancedConstraints = [];

                if (capabilities.focusMode?.includes?.('continuous')) {
                    advancedConstraints.push({ focusMode: 'continuous' });
                }

                if (capabilities.exposureMode?.includes?.('continuous')) {
                    advancedConstraints.push({ exposureMode: 'continuous' });
                }

                if (capabilities.whiteBalanceMode?.includes?.('continuous')) {
                    advancedConstraints.push({ whiteBalanceMode: 'continuous' });
                }

                if (advancedConstraints.length) {
                    await track.applyConstraints({ advanced: advancedConstraints });
                }
            } catch {
                // Some mobile browsers expose partial capabilities. Ignore unsupported tweaks.
            }
        }

        async function startCamera() {
            if (!enabled) {
                return;
            }

            if (!navigator.mediaDevices?.getUserMedia) {
                onStatusRef.current('Camera access is not available in this browser.');
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        aspectRatio: { ideal: 1.7777777778 }
                    },
                    audio: false
                });

                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = stream;
                detectorRef.current = await createNativeDetector();
                await optimizeVideoTrack(stream.getVideoTracks()[0]);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }

                onStatusRef.current(
                    detectorRef.current
                        ? 'Camera ready. Point it at the QR code.'
                        : 'Camera ready. Using fallback QR scanning for this browser.'
                );

                const scanFrame = async () => {
                    if (cancelled || !videoRef.current) {
                        return;
                    }

                    try {
                        if (videoRef.current.readyState >= 2) {
                            const now = Date.now();
                            if (now - lastDecodeAttemptRef.current < 180) {
                                rafId = window.requestAnimationFrame(scanFrame);
                                return;
                            }

                            lastDecodeAttemptRef.current = now;

                            if (detectorRef.current) {
                                const codes = await detectorRef.current.detect(videoRef.current);
                                if (codes.length > 0) {
                                    emitScan(codes[0].rawValue);
                                }
                            } else {
                                const value = await detectWithJsQr(videoRef.current);
                                if (value) {
                                    emitScan(value);
                                }
                            }
                        }
                    } catch {
                        // Best effort. Keep scanning.
                    }

                    rafId = window.requestAnimationFrame(scanFrame);
                };

                rafId = window.requestAnimationFrame(scanFrame);
            } catch {
                onStatusRef.current('We could not access the camera. Check permissions and try again.');
            }
        }

        startCamera();

        return () => {
            cancelled = true;
            if (rafId) {
                window.cancelAnimationFrame(rafId);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
        };
    }, [enabled]);

    return (
        <div className="scanner-camera">
            <video ref={videoRef} playsInline muted autoPlay />
        </div>
    );
}

function VisitorIntakePanel({ eventId, onApprove, busy, onSuccess }) {
    const recognitionRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [language, setLanguage] = useState('en-US');
    const [speechSupported, setSpeechSupported] = useState(false);
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [form, setForm] = useState(createEmptyVisitorForm());
    const [error, setError] = useState('');

    useEffect(() => {
        setSpeechSupported(Boolean(getSpeechRecognitionCtor()));
    }, []);

    useEffect(() => () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    }, []);

    function updateForm(next) {
        setForm((prev) => ({ ...prev, ...next }));
    }

    function resetPanel() {
        setTranscript('');
        setForm(createEmptyVisitorForm());
        setError('');
        setListening(false);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    }

    function handleTranscript(nextTranscript) {
        setTranscript(nextTranscript);
        const parsed = parseVisitorTranscript(nextTranscript);
        setForm((prev) => ({
            name: parsed.name || prev.name,
            position: parsed.position || prev.position,
            organization: parsed.organization || prev.organization,
            email: parsed.email || prev.email,
            mobileNumber: parsed.mobileNumber || prev.mobileNumber
        }));
    }

    function startListening() {
        const SpeechRecognitionCtor = getSpeechRecognitionCtor();
        if (!SpeechRecognitionCtor) {
            setError('Live speech-to-text is not available in this browser. You can still type the details manually.');
            return;
        }

        setError('');
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = language;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            setListening(true);
        };

        recognition.onresult = (event) => {
            let nextTranscript = '';
            for (let index = 0; index < event.results.length; index += 1) {
                nextTranscript += `${event.results[index][0].transcript} `;
            }
            handleTranscript(nextTranscript.trim());
        };

        recognition.onerror = (event) => {
            setError(event.error === 'not-allowed'
                ? 'Microphone access was blocked. Allow it and try again.'
                : 'Speech capture failed. You can type the details manually.');
        };

        recognition.onend = () => {
            setListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }

    function stopListening() {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    }

    async function handleApprove(action) {
        setError('');

        try {
            await onApprove({
                eventId,
                action,
                fields: form
            });

            onSuccess?.();
            resetPanel();
            setOpen(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to save this visitor right now.');
        }
    }

    return (
        <div className="visitor-intake-card">
            <div className="visitor-intake-head">
                <div>
                    <p className="eyebrow">Visitor intake</p>
                    <h3>Add a walk-in visitor</h3>
                </div>
                <button type="button" className="ghost-btn intake-toggle-btn" onClick={() => setOpen((prev) => !prev)}>
                    <UserPlus size={16} />
                    <span>{open ? 'Close' : 'Add Visitor'}</span>
                </button>
            </div>

            {open && (
                <div className="visitor-intake-body">
                    <div className="intake-toolbar">
                        <label className="intake-language">
                            <span>Speech language</span>
                            <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={listening}>
                                <option value="en-US">English</option>
                                <option value="ar-SA">Arabic</option>
                            </select>
                        </label>

                        {speechSupported ? (
                            listening ? (
                                <button type="button" className="ghost-btn mic-btn stop-btn" onClick={stopListening}>
                                    <Square size={16} />
                                    <span>Stop</span>
                                </button>
                            ) : (
                                <button type="button" className="ghost-btn mic-btn" onClick={startListening}>
                                    <Mic size={16} />
                                    <span>Start Speaking</span>
                                </button>
                            )
                        ) : (
                            <div className="speech-note">Speech-to-text is unavailable on this browser. Manual review still works.</div>
                        )}
                    </div>

                    <label className="intake-block">
                        <span>Transcript</span>
                        <textarea
                            value={transcript}
                            onChange={(event) => handleTranscript(event.target.value)}
                            rows={4}
                            placeholder="Visitor speaks here, or paste the spoken text for review."
                        />
                    </label>

                    <div className="visitor-form-grid">
                        <label>
                            <span>Name</span>
                            <input value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder="Visitor name" />
                        </label>
                        <label>
                            <span>Position</span>
                            <input value={form.position} onChange={(event) => updateForm({ position: event.target.value })} placeholder="Job title" />
                        </label>
                        <label>
                            <span>Organization</span>
                            <input value={form.organization} onChange={(event) => updateForm({ organization: event.target.value })} placeholder="Company or organization" />
                        </label>
                        <label>
                            <span>Email</span>
                            <input value={form.email} onChange={(event) => updateForm({ email: event.target.value })} placeholder="name@example.com" />
                        </label>
                        <label>
                            <span>Mobile number</span>
                            <input value={form.mobileNumber} onChange={(event) => updateForm({ mobileNumber: event.target.value })} placeholder="0501234567" />
                        </label>
                    </div>

                    {error && <div className="form-alert">{error}</div>}

                    <div className="visitor-actions">
                        <button type="button" className="ghost-btn" onClick={resetPanel} disabled={busy}>
                            Reset
                        </button>
                        <button type="button" className="primary-btn" onClick={() => handleApprove('add_only')} disabled={busy}>
                            <span>{busy ? 'Saving...' : 'Approve & Add'}</span>
                        </button>
                        <button type="button" className="primary-btn" onClick={() => handleApprove('add_and_check_in')} disabled={busy || !eventId}>
                            <span>{busy ? 'Saving...' : 'Approve & Check In'}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ScannerHome({ scannerUser, client, events, activeEventId, setActiveEventId, onLogout, onScanToken, onApproveVisitor, result, recentScans, loadingEvents, savingVisitor }) {
    const [manualToken, setManualToken] = useState('');
    const [scannerStatus, setScannerStatus] = useState('Preparing camera...');

    const activeEvent = useMemo(() => {
        return events.find((event) => event.id === activeEventId) || events[0] || null;
    }, [activeEventId, events]);

    function handleDetected(token) {
        onScanToken(token, activeEvent?.id, 'camera');
    }

    async function handleManualSubmit(event) {
        event.preventDefault();
        if (!manualToken.trim()) {
            return;
        }
        await onScanToken(manualToken.trim(), activeEvent?.id, 'manual');
        setManualToken('');
    }

    return (
        <div className="scanner-shell">
            <header className="scanner-topbar">
                <div>
                    <p className="eyebrow">Scanner Session</p>
                    <h1>{localizedName('en', client?.name, client?.name_ar)}</h1>
                </div>

                <button className="ghost-btn" onClick={onLogout} type="button">
                    <LogOut size={16} />
                    <span>Logout</span>
                </button>
            </header>

            <section className="scanner-hero">
                <div className="entity-card">
                    <UserCircle2 size={20} />
                    <div>
                        <span>Logged in as</span>
                        <strong>{scannerUser?.name}</strong>
                    </div>
                </div>

                <div className="entity-card">
                    <Smartphone size={20} />
                    <div>
                        <span>Ready for</span>
                        <strong>{loadingEvents ? 'Loading events...' : `${events.length} event(s)`}</strong>
                    </div>
                </div>
            </section>

            <section className="scanner-layout">
                <div className="scanner-panel camera-panel">
                    <div className="panel-head">
                        <div>
                            <p className="eyebrow">Live scan</p>
                            <h2>Scan the invitation QR</h2>
                        </div>
                        <div className="live-pill">
                            <span className="dot" />
                            Camera active
                        </div>
                    </div>

                    <label className="event-picker">
                        <span>Select event</span>
                        <select value={activeEventId} onChange={(e) => setActiveEventId(e.target.value)}>
                            {events.map((event) => (
                                <option key={event.id} value={event.id}>
                                    {localizedName('en', event.name, event.name_ar)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <CameraScanner enabled={Boolean(activeEvent)} onScan={handleDetected} onStatus={setScannerStatus} />

                    <p className="scanner-status">{scannerStatus}</p>

                    <form className="manual-form" onSubmit={handleManualSubmit}>
                        <input
                            value={manualToken}
                            onChange={(e) => setManualToken(e.target.value)}
                            placeholder="Paste invitation link or token"
                            autoComplete="off"
                        />
                        <button className="primary-btn" type="submit">
                            <ScanLine size={18} />
                            <span>Mark attended</span>
                        </button>
                    </form>

                    <VisitorIntakePanel
                        eventId={activeEvent?.id}
                        onApprove={onApproveVisitor}
                        busy={savingVisitor}
                        onSuccess={() => setScannerStatus('Visitor captured. Review the latest result panel for status.')}
                    />
                </div>

                <div className="scanner-panel results-panel">
                    <div className="panel-head">
                        <div>
                            <p className="eyebrow">Result</p>
                            <h2>Latest validation</h2>
                        </div>
                    </div>

                    {result ? (
                        <div className={`result-card ${result.status}`}>
                            <div className="result-badge">
                                <CheckCircle2 size={18} />
                                <span>{result.status}</span>
                            </div>
                            <h3>{localizedName('en', result.attendee?.name, result.attendee?.name_ar)}</h3>
                            <p>{localizedName('en', result.event?.name, result.event?.name_ar)}</p>
                            <div className="result-meta">
                                <span>Attendance: {result.attendee?.attendance_status}</span>
                                <span>{result.attendee?.attended_at ? toDate(result.attendee.attended_at) : 'Just now'}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <AlertTriangle size={32} />
                            <p>Waiting for the first scan.</p>
                        </div>
                    )}

                    <div className="recent-list">
                        <div className="recent-head">
                            <h3>Recent scans</h3>
                        </div>
                        {recentScans.length ? recentScans.map((scan, index) => (
                            <div key={`${scan.token}-${index}`} className={`recent-item ${scan.status}`}>
                                <strong>{scan.label}</strong>
                                <span>{scan.status}</span>
                            </div>
                        )) : (
                            <p className="recent-empty">No scans yet.</p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

export default function App() {
    const [bootstrapping, setBootstrapping] = useState(true);
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [error, setError] = useState(null);
    const [scannerUser, setScannerUser] = useState(null);
    const [client, setClient] = useState(null);
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [savingVisitor, setSavingVisitor] = useState(false);
    const [activeEventId, setActiveEventId] = useState('');
    const [result, setResult] = useState(null);
    const [recentScans, setRecentScans] = useState([]);

    useEffect(() => {
        const token = localStorage.getItem(SCANNER_STORAGE_KEY);

        if (!token) {
            setBootstrapping(false);
            return;
        }

        setEventsLoading(true);
        api.get('/scanner/me')
            .then(async (response) => {
                setScannerUser(response.data.data.scannerUser);
                setClient(response.data.data.client);
                return api.get('/scanner/events');
            })
            .then((response) => {
                const items = response.data.data || [];
                setEvents(items);
                setActiveEventId(items[0]?.id || '');
            })
            .catch(() => {
                localStorage.removeItem(SCANNER_STORAGE_KEY);
            })
            .finally(() => {
                setEventsLoading(false);
                setBootstrapping(false);
            });
    }, []);

    async function handleLogin(credentials) {
        setLoadingAuth(true);
        setError(null);

        try {
            const response = await api.post('/scanner/auth/login', credentials);
            const { accessToken, scannerUser: nextScannerUser } = response.data;
            localStorage.setItem(SCANNER_STORAGE_KEY, accessToken);
            setScannerUser(nextScannerUser);
            setClient({
                id: nextScannerUser.client_id,
                name: nextScannerUser.client_name,
                name_ar: nextScannerUser.client_name_ar
            });

            setEventsLoading(true);
            const eventsResponse = await api.get('/scanner/events');
            const items = eventsResponse.data.data || [];
            setEvents(items);
            setActiveEventId(items[0]?.id || '');
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to sign in');
        } finally {
            setLoadingAuth(false);
            setEventsLoading(false);
        }
    }

    function handleLogout() {
        localStorage.removeItem(SCANNER_STORAGE_KEY);
        setScannerUser(null);
        setClient(null);
        setEvents([]);
        setActiveEventId('');
        setResult(null);
        setRecentScans([]);
        setError(null);
        setSavingVisitor(false);
    }

    async function handleScanToken(token, eventId, mode) {
        if (!token) {
            return;
        }

        try {
            const response = await api.post('/scanner/scan', {
                token,
                eventId,
                mode
            });

            const nextResult = response.data.data;
            setResult(nextResult);
            setRecentScans((prev) => [
                {
                    token,
                    label: localizedName('en', nextResult.attendee?.name, nextResult.attendee?.name_ar),
                    status: nextResult.status
                },
                ...prev
            ].slice(0, 6));

            const eventsResponse = await api.get('/scanner/events');
            setEvents(eventsResponse.data.data || []);
        } catch (err) {
            setResult({
                status: 'failed',
                attendee: { name: 'Unknown guest', attendance_status: 'not_attended' },
                event: { name: err.response?.data?.message || 'Scan failed' }
            });
            setRecentScans((prev) => [
                {
                    token,
                    label: token.slice(0, 10),
                    status: 'failed'
                },
                ...prev
            ].slice(0, 6));
        }
    }

    async function handleApproveVisitor(payload) {
        setSavingVisitor(true);

        try {
            const response = await api.post('/scanner/visitor-intake/approve', payload);
            const nextResult = response.data.data;
            const activityStatus = nextResult.attendance ? 'attended' : 'added';

            setResult({
                status: activityStatus,
                attendee: {
                    id: nextResult.guest.id,
                    name: nextResult.guest.name,
                    name_ar: nextResult.guest.name,
                    attendance_status: nextResult.attendance ? 'checked_in' : 'guest_listed',
                    attended_at: nextResult.attendance?.checkedInAt || null
                },
                event: {
                    id: nextResult.attendance?.eventId || payload.eventId,
                    name: nextResult.attendance?.eventName || 'Added to guest list',
                    name_ar: nextResult.attendance?.eventNameAr || 'Added to guest list'
                }
            });

            setRecentScans((prev) => [
                {
                    token: nextResult.guest.id,
                    label: nextResult.guest.name,
                    status: activityStatus
                },
                ...prev
            ].slice(0, 6));

            return nextResult;
        } finally {
            setSavingVisitor(false);
        }
    }

    if (bootstrapping) {
        return (
            <div className="loading-screen">
                <div className="loading-card">
                    <Camera size={28} />
                    <p>Starting scanner...</p>
                </div>
            </div>
        );
    }

    if (!scannerUser) {
        return <LoginCard onLogin={handleLogin} loading={loadingAuth} error={error} />;
    }

    return (
        <ScannerHome
            scannerUser={scannerUser}
            client={client}
            events={events}
            activeEventId={activeEventId}
            setActiveEventId={setActiveEventId}
            onLogout={handleLogout}
            onScanToken={handleScanToken}
            onApproveVisitor={handleApproveVisitor}
            result={result}
            recentScans={recentScans}
            loadingEvents={eventsLoading}
            savingVisitor={savingVisitor}
        />
    );
}
