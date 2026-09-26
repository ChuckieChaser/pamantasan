// --- IMPORTS ---
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { LoaderRoute } from './LoaderRoute';


// --- COMPONENTS ---
export const PublicRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <LoaderRoute />;
    }

    if (isAuthenticated) {
        const fromPath = location.state?.from?.pathname || '/dashboard';
        return <Navigate to={fromPath} replace />;
    }

    return children ? children : <Outlet />;
};
