import api from '../../shared/api/client';
import { appendRuntimeLogIfEnabled } from '../../shared/debug/runtimeLogger';

export async function loginScanner({ clientIdentifier, name, pin, eventId }) {
    await appendRuntimeLogIfEnabled(`auth:login:start client=${(clientIdentifier || '').slice(0, 3)}*** name=${name || ''}`);
    const response = await api.post('/scanner/auth/login', {
        clientIdentifier,
        name,
        pin,
        eventId: eventId || undefined
    });

    const payload = response.data?.data || response.data;
    if (payload?.requiresEventSelection) {
        await appendRuntimeLogIfEnabled(`auth:login:event_selection_required events=${Array.isArray(payload?.events) ? payload.events.length : 0}`);
        return {
            requiresEventSelection: true,
            events: payload.events || [],
            scannerUser: payload.scannerUser || null
        };
    }

    await appendRuntimeLogIfEnabled(`auth:login:success scannerUserId=${payload?.scannerUser?.id || 'unknown'}`);
    return {
        accessToken: payload.accessToken,
        scannerUser: payload.scannerUser,
        requiresEventSelection: false
    };
}
