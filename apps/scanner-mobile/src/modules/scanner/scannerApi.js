import api from '../../shared/api/client';

function unwrap(response) {
    return response.data?.data ?? response.data;
}

export async function fetchScannerProfile() {
    const response = await api.get('/scanner/me');
    return unwrap(response);
}

export async function fetchScannerEvents() {
    const response = await api.get('/scanner/events');
    return unwrap(response) || [];
}

export async function fetchEventStats(eventId) {
    if (!eventId) return null;
    const response = await api.get(`/scanner/events/${eventId}/stats`);
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
