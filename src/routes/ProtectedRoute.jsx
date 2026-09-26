// --- IMPORTS ---
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { LoaderRoute } from './LoaderRoute';


// --- COMPONENTS ---
export const ProtectedRoute = ({
    requiredRoles = null,
    children,
}) => {
    const { currentUser, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <LoaderRoute />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requiredRoles && requiredRoles.length > 0) {
        const userRole = currentUser?.role;
        const hasRequiredRole = requiredRoles.includes(userRole);

        if (!hasRequiredRole) {
            return <Navigate to="/denied" replace />;
        }
    }

    return children ? children : <Outlet />;
};
