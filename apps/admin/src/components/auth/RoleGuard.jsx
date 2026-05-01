import { useAuth } from '../../contexts/AuthContext';

export default function RoleGuard({ permission, children, fallback = null }) {
    const { hasPermission, hasAnyPermission } = useAuth();

    const hasAccess = Array.isArray(permission)
        ? hasAnyPermission(permission)
        : hasPermission(permission);

    if (!hasAccess) {
        return fallback;
    }

    return children;
}
