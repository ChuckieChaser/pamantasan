// --- IMPORTS ---
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import logoImage from '../assets/logo.jpg';
import { AccessDenied } from './AccessDenied';

// --- COMPONENTS ---
export const ProtectedRoute = ({
    currentUser = null,
    isLoading = false,
    allowedRoles = null,
    requiredRoleLabel,
    children = null,
}) => {
    // HOOKS
    const location = useLocation();

    // 1. GUARD: SESSION RESTORATION LOADING
    if (isLoading && !currentUser) {
        return (
            <div className="min-h-screen bg-surface text-text flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <img
                        src={logoImage}
                        alt="Pamantasan Records"
                        className="h-12 w-12 rounded-full object-cover bg-surface shadow-md animate-pulse shrink-0"
                    />
                    <span className="text-xs text-text-muted">Loading records system...</span>
                </div>
            </div>
        );
    }

    // 2. GUARD: UNAUTHENTICATED GUEST
    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. GUARD: ROLE AUTHORIZATION CHECK
    if (allowedRoles && Array.isArray(allowedRoles) && !allowedRoles.includes(currentUser.role)) {
        return (
            <AccessDenied
                currentUser={currentUser}
                requiredRoleLabel={requiredRoleLabel}
            />
        );
    }

    // 4. AUTHORIZED RENDER
    return children ?? <Outlet />;
};

export default ProtectedRoute;
