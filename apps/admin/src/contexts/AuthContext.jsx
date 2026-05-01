import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const isPublicInvitationRoute =
            location.pathname.startsWith('/invite/') ||
            location.pathname.startsWith('/i/');

        if (isPublicInvitationRoute) {
            setIsLoading(false);
            return;
        }

        const token = localStorage.getItem('accessToken');
        if (token && !user) {
            restoreSession();
            return;
        }

        setIsLoading(false);
    }, [location.pathname]);

    async function restoreSession() {
        try {
            const refreshResponse = await api.post('/admin/auth/refresh', {}, { skipAuthRefresh: true });
            const { accessToken } = refreshResponse.data;

            localStorage.setItem('accessToken', accessToken);
            api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

            await fetchCurrentUser(accessToken);
        } catch (err) {
            localStorage.removeItem('accessToken');
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchCurrentUser(token = localStorage.getItem('accessToken')) {
        try {
            const response = await api.get('/admin/auth/me', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                skipAuthRefresh: true
            });
            setUser(response.data.user);
        } catch (err) {
            localStorage.removeItem('accessToken');
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }

    async function login(email, password) {
        setError(null);
        try {
            const response = await api.post('/admin/auth/login', { email, password }, { skipAuthRefresh: true });
            const { accessToken, user: userData } = response.data;

            localStorage.setItem('accessToken', accessToken);
            setUser(userData);

            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || 'Login failed';
            setError(message);
            return { success: false, error: message };
        }
    }

    async function logout() {
        try {
            await api.post('/admin/auth/logout', {}, { skipAuthRefresh: true });
        } catch (err) {
            // Ignore errors
        } finally {
            localStorage.removeItem('accessToken');
            setUser(null);
        }
    }

    function hasPermission(permission) {
        if (!user) return false;
        if (user.role === 'super_admin') return true;
        return user.permissions?.includes(permission);
    }

    function hasAnyPermission(permissions) {
        return permissions.some(p => hasPermission(p));
    }

    function clearError() {
        setError(null);
    }

    const value = {
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        clearError
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
