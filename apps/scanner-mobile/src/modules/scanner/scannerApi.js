import api from '../../shared/api/client';
import { appendRuntimeLogIfEnabled } from '../../shared/debug/runtimeLogger';

function unwrap(response) {
    return response.data?.data ?? response.data;
}

export async function fetchScannerProfile() {
    await appendRuntimeLogIfEnabled('api:fetchScannerProfile:start');
    const response = await api.get('/scanner/me');
    await appendRuntimeLogIfEnabled('api:fetchScannerProfile:success');
    return unwrap(response);
}

export async function fetchScannerEvents() {
    await appendRuntimeLogIfEnabled('api:fetchScannerEvents:start');
    const response = await api.get('/scanner/events');
    const payload = unwrap(response) || [];
    await appendRuntimeLogIfEnabled(`api:fetchScannerEvents:success count=${Array.isArray(payload) ? payload.length : 0}`);
    return payload;
}

export async function fetchEventStats(eventId) {
    if (!eventId) return null;
    await appendRuntimeLogIfEnabled(`api:fetchEventStats:start eventId=${eventId}`);
    const response = await api.get(`/scanner/events/${eventId}/stats`);
    await appendRuntimeLogIfEnabled(`api:fetchEventStats:success eventId=${eventId}`);
    return unwrap(response);
}

export async function submitScan({ token, eventId, mode = 'manual' }) {
    const response = await api.post('/scanner/scan', {
        token,
        eventId,
        mode
    });

    return unwrap(response);
}

export async function fetchEventAddons(eventId) {
    if (!eventId) return [];
    const response = await api.get(`/scanner/events/${eventId}/addons`);
    return unwrap(response) || [];
}

export async function fetchRecipientAddons(recipientId) {
    if (!recipientId) return [];
    const response = await api.get(`/scanner/recipients/${recipientId}/addons`);
    return unwrap(response) || [];
}

export async function enableRecipientAddon({ recipientId, pageKey }) {
    const response = await api.post(`/scanner/recipients/${recipientId}/addons/${encodeURIComponent(pageKey)}/enable`);
    return unwrap(response);
}

export async function extractVisitorFromTranscript({ transcript, language = 'en' }) {
    const response = await api.post('/scanner/visitor-intake/voice-extract', {
        transcript,
        language
    });

    return unwrap(response);
}

export async function transcribeVisitorAudio({ audioBase64, mimeType = 'audio/m4a', language = 'en' }) {
    const response = await api.post('/scanner/visitor-intake/voice-transcribe', {
        audioBase64,
        mimeType,
        language
    });

    return unwrap(response);
}

export async function approveVisitorIntake(payload) {
    const response = await api.post('/scanner/visitor-intake/approve', payload);
    return unwrap(response);
}
