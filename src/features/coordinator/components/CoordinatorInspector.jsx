// --- IMPORTS ---
import {
    Calendar,
    CheckCircle2,
    Clock,
    FileCheck,
    Hash,
    Shield,
    User,
    XCircle,
} from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Panel } from '../../../components/layout/Panel';
import { useDialog } from '../../../components/feedback/DialogProvider';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useCoordinator } from '../hooks/useCoordinator';
import { useAuth } from '../../auth/hooks/useAuth';
import { COORDINATOR_STATUS } from '../coordinatorConstants';


// --- CONFIGURATIONS ---
const STATUS_BADGE_VARIANT = {
    [COORDINATOR_STATUS.PENDING]:  'warning',
    [COORDINATOR_STATUS.APPROVED]: 'success',
    [COORDINATOR_STATUS.REJECTED]: 'error',
};


// --- COMPONENTS ---
export const CoordinatorInspector = ({
    request = null,
    isOpen = false,
    onClose,
    currentUserId,
}) => {
    // --- HOOKS & STATE ---
    const { handleUpdateCoordinatorRequest, isMutating } = useCoordinator();
    const { confirm } = useDialog();
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const canDecide = currentUser?.role === 'ADMINISTRATOR';

    // Guard: Hidden if no request or not open
    if (!isOpen || !request) {
        return null;
    }

    // --- DERIVED VALUES ---
    const statusVariant = STATUS_BADGE_VARIANT[request.status] ?? 'neutral';
    const requesterName = `${request.requester?.givenName ?? ''} ${request.requester?.lastName ?? ''}`.trim() || request.requester?.email || 'Requester';

    // --- HANDLERS ---
    const handleAction = async (nextStatus) => {
        const isApproved = nextStatus === COORDINATOR_STATUS.APPROVED;
        const actionLabel = isApproved ? 'Approve' : 'Reject';

        const confirmed = await confirm({
            title: `${actionLabel} Coordinator Request?`,
            description: `Are you sure you want to ${actionLabel.toLowerCase()} the requested action: ${request.action}?`,
            confirmLabel: `${actionLabel} Request`,
            variant: isApproved ? 'primary' : 'destructive',
            icon: isApproved ? CheckCircle2 : XCircle,
        });

        if (!confirmed) return;

        try {
            await handleUpdateCoordinatorRequest(request.id, {
                status: nextStatus,
            });
            toast.success(`Request ${actionLabel.toLowerCase()}d`, `Action "${request.action}" was updated.`);
        } catch (err) {
            toast.error(`Failed to ${actionLabel.toLowerCase()} request`, err?.message, err);
        }
    };

    // --- RENDER ---
    return (
        <Panel
            isOpen={isOpen}
            onClose={onClose}
            title="Coordinator Review"
            subtitle={request.action}
            icon={FileCheck}
        >
            <div className="flex flex-col gap-6">
                {/* Header Card */}
                <div className="flex flex-col p-4 rounded-xl bg-surface-hover/50 border border-surface-border gap-3">
                    <div className="flex items-start justify-between gap-2">
                        <Badge variant={statusVariant} size="md">
                            {request.status}
                        </Badge>
                        <span className="text-[11px] text-text-muted">
                            {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                        </span>
                    </div>

                    <h4 className="text-sm font-bold text-text break-words">
                        {request.action?.replace(/_/g, ' ')}
                    </h4>

                    {/* Requester Info */}
                    <div className="flex items-center justify-between pt-2 border-t border-surface-border text-xs">
                        <span className="text-text-muted">Requester</span>
                        <div className="flex items-center gap-1.5 font-medium text-text">
                            <Avatar src={request.requester?.avatar} size="xs" />
                            <span>{requesterName}</span>
                        </div>
                    </div>
                </div>

                {/* Decision Actions */}
                {canDecide && request.status === COORDINATOR_STATUS.PENDING && (
                    <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                            Administrator Decision
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="primary"
                                leadingIcon={CheckCircle2}
                                label="Approve"
                                onClick={() => handleAction(COORDINATOR_STATUS.APPROVED)}
                                isLoading={isMutating}
                            />
                            <Button
                                variant="destructive"
                                leadingIcon={XCircle}
                                label="Reject"
                                onClick={() => handleAction(COORDINATOR_STATUS.REJECTED)}
                                isLoading={isMutating}
                            />
                        </div>
                    </div>
                )}

                {/* Payload Metadata */}
                <div className="flex flex-col gap-3">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Submission Details
                    </span>

                    <div className="flex flex-col divide-y divide-surface-border text-xs rounded-lg border border-surface-border bg-surface overflow-hidden">
                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted">Request ID</span>
                            <span className="font-mono text-[10px] text-text-muted select-text">
                                {request.id}
                            </span>
                        </div>

                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted">Target Entity</span>
                            <span className="font-medium text-text">
                                {request.targetId || 'Global / Batch'}
                            </span>
                        </div>

                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted">Submitted At</span>
                            <span className="font-medium text-text">
                                {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Panel>
    );
};
