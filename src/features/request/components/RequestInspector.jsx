// --- IMPORTS ---
import { useEffect, useState } from 'react';
import {
    Calendar,
    CheckCircle2,
    Clock,
    FileText,
    Inbox,
    MessageSquare,
    Paperclip,
    RotateCcw,
    Send,
    User,
    XCircle,
} from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/forms/Input';
import { Panel } from '../../../components/layout/Panel';
import { useDialog } from '../../../components/feedback/DialogProvider';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useRequest } from '../hooks/useRequest';
import { useAuth } from '../../auth/hooks/useAuth';
import { REQUEST_STATUS } from '../requestConstants';


// --- CONFIGURATIONS ---
const STATUS_BADGE_VARIANT = {
    [REQUEST_STATUS.OPEN]:     'warning',
    [REQUEST_STATUS.RESOLVED]: 'success',
    [REQUEST_STATUS.REJECTED]: 'error',
};


// --- COMPONENTS ---
export const RequestInspector = ({
    request = null,
    isOpen = false,
    onClose,
    currentUserId,
}) => {
    // --- HOOKS & STATE ---
    const {
        handleUpdateRequest,
        handleGetMessages,
        handleCreateMessage,
        handleGetAttachments,
        messages,
        attachments,
        isMutating,
    } = useRequest();

    const { confirm } = useDialog();
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const canReview = currentUser?.role === 'ADMINISTRATOR' || currentUser?.role === 'COORDINATOR';

    const [replyText, setReplyText] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);

    // Fetch messages and attachments when request selected
    useEffect(() => {
        if (isOpen && request?.id) {
            handleGetMessages(request.id).catch(() => {});
            handleGetAttachments(request.id).catch(() => {});
        }
    }, [isOpen, request?.id, handleGetMessages, handleGetAttachments]);

    // Guard: Hidden if no request or not open
    if (!isOpen || !request) {
        return null;
    }

    // --- DERIVED VALUES ---
    const statusVariant = STATUS_BADGE_VARIANT[request.status] ?? 'neutral';
    const requesterName = `${request.requester?.givenName ?? ''} ${request.requester?.lastName ?? ''}`.trim() || request.requester?.email || 'Requester';
    const reviewerName = request.reviewer ? `${request.reviewer.givenName ?? ''} ${request.reviewer.lastName ?? ''}`.trim() : 'Unassigned';

    // --- HANDLERS ---
    const handleStatusChange = async (nextStatus) => {
        const actionLabel = nextStatus === REQUEST_STATUS.RESOLVED ? 'Resolve' : nextStatus === REQUEST_STATUS.REJECTED ? 'Reject' : 'Reopen';
        const isDestructive = nextStatus === REQUEST_STATUS.REJECTED;

        const confirmed = await confirm({
            title: `${actionLabel} Request?`,
            description: `Are you sure you want to mark this request as ${nextStatus.toLowerCase()}?`,
            confirmLabel: `${actionLabel} Request`,
            variant: isDestructive ? 'destructive' : 'primary',
            icon: nextStatus === REQUEST_STATUS.RESOLVED ? CheckCircle2 : XCircle,
        });

        if (!confirmed) return;

        try {
            await handleUpdateRequest(request.id, {
                status: nextStatus,
                reviewerId: currentUserId,
            });
            toast.success(`Request marked as ${nextStatus.toLowerCase()}`, request.subject);
        } catch (err) {
            toast.error('Failed to update request status', err?.message, err);
        }
    };

    const handleSendMessage = async (e) => {
        e?.preventDefault?.();
        if (!replyText.trim()) return;

        setIsSendingMessage(true);
        try {
            await handleCreateMessage({
                id: crypto.randomUUID(),
                requestId: request.id,
                userId: currentUserId,
                message: replyText.trim(),
            });
            setReplyText('');
            handleGetMessages(request.id);
        } catch (err) {
            toast.error('Failed to post reply', err?.message, err);
        } finally {
            setIsSendingMessage(false);
        }
    };

    // --- RENDER ---
    return (
        <Panel
            isOpen={isOpen}
            onClose={onClose}
            title="Request Review"
            subtitle={request.subject}
            icon={Inbox}
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
                        {request.subject}
                    </h4>

                    {/* Requester & Reviewer Chips */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-surface-border text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-text-muted">Requester</span>
                            <div className="flex items-center gap-1.5 font-medium text-text">
                                <Avatar src={request.requester?.avatar} size="xs" />
                                <span>{requesterName}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-text-muted">Reviewer</span>
                            <div className="flex items-center gap-1.5 font-medium text-text">
                                <Avatar src={request.reviewer?.avatar} size="xs" />
                                <span>{reviewerName}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Workflow Status Actions */}
                {canReview && (
                    <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                            Workflow Status
                        </span>

                        {request.status === REQUEST_STATUS.OPEN ? (
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="primary"
                                    leadingIcon={CheckCircle2}
                                    label="Resolve"
                                    onClick={() => handleStatusChange(REQUEST_STATUS.RESOLVED)}
                                    isLoading={isMutating}
                                />
                                <Button
                                    variant="destructive"
                                    leadingIcon={XCircle}
                                    label="Reject"
                                    onClick={() => handleStatusChange(REQUEST_STATUS.REJECTED)}
                                    isLoading={isMutating}
                                />
                            </div>
                        ) : (
                            <Button
                                variant="secondary"
                                leadingIcon={RotateCcw}
                                label="Reopen Request"
                                onClick={() => handleStatusChange(REQUEST_STATUS.OPEN)}
                                isLoading={isMutating}
                                className="w-full"
                            />
                        )}
                    </div>
                )}

                {/* Discussion Thread */}
                <div className="flex flex-col gap-3">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Discussion ({messages?.length ?? 0})</span>
                    </span>

                    <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1 no-scrollbar">
                        {(!messages || messages.length === 0) ? (
                            <div className="py-4 text-center text-xs text-text-muted">
                                No comments posted yet.
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isCurrentUser = msg.user?.id === currentUserId;
                                const senderName = msg.user ? `${msg.user.givenName ?? ''} ${msg.user.lastName ?? ''}`.trim() : 'System';

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex flex-col gap-1 p-3 rounded-lg border text-xs leading-relaxed ${
                                            isCurrentUser
                                                ? 'bg-accent/5 border-accent/20 ml-2'
                                                : 'bg-surface border-surface-border mr-2'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 font-semibold text-text">
                                                <Avatar src={msg.user?.avatar} size="xs" />
                                                <span>{senderName}</span>
                                            </div>
                                            <span className="text-[10px] text-text-muted">
                                                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-text mt-0.5 whitespace-pre-wrap break-words">
                                            {msg.message}
                                        </p>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Send Reply Bar */}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-1">
                        <Input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1"
                        />
                        <Button
                            type="submit"
                            variant="primary"
                            leadingIcon={Send}
                            isLoading={isSendingMessage}
                            isDisabled={!replyText.trim()}
                        />
                    </form>
                </div>
            </div>
        </Panel>
    );
};
