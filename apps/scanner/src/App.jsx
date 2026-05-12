import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronRight, LogOut, ShieldCheck, Smartphone, UserCircle2 } from 'lucide-react';
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

function CameraScanner({ enabled, paused, onScan, onStatus }) {
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
            if (paused) {
                return;
            }

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
    }, [enabled, paused]);

    return (
        <div className="scanner-camera">
            <video ref={videoRef} playsInline muted autoPlay />
        </div>
    );
}

function ScanResultModal({ open, payload, busy, onConfirm, onClose }) {
    if (!open || !payload) {
        return null;
    }

    const isDuplicate = payload.status === 'duplicate';
    const name = localizedName('en', payload.attendee?.name, payload.attendee?.name_ar) || 'Guest';
    const attendedAt = payload.attendee?.attended_at ? toDate(payload.attendee.attended_at) : 'Unknown time';

    return (
        <div className="scan-modal-overlay">
            <div className="scan-modal-card">
                <h3>{isDuplicate ? 'Already checked in' : 'Guest found'}</h3>
                <p className="scan-modal-name">{name}</p>
                <p className="scan-modal-event">{localizedName('en', payload.event?.name, payload.event?.name_ar)}</p>

                {isDuplicate ? (
                    <p className="scan-modal-copy">This QR was already scanned on {attendedAt}.</p>
                ) : (
                    <p className="scan-modal-copy">Review details then confirm check-in.</p>
                )}

                <div className="scan-modal-actions">
                    {isDuplicate ? (
                        <button type="button" className="primary-btn" onClick={onClose}>OK</button>
                    ) : (
                        <>
                            <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
                            <button type="button" className="primary-btn" onClick={onConfirm} disabled={busy}>
                                {busy ? 'Checking in...' : 'Check In'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ScannerHome({ scannerUser, client, events, activeEventId, setActiveEventId, onLogout, onScanToken, result, recentScans, loadingEvents, pendingScan, scanModalOpen, scanConfirming, scanBusy, onConfirmPendingScan, onCloseScanModal }) {
    const [scannerStatus, setScannerStatus] = useState('Preparing camera...');

    const activeEvent = useMemo(() => {
        return events.find((event) => event.id === activeEventId) || events[0] || null;
    }, [activeEventId, events]);

    function handleDetected(token) {
        onScanToken(token, activeEvent?.id, 'camera');
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

            <section className="scanner-layout single-column">
                <div className="scanner-panel camera-panel">
                    <div className="panel-head">
                        <div>
                            <p className="eyebrow">Live scan</p>
                            <h2>Scan the invitation QR</h2>
                        </div>
                        <div className="live-pill">
                            <span className="dot" />
                            {scanBusy ? 'Processing...' : 'Camera active'}
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

                    <CameraScanner enabled={Boolean(activeEvent)} paused={scanModalOpen || scanConfirming || scanBusy} onScan={handleDetected} onStatus={setScannerStatus} />

                    <p className="scanner-status">{scannerStatus}</p>
                    {result && (
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
                    )}
                </div>
            </section>

            <section className="scanner-layout single-column">
                <div className="scanner-panel results-panel">
                    <div className="panel-head">
                        <div>
                            <p className="eyebrow">Result</p>
                            <h2>Recent scans</h2>
                        </div>
                    </div>
                    <div className="recent-list">
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

            <ScanResultModal
                open={scanModalOpen}
                payload={pendingScan}
                busy={scanConfirming}
                onConfirm={onConfirmPendingScan}
                onClose={onCloseScanModal}
            />
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
    const [activeEventId, setActiveEventId] = useState('');
    const [result, setResult] = useState(null);
    const [recentScans, setRecentScans] = useState([]);
    const [pendingScan, setPendingScan] = useState(null);
    const [scanModalOpen, setScanModalOpen] = useState(false);
    const [scanConfirming, setScanConfirming] = useState(false);
    const [scanBusy, setScanBusy] = useState(false);

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
        setPendingScan(null);
        setScanModalOpen(false);
        setScanConfirming(false);
        setScanBusy(false);
    }

    async function handleScanToken(token, eventId, mode) {
        if (!token || scanBusy || scanModalOpen || scanConfirming) {
            return;
        }
        setScanBusy(true);

        try {
            const response = await api.post('/scanner/scan', {
                token,
                eventId,
                mode,
                confirmCheckIn: false
            });

            const nextResult = response.data.data;
            setPendingScan({
                ...nextResult,
                token,
                eventId,
                mode
            });
            setScanModalOpen(true);

            if (nextResult.status === 'duplicate') {
                setResult(nextResult);
                setRecentScans((prev) => [
                    {
                        token,
                        label: localizedName('en', nextResult.attendee?.name, nextResult.attendee?.name_ar),
                        status: nextResult.status
                    },
                    ...prev
                ].slice(0, 6));
            }
            setScanBusy(false);
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
            setScanBusy(false);
        }
    }

    async function handleConfirmPendingScan() {
        if (!pendingScan?.token) {
            return;
        }

        setScanConfirming(true);
        try {
            const response = await api.post('/scanner/scan', {
                token: pendingScan.token,
                eventId: pendingScan.eventId,
                mode: pendingScan.mode || 'camera',
                confirmCheckIn: true
            });
            const nextResult = response.data.data;
            setResult(nextResult);
            setRecentScans((prev) => [
                {
                    token: pendingScan.token,
                    label: localizedName('en', nextResult.attendee?.name, nextResult.attendee?.name_ar),
                    status: nextResult.status
                },
                ...prev
            ].slice(0, 6));
            const eventsResponse = await api.get('/scanner/events');
            setEvents(eventsResponse.data.data || []);
            setScanModalOpen(false);
            setPendingScan(null);
            setScanBusy(false);
        } catch (err) {
            setResult({
                status: 'failed',
                attendee: { name: 'Unknown guest', attendance_status: 'not_attended' },
                event: { name: err.response?.data?.message || 'Check-in failed' }
            });
            setScanModalOpen(false);
            setPendingScan(null);
            setScanBusy(false);
        } finally {
            setScanConfirming(false);
        }
    }

    function handleCloseScanModal() {
        setScanModalOpen(false);
        setPendingScan(null);
        setScanBusy(false);
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
            result={result}
            recentScans={recentScans}
            loadingEvents={eventsLoading}
            pendingScan={pendingScan}
            scanModalOpen={scanModalOpen}
            scanConfirming={scanConfirming}
            scanBusy={scanBusy}
            onConfirmPendingScan={handleConfirmPendingScan}
            onCloseScanModal={handleCloseScanModal}
        />
    );
}
