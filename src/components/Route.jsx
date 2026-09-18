// --- IMPORTS ---
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, ShieldAlert } from 'lucide-react';
import logoImage from '../assets/logo.jpg';
import { Badge } from './Badge';
import { Button } from './Button';
import { Container } from './Container';
import { authService } from '../services';
import { constants } from '../constants';


// --- CONFIGURATIONS ---
const CONTAINER_BASE_STYLE = 'flex-1 py-12 flex flex-col items-center justify-center p-6 text-center select-none';
const SHIELD_ICON_STYLE = 'h-10 w-10 shrink-0';
const LOGO_STYLE = 'h-12 w-12 rounded-full object-cover bg-surface shadow-md animate-pulse shrink-0';


// --- COMPONENTS ---
const RouteLoader = () => {
    // RENDER
    return (
        <div className="min-h-screen bg-surface text-text flex items-center justify-center select-none">
            <div className="flex flex-col items-center gap-3">
                <img
                    src={logoImage}
                    alt="Pamantasan Records"
                    className={LOGO_STYLE}
                />
                <span className="text-xs text-text-muted">Loading records system...</span>
            </div>
        </div>
    );
};

const DenyRoute = ({
    currentUser = null,
    requiredRoleLabel = 'Administrator or Coordinator',
    className,
    ...props
}) => {
    // HOOKS
    const navigate = useNavigate();

    // HANDLERS
    const handleNavigateDashboard = () => {
        navigate('/dashboard');
    };

    const handleNavigateBack = () => {
        navigate(-1);
    };

    // DERIVED VALUES
    const userRole = currentUser?.role ?? constants.USERS_ROLE.MEMBER;

    // RENDER
    return (
        <div
            className={`${CONTAINER_BASE_STYLE} ${className ?? ''}`.trim()}
            {...props}
        >
            <Container variant="panel" className="max-w-md w-full items-center text-center">
                <div className="p-4 rounded-full bg-error-background text-error border border-error-border">
                    <ShieldAlert className={SHIELD_ICON_STYLE} />
                </div>

                <div className="flex flex-col gap-2 items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-error">
                        Clearance Level Insufficient
                    </span>
                    <h2 className="text-xl font-bold text-text">
                        403 Access Denied
                    </h2>
                    <p className="text-xs text-text-muted leading-relaxed max-w-sm">
                        You do not possess the required institutional authorization to access this administrative module.
                    </p>
                </div>

                <div className="w-full p-3 rounded-md bg-surface-hover border border-surface-border flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-text-muted">Your Current Role:</span>
                        <Badge variant="error" label={userRole} />
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-border pt-2">
                        <span className="text-text-muted">Required Clearance:</span>
                        <span className="font-semibold text-text">{requiredRoleLabel}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full pt-2">
                    <Button
                        variant="secondary"
                        leadingIcon={ArrowLeft}
                        onClick={handleNavigateBack}
                        className="flex-1 justify-center"
                    >
                        Go Back
                    </Button>
                    <Button
                        variant="primary"
                        leadingIcon={LayoutDashboard}
                        onClick={handleNavigateDashboard}
                        className="flex-1 justify-center"
                    >
                        Dashboard
                    </Button>
                </div>
            </Container>
        </div>
    );
};

const ProtectedRoute = ({
    currentUser = null,
    isLoading = false,
    allowedRoles = null,
    requiredRoleLabel,
    allowPending = false,
    children = null,
}) => {
    // HOOKS
    const location = useLocation();

    // GUARD CLAUSES
    if (isLoading && !currentUser) {
        return null;
    }

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!allowPending) {
        if (currentUser.status === constants.USERS_STATUS.PENDING_PASSWORD) {
            return <Navigate to="/onboarding" replace />;
        }
        if (currentUser.status === constants.USERS_STATUS.PENDING_SSO) {
            if (!authService.hasSkippedSSOOnboarding(currentUser.id)) {
                return <Navigate to="/onboarding" replace />;
            }
        }
    }

    if (allowedRoles && Array.isArray(allowedRoles)) {
        const hasMatchingRole = allowedRoles.some((r) => {
            if (r === currentUser?.role) return true;
            if (String(r).toUpperCase() === String(currentUser?.role).toUpperCase()) return true;
            if ((r === constants.USERS_ROLE.ADMINISTRATOR || r === constants.USERS_ROLE.COORDINATOR) && constants.isStaffRole(currentUser?.role)) return true;
            return false;
        });
        if (!hasMatchingRole) {
            return (
                <DenyRoute
                    currentUser={currentUser}
                    requiredRoleLabel={requiredRoleLabel}
                />
            );
        }
    }

    // RENDER
    return children ?? <Outlet />;
};

const PublicRoute = ({
    currentUser = null,
    isLoading = false,
    children = null,
}) => {
    // HOOKS
    const location = useLocation();

    if (currentUser) {
        let destination = location.state?.from?.pathname ?? '/dashboard';
        if (currentUser.status === constants.USERS_STATUS.PENDING_PASSWORD) {
            destination = '/onboarding';
        } else if (currentUser.status === constants.USERS_STATUS.PENDING_SSO) {
            if (!authService.hasSkippedSSOOnboarding(currentUser.id)) {
                destination = '/onboarding';
            }
        }
        return <Navigate to={destination} replace />;
    }

    // RENDER
    return children ?? <Outlet />;
};


// --- EXPORTS ---
export {
    DenyRoute,
    ProtectedRoute,
    PublicRoute,
};
