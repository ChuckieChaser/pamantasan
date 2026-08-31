// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    UserCheck,
    Inbox,
    CheckCircle2,
    XCircle,
    Clock,
    FileText,
    Paperclip,
    Download,
    Search,
    X,
} from 'lucide-react';
import {
    PageContainer,
    Browser,
    PrimaryButton,
    SecondaryButton,
    DestructiveButton,
    AreaField,
    Modal,
    SegmentSelection,
    UserAvatar,
    useToast,
} from '../components';
import {
    useCoordinatorRequestStore,
    useDocumentRequestStore,
    useUserStore,
    useDepartmentStore,
    useDocumentStore,
} from '../stores';
import {
    COORDINATOR_REQUEST_STATUSES,
    DOCUMENT_REQUEST_STATUSES,
} from '../constants';

// --- CONFIGURATIONS ---
const TAB_OPTIONS = [
    { value: 'coordinator', label: 'Coordinator Requests', icon: UserCheck },
    { value: 'document', label: 'Document Requests', icon: Inbox },
];

const COORDINATOR_COLUMNS = [
    { key: 'title', label: 'Action Requested' },
    { key: 'requesterName', label: 'Department Coordinator' },
    { key: 'department', label: 'Academic Unit' },
    { key: 'status', label: 'Review Status' },
    { key: 'date', label: 'Submitted Date' },
];

const COORDINATOR_SORT_OPTIONS = [
    { value: 'date-desc', label: 'Recently Submitted', icon: Clock },
    { value: 'date-asc', label: 'Oldest Submitted', icon: Clock },
    { value: 'name-asc', label: 'Action (A to Z)', icon: UserCheck },
    { value: 'name-desc', label: 'Action (Z to A)', icon: UserCheck },
];

const COORDINATOR_FILTER_OPTIONS = [
    { category: 'Review Status', value: COORDINATOR_REQUEST_STATUSES.PENDING, label: 'Pending', icon: Clock },
    { category: 'Review Status', value: COORDINATOR_REQUEST_STATUSES.APPROVED, label: 'Approved', icon: CheckCircle2 },
    { category: 'Review Status', value: COORDINATOR_REQUEST_STATUSES.REJECTED, label: 'Rejected', icon: XCircle },
];

const DOCUMENT_COLUMNS = [
    { key: 'title', label: 'Subject / Document Request' },
    { key: 'requesterName', label: 'Requester' },
    { key: 'status', label: 'Processing Status' },
    { key: 'messageCount', label: 'Thread Messages' },
    { key: 'date', label: 'Date Submitted' },
];

const DOCUMENT_SORT_OPTIONS = [
    { value: 'date-desc', label: 'Recently Submitted', icon: Clock },
    { value: 'date-asc', label: 'Oldest Submitted', icon: Clock },
    { value: 'name-asc', label: 'Subject (A to Z)', icon: Inbox },
    { value: 'name-desc', label: 'Subject (Z to A)', icon: Inbox },
];

const DOCUMENT_FILTER_OPTIONS = [
    { category: 'Processing Status', value: DOCUMENT_REQUEST_STATUSES.OPEN, label: 'Open', icon: Clock },
    { category: 'Processing Status', value: DOCUMENT_REQUEST_STATUSES.RESOLVED, label: 'Resolved', icon: CheckCircle2 },
    { category: 'Processing Status', value: DOCUMENT_REQUEST_STATUSES.REJECTED, label: 'Rejected', icon: XCircle },
];

