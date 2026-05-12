const MAX_DEBUG_LOGS = 300;
const DEBUG_EVENT_NAME = 'yahala:debug:update';

function ensureStore() {
    if (typeof window === 'undefined') {
        return null;
    }
    if (!window.__YAHALA_DEBUG_STORE__) {
        window.__YAHALA_DEBUG_STORE__ = {
            logs: [],
            handlersInstalled: false
        };
    }
    return window.__YAHALA_DEBUG_STORE__;
}

function safeSerialize(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return String(value);
    }
}

function notifyUpdate() {
    if (typeof window === 'undefined') {
        return;
    }
    window.dispatchEvent(new CustomEvent(DEBUG_EVENT_NAME));
}

export function addDebugLog(level, message, meta = null) {
    const store = ensureStore();
    if (!store) {
        return;
    }

    store.logs.push({
        ts: new Date().toISOString(),
        level,
        message,
        meta: meta == null ? null : safeSerialize(meta)
    });

    if (store.logs.length > MAX_DEBUG_LOGS) {
        store.logs.splice(0, store.logs.length - MAX_DEBUG_LOGS);
    }

    notifyUpdate();
}

export function getDebugLogs() {
    const store = ensureStore();
    return store ? [...store.logs] : [];
}

export function clearDebugLogs() {
    const store = ensureStore();
    if (!store) {
        return;
    }
    store.logs = [];
    notifyUpdate();
}

export function installDebugHandlers() {
    const store = ensureStore();
    if (!store || store.handlersInstalled) {
        return;
    }

    store.handlersInstalled = true;
    addDebugLog('info', 'Debug handlers installed');

    window.addEventListener('error', (event) => {
        addDebugLog('error', 'window.error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        addDebugLog('error', 'unhandledrejection', {
            reason: reason?.message || String(reason)
        });
    });
}

export function formatDebugLogsForClipboard() {
    return getDebugLogs()
        .map((entry, index) => {
            const header = `[${index + 1}] ${entry.ts} ${entry.level.toUpperCase()} ${entry.message}`;
            if (!entry.meta) {
                return header;
            }
            return `${header}\n${JSON.stringify(entry.meta, null, 2)}`;
        })
        .join('\n\n');
}

export { DEBUG_EVENT_NAME };
