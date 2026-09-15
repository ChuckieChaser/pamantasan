// --- IMPORTS ---
import { useState, useEffect } from 'react';
import {
    Key,
    Building2,
    User,
    Mail,
    Shield,
    CheckCircle2,
    Sparkles,
} from 'lucide-react';
import { Avatar, resolveUserAvatar } from '../Avatar';
import { Badge } from '../Badge';
import { Modal } from '../Modal';
import { useAuth } from '../../hooks';
import { constants } from '../../constants';

// --- CONFIGURATIONS ---
const STATUS_BADGE_VARIANT = {
    [constants.USERS_STATUS.VERIFIED]: 'success',
    [constants.USERS_STATUS.PENDING_PASSWORD]: 'warning',
    [constants.USERS_STATUS.PENDING_SSO]: 'information',
    [constants.USERS_STATUS.SUSPENDED]: 'error',
};

// --- COMPONENTS ---
const Account = ({
    isOpen = false,
    onClose,
    currentUser = null,
    user = null,
    className,
    ...props
}) => {
    // HOOKS
    const { currentUser: authUser } = useAuth();
    const activeTargetUser = user ?? currentUser ?? authUser;
    const isSelf = Boolean(activeTargetUser?.id && authUser?.id && activeTargetUser.id === authUser.id);

    // REACTIVE LISTENER FOR AVATAR CHANGES
    const [avatarVersion, setAvatarVersion] = useState(0);
    useEffect(() => {
        const handler = () => setAvatarVersion((v) => v + 1);
        window.addEventListener('pamantasan-avatar-changed', handler);
        return () => window.removeEventListener('pamantasan-avatar-changed', handler);
    }, []);

    // DERIVED VALUES
    const userName = `${activeTargetUser?.firstName ?? ''} ${activeTargetUser?.lastName ?? ''}`.trim() || activeTargetUser?.name || activeTargetUser?.email || 'User';
    const userFirstName = activeTargetUser?.firstName ?? '';
    const userMiddleName = activeTargetUser?.middleName ?? null;
    const userLastName = activeTargetUser?.lastName ?? '';
    const userUniversityId = activeTargetUser?.universityId ?? '—';
    const userEmail = activeTargetUser?.email ?? '—';
    const userDepartment = activeTargetUser?.department ?? 'Central Administration';
    const userDepartmentCode = activeTargetUser?.departmentCode ?? null;
    const userRole = activeTargetUser?.role ?? constants.USERS_ROLE.MEMBER;
    const userStatus = activeTargetUser?.status ?? constants.USERS_STATUS.VERIFIED;
    const userAvatar = resolveUserAvatar(activeTargetUser, authUser);

    const modalSecondaryAction = {
        label: 'Close',
        onClick: onClose,
    };

    // RENDER
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isSelf ? 'Account Profile' : `${userRole} Profile`}
            description="Official university credentials and profile identity"
            icon={User}
            callout="Verified university credentials, active department assignments, and security profile details."
            calloutVariant="neutral"
            size="lg"
            secondaryAction={modalSecondaryAction}
            className={className}
            {...props}
        >
            {/* HERO PROFILE CARD */}
            <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-surface via-surface to-surface-hover/60 border border-surface-border shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="relative shrink-0">
                    <div className="p-1 rounded-full bg-surface border border-surface-border shadow-sm">
                        <Avatar
                            src={userAvatar}
                            user={activeTargetUser}
                            alt={userName}
                            size="extraLarge"
                            className="h-20 w-20 ring-2 ring-accent/30"
                        />
                    </div>
                    {userStatus === constants.USERS_STATUS.VERIFIED && (
                        <div
                            className="absolute -bottom-1 -right-1 p-1 bg-surface rounded-full shadow-sm"
                            title="Verified Institutional Account"
                        >
                            <CheckCircle2 className="h-5 w-5 text-accent fill-accent/20" />
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center sm:items-start gap-1.5 flex-1 min-w-0 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h3 className="text-lg font-bold font-serif text-text tracking-tight">
                            {userName}
                        </h3>
                        <Badge
                            variant="neutral"
                            label={userRole}
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-text-muted">
                        <span className="font-semibold text-text font-mono">
                            {userUniversityId}
                        </span>
                        <span>·</span>
                        <span className="truncate">{userEmail}</span>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <Badge
                            variant={STATUS_BADGE_VARIANT[userStatus] ?? 'neutral'}
                            label={userStatus}
                        />
                        {userDepartment && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-hover border border-surface-border text-text-muted">
                                <Building2 className="h-3 w-3 text-accent" />
                                <span>{userDepartmentCode ? `${userDepartmentCode} — ` : ''}{userDepartment}</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* DETAILS GRID (READ ONLY) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                {/* UNIVERSITY ID */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <Key className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">University ID</span>
                        <span className="font-mono font-bold text-sm text-text truncate">{userUniversityId}</span>
                    </div>
                </div>

                {/* DEPARTMENT */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Department</span>
                        <span className="font-semibold text-text truncate" title={userDepartment}>{userDepartment}</span>
                    </div>
                </div>

                {/* FULL NAME */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Full Name</span>
                        <span className="font-semibold text-text truncate">
                            {userFirstName} {userMiddleName ? `${userMiddleName} ` : ''}{userLastName}
                        </span>
                    </div>
                </div>

                {/* EMAIL */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Email</span>
                        <span className="font-semibold text-text truncate" title={userEmail}>{userEmail}</span>
                    </div>
                </div>

                {/* ROLE */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <Shield className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Role</span>
                        <div>
                            <Badge variant="neutral" label={userRole} />
                        </div>
                    </div>
                </div>

                {/* STATUS */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Account Status</span>
                        <div>
                            <Badge
                                variant={STATUS_BADGE_VARIANT[userStatus] ?? 'neutral'}
                                label={userStatus}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// --- EXPORTS ---
export { Account };
export default Account;
