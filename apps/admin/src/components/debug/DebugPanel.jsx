import { useEffect, useMemo, useState } from 'react';
import { addDebugLog, clearDebugLogs, DEBUG_EVENT_NAME, formatDebugLogsForClipboard, getDebugLogs } from '../../utils/debugLogger';

export default function DebugPanel() {
    const [open, setOpen] = useState(false);
    const [logs, setLogs] = useState(() => getDebugLogs());
    const [copyState, setCopyState] = useState('');

    useEffect(() => {
        const fromStorage = window.localStorage.getItem('yahala-debug-panel') === '1';
        const fromQuery = new URLSearchParams(window.location.search).get('debug') === '1';
        setOpen(fromStorage || fromQuery);
    }, []);

    useEffect(() => {
        function onUpdate() {
            setLogs(getDebugLogs());
        }
        window.addEventListener(DEBUG_EVENT_NAME, onUpdate);
        return () => window.removeEventListener(DEBUG_EVENT_NAME, onUpdate);
    }, []);

    useEffect(() => {
        function onKeydown(event) {
            if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
                event.preventDefault();
                const nextOpen = !open;
                setOpen(nextOpen);
                window.localStorage.setItem('yahala-debug-panel', nextOpen ? '1' : '0');
                addDebugLog('info', `Debug panel ${nextOpen ? 'opened' : 'closed'} via keyboard`);
            }
        }
        window.addEventListener('keydown', onKeydown);
        return () => window.removeEventListener('keydown', onKeydown);
    }, [open]);

    const logText = useMemo(() => formatDebugLogsForClipboard(), [logs]);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(logText || 'No debug logs yet.');
            setCopyState('Copied');
            setTimeout(() => setCopyState(''), 1200);
        } catch (error) {
            setCopyState('Copy failed');
            addDebugLog('error', 'Clipboard copy failed', { error: error?.message || String(error) });
            setTimeout(() => setCopyState(''), 1200);
        }
    }

    if (!open) {
        return null;
    }

    return (
        <div style={{ position: 'fixed', right: 12, bottom: 12, width: 460, maxWidth: 'calc(100vw - 24px)', zIndex: 12000, background: 'rgba(27, 19, 33, 0.94)', color: '#f9f7ff', border: '1px solid rgba(187,165,214,0.45)', borderRadius: 14, boxShadow: '0 18px 48px -26px rgba(0,0,0,0.6)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Debug Console</strong>
                <small style={{ opacity: 0.8 }}>Ctrl+Shift+D</small>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={handleCopy}>{copyState || 'Copy logs'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => clearDebugLogs()}>Clear</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setOpen(false); window.localStorage.setItem('yahala-debug-panel', '0'); }}>Close</button>
            </div>
            <textarea readOnly value={logText || 'No debug logs yet.'} style={{ width: '100%', height: 220, resize: 'vertical', borderRadius: 10, border: '1px solid rgba(187,165,214,0.35)', background: 'rgba(15, 10, 19, 0.9)', color: '#f9f7ff', padding: 10, fontSize: 12, lineHeight: 1.35 }} />
        </div>
    );
}