// --- COMPONENTS ---
const RequestsPage = ({
    currentUser = null,
    onSelectRequest = null,
    className,
    ...props
}) => {
    // HOOKS
    const { showToast } = useToast();

    // STORES
    const coordinatorRequests = useCoordinatorRequestStore((state) => state.coordinatorRequests);
    const approveCoordinatorRequest = useCoordinatorRequestStore((state) => state.approveCoordinatorRequest);
    const rejectCoordinatorRequest = useCoordinatorRequestStore((state) => state.rejectCoordinatorRequest);
    const deleteCoordinatorRequest = useCoordinatorRequestStore((state) => state.deleteCoordinatorRequest);

    const documentRequests = useDocumentRequestStore((state) => state.requests);
    const messages = useDocumentRequestStore((state) => state.messages);
    const attachments = useDocumentRequestStore((state) => state.attachments);
    const updateDocumentRequest = useDocumentRequestStore((state) => state.updateDocumentRequest);
    const deleteDocumentRequest = useDocumentRequestStore((state) => state.deleteDocumentRequest);
    const addRequestMessage = useDocumentRequestStore((state) => state.addRequestMessage);
    const attachDocumentToRequest = useDocumentRequestStore((state) => state.attachDocumentToRequest);

    const users = useUserStore((state) => state.users);
    const departments = useDepartmentStore((state) => state.departments);
    const documents = useDocumentStore((state) => state.documents);

    // STATES
    const [activeTab, setActiveTab] = useState('coordinator');
    const [selectedRequestItem, setSelectedRequestItem] = useState(null);

    // COORDINATOR MODAL STATES
    const [viewingCoordinatorRequest, setViewingCoordinatorRequest] = useState(null);
    const [rejectingCoordinatorRequest, setRejectingCoordinatorRequest] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // DOCUMENT MODAL STATES
    const [viewingDocumentRequest, setViewingDocumentRequest] = useState(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [stagedAttachment, setStagedAttachment] = useState(null);
    const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
    const [attachSearchTerm, setAttachSearchTerm] = useState('');

    // DERIVED VALUES
    const formattedCoordinatorData = useMemo(() => {
        return coordinatorRequests.map((request) => {
            const requester = users.find((user) => user.id === request.requester_id);
            const department = departments.find((dept) => dept.id === requester?.department_id);
            const requesterName = requester ? `${requester.first_name} ${requester.last_name}` : 'Coordinator';
            const departmentCode = department?.code ?? 'Central';
            const actionFormatted = request.action?.replace(/_/g, ' ');

            return {
                ...request,
                id: request.id,
                title: actionFormatted,
                action: request.action,
                requester_id: request.requester_id,
                requesterName,
                user: requesterName,
                department: department?.name ?? departmentCode,
                department_code: departmentCode,
                status: request.status,
                data: request.data,
                rejection_reason: request.rejection_reason ?? null,
                metadata: `${requesterName} (${departmentCode})`,
                description: `Coordinator request for ${actionFormatted}: ${JSON.stringify(request.data)}`,
                created_at: request.created_at,
                updated_at: request.updated_at ?? request.created_at,
                date: new Date(request.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
                badge: request.status,
            };
        });
    }, [coordinatorRequests, users, departments]);

    const formattedDocumentData = useMemo(() => {
        return documentRequests.map((request) => {
            const requester = users.find((user) => user.id === request.requester_id);
            const requestMessages = messages.filter((message) => message.document_request_id === request.id);
            const requestAttachments = attachments.filter((attachment) => attachment.document_request_id === request.id);
            const requesterName = requester ? `${requester.first_name} ${requester.last_name}` : 'Faculty Member';

            return {
                ...request,
                id: request.id,
                title: request.subject,
                subject: request.subject,
                requester_id: request.requester_id,
                requesterName,
                user: requesterName,
                purpose: request.purpose ?? 'Document issuance, clearance, and certificate verification.',
                status: request.status,
                messages: requestMessages,
                attachments: requestAttachments,
                messageCount: `${requestMessages.length} messages`,
                metadata: `${requesterName} · ${requestMessages.length} msgs`,
                description: request.purpose ?? `Document request from ${requesterName} with ${requestMessages.length} updates.`,
                created_at: request.created_at,
                updated_at: request.updated_at ?? request.created_at,
                date: new Date(request.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
                badge: request.status,
            };
        });
    }, [documentRequests, messages, attachments, users]);

    const activeViewingMessages = useMemo(() => {
        if (!viewingDocumentRequest) {
            return [];
        }
        return messages.filter((message) => message.document_request_id === viewingDocumentRequest.id);
    }, [viewingDocumentRequest, messages]);

    const activeViewingAttachments = useMemo(() => {
        if (!viewingDocumentRequest) {
            return [];
        }
        return attachments.filter(
            (attachment) => attachment.document_request_id === viewingDocumentRequest.id
        );
    }, [viewingDocumentRequest, attachments]);

    const attachableDocuments = useMemo(() => {
        return documents
            .filter((doc) => !doc.is_folder && !doc.is_archived)
            .filter((doc) => {
                if (!attachSearchTerm.trim()) {
                    return true;
                }
                const query = attachSearchTerm.toLowerCase();
                return (
                    (doc.name && doc.name.toLowerCase().includes(query)) ||
                    (doc.title && doc.title.toLowerCase().includes(query))
                );
            });
    }, [documents, attachSearchTerm]);

    // HANDLERS: GENERAL
    const handleTabChange = (nextTab) => {
        setActiveTab(nextTab);
        setSelectedRequestItem(null);
        onSelectRequest?.(null);
    };

    const handleSelectRequest = (item) => {
        setSelectedRequestItem(item);
        onSelectRequest?.(item);
    };

    // HANDLERS: COORDINATOR ACTIONS
    const handleOpenCoordinatorReview = (requestItem) => {
        setViewingCoordinatorRequest(requestItem);
    };

    const handleApproveCoordinatorRequest = async (requestId) => {
        try {
            await approveCoordinatorRequest(requestId, currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001');

            showToast({
                type: 'success',
                title: 'Request Approved',
                description: 'Coordinator action approved and executed with administrative privileges.',
            });

            setViewingCoordinatorRequest(null);
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Approval Failed',
                description: error?.message ?? 'Could not approve request.',
            });
        }
    };

    const handleStartCoordinatorRejection = (requestItem) => {
        setRejectingCoordinatorRequest(requestItem);
        setRejectionReason('');
    };

    const handleConfirmCoordinatorRejection = async () => {
        if (!rejectingCoordinatorRequest) {
            return;
        }

        try {
            await rejectCoordinatorRequest(
                rejectingCoordinatorRequest.id,
                rejectionReason.trim() || 'Request rejected by Administrator.',
                currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001'
            );

            showToast({
                type: 'success',
                title: 'Request Rejected',
                description: 'Coordinator action rejected with reason recorded.',
            });

            setRejectingCoordinatorRequest(null);
            setRejectionReason('');
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Rejection Failed',
                description: error?.message ?? 'Could not reject request.',
            });
        }
    };

    const handleDeleteCoordinatorRequest = async (requestId) => {
        try {
            await deleteCoordinatorRequest(requestId);
            showToast({
                type: 'success',
                title: 'Request Deleted',
                description: 'Coordinator request removed from queue.',
            });
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Deletion Failed',
                description: error?.message ?? 'Could not delete request.',
            });
        }
    };

    const handleCoordinatorAction = (actionKey, item) => {
        if (actionKey === 'open' || actionKey === 'inspect') {
            handleOpenCoordinatorReview(item);
            return;
        }

        if (actionKey === 'approve') {
            handleApproveCoordinatorRequest(item.id);
            return;
        }

        if (actionKey === 'reject') {
            handleStartCoordinatorRejection(item);
            return;
        }

        if (actionKey === 'delete') {
            handleDeleteCoordinatorRequest(item.id);
        }
    };

    // HANDLERS: DOCUMENT ACTIONS
    const handleOpenDocumentThread = (requestItem) => {
        setViewingDocumentRequest(requestItem);
        setReplyMessage('');
        setStagedAttachment(null);
    };

    const handleOpenAttachModal = () => {
        setIsAttachModalOpen(true);
        setAttachSearchTerm('');
    };

    const handleCloseAttachModal = () => {
        setIsAttachModalOpen(false);
        setAttachSearchTerm('');
    };

    const handleSelectDocumentToAttach = (selectedDocument) => {
        setStagedAttachment({
            document_id: selectedDocument.id,
            name: selectedDocument.name,
            size_bytes: selectedDocument.size_bytes,
        });
        setIsAttachModalOpen(false);
        setAttachSearchTerm('');
    };

    const handleRemoveStagedAttachment = () => {
        setStagedAttachment(null);
    };

    const handleSendReply = async () => {
        if ((!replyMessage.trim() && !stagedAttachment) || !viewingDocumentRequest) {
            return;
        }

        const activeUserId = currentUser?.id ?? 'f1000001-0000-4000-8000-000000000002';
        const messageText =
            replyMessage.trim() ||
            (stagedAttachment ? `Attached document: ${stagedAttachment.name}` : '');

        try {
            if (stagedAttachment) {
                await attachDocumentToRequest({
                    document_request_id: viewingDocumentRequest.id,
                    document_id: stagedAttachment.document_id,
                    attached_by_id: activeUserId,
                });
            }

            await addRequestMessage({
                document_request_id: viewingDocumentRequest.id,
                user_id: activeUserId,
                message: messageText,
            });

            setReplyMessage('');
            setStagedAttachment(null);
            showToast({
                type: 'success',
                title: 'Message Sent',
                description: stagedAttachment
                    ? 'Message and attached file posted to discussion thread.'
                    : 'Update posted to the document request thread.',
            });
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Send Failed',
                description: error?.message ?? 'Failed to send message.',
            });
        }
    };

    const handleUpdateDocumentStatus = async (requestId, nextStatus) => {
        try {
            await updateDocumentRequest(requestId, { status: nextStatus });
            showToast({
                type: 'success',
                title: 'Status Updated',
                description: `Document request status set to ${nextStatus}.`,
            });
            setViewingDocumentRequest(null);
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Update Failed',
                description: error?.message ?? 'Could not update request status.',
            });
        }
    };

    const handleDeleteDocumentRequest = async (requestId) => {
        try {
            await deleteDocumentRequest(requestId);
            showToast({
                type: 'success',
                title: 'Request Deleted',
                description: 'Document request has been removed.',
            });
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Deletion Failed',
                description: error?.message ?? 'Could not delete request.',
            });
        }
    };

    const handleDocumentAction = (actionKey, item) => {
        if (actionKey === 'open' || actionKey === 'inspect') {
            handleOpenDocumentThread(item);
            return;
        }

        if (actionKey === 'resolve') {
            handleUpdateDocumentStatus(item.id, DOCUMENT_REQUEST_STATUSES.RESOLVED);
            return;
        }

        if (actionKey === 'reject') {
            handleUpdateDocumentStatus(item.id, DOCUMENT_REQUEST_STATUSES.REJECTED);
            return;
        }

        if (actionKey === 'delete') {
            handleDeleteDocumentRequest(item.id);
        }
    };

    // RENDER
    return (
        <PageContainer className={`flex flex-col gap-6 ${className ?? ''}`} {...props}>
            {/* VIEW MODE SEGMENT SWITCHER */}
            <div className="flex items-center justify-between gap-4">
                <SegmentSelection
                    value={activeTab}
                    options={TAB_OPTIONS}
                    onChange={handleTabChange}
                />
            </div>

            {/* BROWSER 1: COORDINATOR REQUESTS */}
            {activeTab === 'coordinator' && (
                <Browser
                    resourceName="coordinator_requests"
                    title="Manage Requests"
                    description="Administrator review and governance queue for departmental sharing and metadata actions."
                    data={formattedCoordinatorData}
                    columns={COORDINATOR_COLUMNS}
                    sortOptions={COORDINATOR_SORT_OPTIONS}
                    filterOptions={COORDINATOR_FILTER_OPTIONS}
                    selectedItem={selectedRequestItem}
                    searchPlaceholder="Search by action or coordinator name..."
                    onSelectItem={handleSelectRequest}
                    onOpenItem={handleOpenCoordinatorReview}
                    onItemAction={handleCoordinatorAction}
                />
            )}

            {/* BROWSER 2: DOCUMENT REQUESTS */}
            {activeTab === 'document' && (
                <Browser
                    resourceName="document_requests"
                    title="Manage Requests"
                    description="Review, process, and clear institutional document verification requests."
                    data={formattedDocumentData}
                    columns={DOCUMENT_COLUMNS}
                    sortOptions={DOCUMENT_SORT_OPTIONS}
                    filterOptions={DOCUMENT_FILTER_OPTIONS}
                    selectedItem={selectedRequestItem}
                    searchPlaceholder="Search by request subject or requester..."
                    onSelectItem={handleSelectRequest}
                    onOpenItem={handleOpenDocumentThread}
                    onItemAction={handleDocumentAction}
                />
            )}

            {/* COORDINATOR REVIEW DETAILS MODAL */}
            {viewingCoordinatorRequest && (
                <Modal
                    isOpen={Boolean(viewingCoordinatorRequest)}
                    onClose={() => setViewingCoordinatorRequest(null)}
                    title={`Review Request: ${viewingCoordinatorRequest.action?.replace('_', ' ')}`}
                    description={`Status: ${viewingCoordinatorRequest.status} • Submitted on ${new Date(viewingCoordinatorRequest.created_at).toLocaleString()}`}
                    cancelLabel="Close"
                    onCancel={() => setViewingCoordinatorRequest(null)}
                >
                    <div className="flex flex-col gap-4 py-2 text-text">
                        <div className="flex flex-col gap-2 p-3 bg-surface-hover rounded-lg border border-surface-border text-xs">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-text-muted">Coordinator:</span>
                                <span className="font-medium text-text">{viewingCoordinatorRequest.requesterName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-text-muted">Academic Unit:</span>
                                <span className="font-medium text-text">{viewingCoordinatorRequest.department}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-text-muted">Action Type:</span>
                                <span className="font-bold text-accent">{viewingCoordinatorRequest.action}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-text-muted">Payload / Action Details:</span>
                            <pre className="p-3 rounded-lg bg-surface border border-surface-border text-xs text-text overflow-x-auto">
                                {JSON.stringify(viewingCoordinatorRequest.data, null, 2)}
                            </pre>
                        </div>

                        {viewingCoordinatorRequest.status === COORDINATOR_REQUEST_STATUSES.PENDING && (
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                                <DestructiveButton
                                    onClick={() => {
                                        const requestToReject = viewingCoordinatorRequest;
                                        setViewingCoordinatorRequest(null);
                                        handleStartCoordinatorRejection(requestToReject);
                                    }}
                                >
                                    Reject Request
                                </DestructiveButton>
                                <PrimaryButton
                                    onClick={() => handleApproveCoordinatorRequest(viewingCoordinatorRequest.id)}
                                >
                                    Approve & Execute
                                </PrimaryButton>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* COORDINATOR REJECTION REASON MODAL */}
            {rejectingCoordinatorRequest && (
                <Modal
                    isOpen={Boolean(rejectingCoordinatorRequest)}
                    onClose={() => setRejectingCoordinatorRequest(null)}
                    title="Reject Coordinator Request"
                    description={`Provide reason for rejecting action "${rejectingCoordinatorRequest.action}".`}
                    variant="destructive"
                    onConfirm={handleConfirmCoordinatorRejection}
                    confirmLabel="Reject Request"
                    cancelLabel="Cancel"
                    onCancel={() => setRejectingCoordinatorRequest(null)}
                >
                    <div className="flex flex-col gap-3 py-2">
                        <AreaField
                            label="Rejection Reason"
                            placeholder="Explain why this request is not approved..."
                            value={rejectionReason}
                            onChange={(changeEvent) => setRejectionReason(changeEvent.target.value)}
                        />
                    </div>
                </Modal>
            )}

            {/* DOCUMENT REQUEST DETAIL & THREAD MODAL */}
            {viewingDocumentRequest && (
                <Modal
                    isOpen={Boolean(viewingDocumentRequest)}
                    onClose={() => setViewingDocumentRequest(null)}
                    title={viewingDocumentRequest.title}
                    description={`Requested by ${viewingDocumentRequest.requesterName} • Status: ${viewingDocumentRequest.status}`}
                    cancelLabel="Close"
                    onCancel={() => setViewingDocumentRequest(null)}
                >
                    <div className="flex flex-col gap-4 py-2">
                        {/* THREAD MESSAGES (MESSENGER STYLE) */}
                        <div className="flex flex-col gap-3 max-h-80 overflow-y-auto p-1">
                            {activeViewingMessages.length === 0 ? (
                                <div className="py-6 text-center text-xs text-text-muted">
                                    No thread messages available for this request.
                                </div>
                            ) : (
                                activeViewingMessages.map((message) => {
                                    const messageUser = users.find((user) => user.id === message.user_id);
                                    const senderName = messageUser
                                        ? `${messageUser.first_name} ${messageUser.last_name}`
                                        : 'Institutional Staff';
                                    const isCurrentUser = message.user_id === currentUser?.id;
                                    const isAdministrativeUser =
                                        currentUser?.role === 'ADMINISTRATOR' ||
                                        currentUser?.role === 'COORDINATOR';
                                    const isSenderAdministrative =
                                        messageUser?.role === 'ADMINISTRATOR' ||
                                        messageUser?.role === 'COORDINATOR';
                                    const isFellowAdmin =
                                        !isCurrentUser &&
                                        isAdministrativeUser &&
                                        isSenderAdministrative;

                                    const messageAttachments = activeViewingAttachments.filter(
                                        (att) =>
                                            att.attached_by_id === message.user_id ||
                                            (!att.attached_by_id && isCurrentUser)
                                    );

                                    const bubbleStyle = isCurrentUser
                                        ? 'bg-accent text-text-inverted rounded-br-sm'
                                        : isFellowAdmin
                                        ? 'bg-warning-background border border-warning-border text-text rounded-bl-sm'
                                        : 'bg-surface border border-surface-border text-text rounded-bl-sm';

                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex items-end gap-2 max-w-[85%] ${
                                                isCurrentUser
                                                    ? 'self-end flex-row-reverse'
                                                    : 'self-start flex-row'
                                            }`}
                                        >
                                            {/* SENDER AVATAR */}
                                            <UserAvatar
                                                src={messageUser?.avatar_path}
                                                name={senderName}
                                                size="xs"
                                                className="mb-1 shrink-0"
                                            />

                                            <div
                                                className={`flex flex-col gap-1 ${
                                                    isCurrentUser ? 'items-end' : 'items-start'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 text-xs text-text-muted px-1">
                                                    <span className="font-semibold">{senderName}</span>
                                                    {isFellowAdmin && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning-background text-warning border border-warning-border">
                                                            {messageUser?.role}
                                                        </span>
                                                    )}
                                                    <span>•</span>
                                                    <span>
                                                        {new Date(message.created_at).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>

                                                <div
                                                    className={`p-3 rounded-2xl text-xs leading-relaxed break-words select-text ${bubbleStyle}`}
                                                >
                                                    <p>{message.message}</p>

                                                    {/* VISIBLE ATTACHMENTS IN CHAT LOG */}
                                                    {messageAttachments.length > 0 && (
                                                        <div className="mt-2 flex flex-col gap-1.5">
                                                            {messageAttachments.map((attachment) => (
                                                                <div
                                                                    key={attachment.id}
                                                                    className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs ${
                                                                        isCurrentUser
                                                                            ? 'bg-black/20 text-text-inverted border border-white/20'
                                                                            : 'bg-surface-hover border border-surface-border text-text'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                                                        <span
                                                                            className="font-semibold truncate"
                                                                            title={attachment.name}
                                                                        >
                                                                            {attachment.name}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            showToast({
                                                                                type: 'success',
                                                                                title: 'Download Initiated',
                                                                                description: `Downloading ${attachment.name}...`,
                                                                            });
                                                                        }}
                                                                        className={`p-1 rounded hover:bg-black/10 cursor-pointer shrink-0 transition-colors ${
                                                                            isCurrentUser
                                                                                ? 'text-text-inverted'
                                                                                : 'text-accent'
                                                                        }`}
                                                                        title="Download Attachment"
                                                                    >
                                                                        <Download className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* POST REPLY */}
                        <div className="flex flex-col gap-2.5 pt-3 border-t border-surface-border">
                            {/* STAGED ATTACHMENT CHIP */}
                            {stagedAttachment && (
                                <div className="px-3 py-1.5 rounded-lg bg-accent-background border border-accent-border flex items-center justify-between text-xs text-accent">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                        <span className="font-semibold truncate" title={stagedAttachment.name}>
                                            {stagedAttachment.name}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveStagedAttachment}
                                        className="p-1 rounded hover:bg-accent/20 cursor-pointer text-accent shrink-0"
                                        title="Remove staged attachment"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}

                            <AreaField
                                label="Post Thread Update / Reply"
                                placeholder={stagedAttachment ? 'Add a note with your attachment...' : 'Type resolution note or instruction...'}
                                value={replyMessage}
                                onChange={(changeEvent) => setReplyMessage(changeEvent.target.value)}
                            />

                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleOpenAttachModal}
                                        className="p-2 rounded-md border border-surface-border bg-surface hover:bg-surface-hover text-text-muted hover:text-accent transition-colors cursor-pointer shrink-0"
                                        title="Attach Document from Repository"
                                    >
                                        <Paperclip className="h-4 w-4" />
                                    </button>

                                    {viewingDocumentRequest.status !== DOCUMENT_REQUEST_STATUSES.RESOLVED && (
                                        <SecondaryButton
                                            size="sm"
                                            onClick={() =>
                                                handleUpdateDocumentStatus(
                                                    viewingDocumentRequest.id,
                                                    DOCUMENT_REQUEST_STATUSES.RESOLVED
                                                )
                                            }
                                        >
                                            Mark Resolved
                                        </SecondaryButton>
                                    )}
                                    {viewingDocumentRequest.status !== DOCUMENT_REQUEST_STATUSES.REJECTED && (
                                        <DestructiveButton
                                            size="sm"
                                            onClick={() =>
                                                handleUpdateDocumentStatus(
                                                    viewingDocumentRequest.id,
                                                    DOCUMENT_REQUEST_STATUSES.REJECTED
                                                )
                                            }
                                        >
                                            Reject
                                        </DestructiveButton>
                                    )}
                                </div>

                                <PrimaryButton
                                    size="sm"
                                    onClick={handleSendReply}
                                    disabled={!replyMessage.trim() && !stagedAttachment}
                                >
                                    Send Message
                                </PrimaryButton>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ATTACH DOCUMENT SELECTION MODAL */}
            {isAttachModalOpen && (
                <Modal
                    isOpen={isAttachModalOpen}
                    onClose={handleCloseAttachModal}
                    title="Attach Document from Repository"
                    description="Select an institutional file to attach to this thread."
                    size="md"
                    icon={Paperclip}
                    cancelLabel="Cancel"
                    onCancel={handleCloseAttachModal}
                >
                    <div className="flex flex-col gap-3 py-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted pointer-events-none" />
                            <input
                                type="text"
                                value={attachSearchTerm}
                                onChange={(changeEvent) => setAttachSearchTerm(changeEvent.target.value)}
                                placeholder="Search documents by name..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-surface-border bg-surface text-text focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent"
                            />
                        </div>

                        <div className="flex flex-col divide-y divide-surface-border max-h-64 overflow-y-auto rounded-lg border border-surface-border bg-surface">
                            {attachableDocuments.length === 0 ? (
                                <div className="p-4 text-center text-xs text-text-muted">
                                    No matching documents found in repository.
                                </div>
                            ) : (
                                attachableDocuments.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="p-2.5 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <FileText className="h-4 w-4 text-accent shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span
                                                    className="text-xs font-semibold text-text truncate"
                                                    title={doc.name}
                                                >
                                                    {doc.name}
                                                </span>
                                                <span className="text-[10px] text-text-muted">
                                                    {doc.classification ?? 'OFFICIAL'}
                                                </span>
                                            </div>
                                        </div>

                                        <PrimaryButton
                                            size="sm"
                                            onClick={() => handleSelectDocumentToAttach(doc)}
                                            className="shrink-0 text-xs px-2.5"
                                        >
                                            Attach
                                        </PrimaryButton>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </PageContainer>
    );
};

export default RequestsPage;
