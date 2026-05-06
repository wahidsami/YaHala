import api from '../../shared/api/client';
import { appendRuntimeLogIfEnabled } from '../../shared/debug/runtimeLogger';

export async function loginScanner({ clientIdentifier, name, pin }) {
    await appendRuntimeLogIfEnabled(`auth:login:start client=${(clientIdentifier || '').slice(0, 3)}*** name=${name || ''}`);
    const response = await api.post('/scanner/auth/login', {
        clientIdentifier,
        name,
        pin
    });

    const payload = response.data?.data || response.data;
    await appendRuntimeLogIfEnabled(`auth:login:success scannerUserId=${payload?.scannerUser?.id || 'unknown'}`);
    return {
        accessToken: payload.accessToken,
        scannerUser: payload.scannerUser
    };
}
