// --- IMPORTS ---
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from './Button';
import { RoleBadge } from './Badge';

// --- CONFIGURATIONS ---
const CONTAINER_BASE_STYLE =
    'min-h-[70vh] flex flex-col items-center justify-center p-6 text-center select-none';

// --- COMPONENTS ---
export const AccessDenied = ({
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
    const userRole = currentUser?.role ?? 'MEMBER';

    return (
        <div
            className={`${CONTAINER_BASE_STYLE} ${className ?? ''}`}
            {...props}
        >
            <div className="max-w-md w-full p-8 rounded-2xl bg-surface border border-surface-border shadow-sm flex flex-col items-center gap-5">
                <div className="p-4 rounded-full bg-error-background text-error border border-error-border">
                    <ShieldAlert className="h-10 w-10 stroke-[1.5]" />
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

                <div className="w-full p-3 rounded-lg bg-surface-hover border border-surface-border flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-text-muted">Your Current Role:</span>
                        <RoleBadge role={userRole} />
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-border pt-2">
                        <span className="text-text-muted">Required Clearance:</span>
                        <span className="font-semibold text-text">{requiredRoleLabel}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full pt-2">
                    <SecondaryButton
                        size="md"
                        leadingIcon={ArrowLeft}
                        onClick={handleNavigateBack}
                        className="flex-1 justify-center"
                    >
                        Go Back
                    </SecondaryButton>
                    <PrimaryButton
                        size="md"
                        leadingIcon={LayoutDashboard}
                        onClick={handleNavigateDashboard}
                        className="flex-1 justify-center"
                    >
                        Dashboard
                    </PrimaryButton>
                </div>
            </div>
        </div>
    );
};

export default AccessDenied;
