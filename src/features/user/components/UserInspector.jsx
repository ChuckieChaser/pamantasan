// --- IMPORTS ---
import {
    Building2,
    Calendar,
    Edit3,
    Hash,
    Mail,
    Shield,
    ShieldAlert,
    ShieldCheck,
    UserCheck,
    UserX,
} from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Panel } from '../../../components/layout/Panel';
import { useDialog } from '../../../components/feedback/DialogProvider';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useUser } from '../hooks/useUser';
import { USER_ROLE, USER_STATUS } from '../userConstants';


// --- CONFIGURATIONS ---
const STATUS_BADGE_VARIANT = {
    [USER_STATUS.VERIFIED]:         'success',
    [USER_STATUS.PENDING_PASSWORD]: 'warning',
    [USER_STATUS.PENDING_SSO]:      'information',
    [USER_STATUS.SUSPENDED]:        'error',
    [USER_STATUS.ARCHIVED]:         'neutral',
};


// --- COMPONENTS ---
export const UserInspector = ({
    user = null,
    isOpen = false,
    onClose,
    onEdit,
}) => {
    // --- HOOKS & STATE ---
    const { handleUpdateUser, isMutating } = useUser();
    const { confirm } = useDialog();
    const { toast } = useToast();

    // Guard: Hidden if no user or not open
    if (!isOpen || !user) {
        return null;
    }

    // --- DERIVED VALUES ---
    const fullName = `${user.givenName ?? ''} ${user.lastName ?? ''}`.trim() || 'Unnamed User';
    const isSuspended = user.status === USER_STATUS.SUSPENDED;
    const statusVariant = STATUS_BADGE_VARIANT[user.status] ?? 'neutral';

    // --- HANDLERS ---
    const handleToggleSuspension = async () => {
        const nextStatus = isSuspended ? USER_STATUS.VERIFIED : USER_STATUS.SUSPENDED;
        const actionLabel = isSuspended ? 'Reactivate' : 'Suspend';

        const confirmed = await confirm({
            title: `${actionLabel} User Account?`,
            description: `Are you sure you want to ${actionLabel.toLowerCase()} access for ${fullName}? ${
                isSuspended
                    ? 'The user will regain immediate access to system features.'
                    : 'The user will be immediately logged out and blocked from logging in.'
            }`,
            confirmLabel: `${actionLabel} Account`,
            variant: isSuspended ? 'primary' : 'destructive',
            icon: isSuspended ? UserCheck : UserX,
        });

        if (!confirmed) return;

        try {
            await handleUpdateUser(user.id, { status: nextStatus });
            toast.success(`Account ${actionLabel.toLowerCase()}ed`, `${fullName} is now ${nextStatus.toLowerCase()}.`);
        } catch (err) {
            toast.error(`Failed to ${actionLabel.toLowerCase()} user`, err?.message, err);
        }
    };

    // --- RENDER ---
    return (
        <Panel
            isOpen={isOpen}
            onClose={onClose}
            title="User Profile"
            subtitle={user.universityId}
            icon={Shield}
        >
            <div className="flex flex-col gap-6">
                {/* Profile Header */}
                <div className="flex flex-col items-center text-center p-4 rounded-xl bg-surface-hover/50 border border-surface-border gap-3">
                    <Avatar
                        src={user.avatar}
                        alt={fullName}
                        size="xl"
                    />

                    <div className="flex flex-col items-center">
                        <h4 className="text-base font-bold text-text">
                            {fullName}
                        </h4>
                        <span className="text-xs text-text-muted mt-0.5">
                            {user.email}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                        <Badge
                            variant={user.role === USER_ROLE.ADMINISTRATOR ? 'accent' : 'neutral'}
                            size="md"
                        >
                            {user.role}
                        </Badge>

                        <Badge
                            variant={statusVariant}
                            size="md"
                        >
                            {user.status?.replace(/_/g, ' ')}
                        </Badge>
                    </div>
                </div>

                {/* Information Attributes */}
                <div className="flex flex-col gap-3">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        University Details
                    </span>

                    <div className="flex flex-col divide-y divide-surface-border text-xs rounded-lg border border-surface-border bg-surface overflow-hidden">
                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted inline-flex items-center gap-2">
                                <Hash className="h-3.5 w-3.5" />
                                <span>University ID</span>
                            </span>
                            <span className="font-semibold text-text select-text">
                                {user.universityId}
                            </span>
                        </div>

                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted inline-flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5" />
                                <span>Department</span>
                            </span>
                            <span className="font-medium text-text text-right truncate max-w-[180px]">
                                {user.department?.name ?? 'Unassigned'}
                            </span>
                        </div>

                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted inline-flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Registered At</span>
                            </span>
                            <span className="font-medium text-text">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Management Actions */}
                <div className="flex flex-col gap-2 pt-2">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Account Actions
                    </span>

                    <Button
                        variant="secondary"
                        leadingIcon={Edit3}
                        label="Edit Profile & Role"
                        onClick={() => onEdit?.(user)}
                        className="w-full justify-start"
                    />

                    <Button
                        variant={isSuspended ? 'primary' : 'destructive'}
                        leadingIcon={isSuspended ? UserCheck : UserX}
                        label={isSuspended ? 'Reactivate User Access' : 'Suspend User Account'}
                        onClick={handleToggleSuspension}
                        isLoading={isMutating}
                        className="w-full justify-start"
                    />
                </div>
            </div>
        </Panel>
    );
};
