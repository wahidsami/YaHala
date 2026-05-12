import axios from 'axios';
import { addDebugLog } from '../utils/debugLogger';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
    withCredentials: true
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    addDebugLog('info', 'api.request', {
        method: config.method,
        url: config.url
    });
    return config;
});

// Response interceptor - handle token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => {
        addDebugLog('info', 'api.response', {
            status: response.status,
            method: response.config?.method,
            url: response.config?.url
        });
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        addDebugLog('error', 'api.error', {
            status: error.response?.status,
            method: originalRequest?.method,
            url: originalRequest?.url,
            message: error.response?.data?.message || error.message
        });
        const skipAuthRefresh =
            originalRequest?.skipAuthRefresh ||
            originalRequest?.url?.includes('/admin/auth/login') ||
            originalRequest?.url?.includes('/admin/auth/refresh') ||
            originalRequest?.url?.includes('/admin/auth/logout');

        if (skipAuthRefresh) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await api.post('/admin/auth/refresh');
                const { accessToken } = response.data;

                localStorage.setItem('accessToken', accessToken);
                api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
                processQueue(null, accessToken);

                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                localStorage.removeItem('accessToken');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
