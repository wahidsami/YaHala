import axios from 'axios';

export const SCANNER_STORAGE_KEY = 'rawaj-scanner-access-token';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
    withCredentials: true
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem(SCANNER_STORAGE_KEY);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem(SCANNER_STORAGE_KEY);
        }
        return Promise.reject(error);
    }
);

export default api;
