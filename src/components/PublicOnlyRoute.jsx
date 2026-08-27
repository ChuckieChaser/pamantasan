// --- IMPORTS ---
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import logoImage from '../assets/logo.jpg';

// --- COMPONENTS ---
export const PublicOnlyRoute = ({
    currentUser = null,
    isLoading = false,
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

    // 2. GUARD: ALREADY AUTHENTICATED -> REDIRECT TO DASHBOARD
    if (currentUser) {
        const originPath = location.state?.from?.pathname ?? '/dashboard';
        return <Navigate to={originPath} replace />;
    }

    // 3. UNAUTHENTICATED GUEST -> ALLOW ACCESS TO PUBLIC PAGE
    return children ?? <Outlet />;
};

export default PublicOnlyRoute;
