import * as FileSystem from 'expo-file-system';

const LOG_FILE = 'runtime-log.txt';
const MAX_LOG_SIZE_BYTES = 512 * 1024;

function nowIso() {
    return new Date().toISOString();
}

function formatError(errorLike) {
    if (!errorLike) return 'Unknown error';
    if (typeof errorLike === 'string') return errorLike;
    if (errorLike instanceof Error) return `${errorLike.name}: ${errorLike.message}\n${errorLike.stack || ''}`;
    try {
        return JSON.stringify(errorLike);
    } catch {
        return String(errorLike);
    }
}

export function getRuntimeLogPath() {
    return `${FileSystem.documentDirectory}${LOG_FILE}`;
}

export async function appendRuntimeLog(message) {
    const path = getRuntimeLogPath();
    const line = `[${nowIso()}] ${message}\n`;

    try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists && info.size > MAX_LOG_SIZE_BYTES) {
            await FileSystem.deleteAsync(path, { idempotent: true });
        }
    } catch {
        // Best effort only.
    }

    try {
        await FileSystem.writeAsStringAsync(path, line, {
            encoding: FileSystem.EncodingType.UTF8,
            append: true
        });
    } catch {
        // Avoid crashing when logger cannot write.
    }
}

export async function readRuntimeLog() {
    const path = getRuntimeLogPath();
    try {
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return '';
        return await FileSystem.readAsStringAsync(path);
    } catch {
        return '';
    }
}

export function installRuntimeErrorLogging() {
    appendRuntimeLog('App process started');

    const originalErrorHandler = global.ErrorUtils?.getGlobalHandler?.();
    if (global.ErrorUtils?.setGlobalHandler) {
        global.ErrorUtils.setGlobalHandler((error, isFatal) => {
            appendRuntimeLog(`UNCAUGHT_JS_ERROR fatal=${String(isFatal)} ${formatError(error)}`);
            if (originalErrorHandler) {
                originalErrorHandler(error, isFatal);
            }
        });
    }

    const originalConsoleError = console.error;
    console.error = (...args) => {
        appendRuntimeLog(`CONSOLE_ERROR ${args.map((item) => formatError(item)).join(' | ')}`);
        originalConsoleError(...args);
    };

    if (typeof globalThis.addEventListener === 'function') {
        globalThis.addEventListener('unhandledrejection', (event) => {
            appendRuntimeLog(`UNHANDLED_REJECTION ${formatError(event?.reason)}`);
        });
    }
}
