import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'scanner_mobile_access_token';

export async function saveAccessToken(token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getAccessToken() {
    return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearAccessToken() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}
