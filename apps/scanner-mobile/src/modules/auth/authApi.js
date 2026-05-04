import api from '../../shared/api/client';

export async function loginScanner({ clientIdentifier, name, pin }) {
    const response = await api.post('/scanner/auth/login', {
        clientIdentifier,
        name,
        pin
    });

    const payload = response.data?.data || response.data;
    return {
        accessToken: payload.accessToken,
        scannerUser: payload.scannerUser
    };
}
