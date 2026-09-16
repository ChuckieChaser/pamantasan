// --- IMPORTS ---
import { useState, useMemo, useEffect } from 'react';
import {
    Inbox,
    Check,
    CheckCircle2,
    XCircle,
    Clock,
    FileText,
    FilePlus,
    MessageSquareText,
    Paperclip,
    Download,
    Search,
    X,
    Plus,
    Trash2,
} from 'lucide-react';
import {
    AreaField,
    Avatar,
    Browser,
    Button,
    Container,
    Modal,
    TextField,
    formatDateTime,
    resolveUserAvatar,
} from '../components';
import { useToast } from '../hooks';
import {
    useDepartmentStore,
    useDocumentStore,
    useUserStore,
    useAuthStore,
} from '../stores';
import { storageService } from '../services';
import { constants } from '../constants';


// --- CONFIGURATIONS ---

const DOCUMENT_COLUMNS = [
    { key: 'title', label: 'Subject' },
    { key: 'requester', label: 'Requester' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Last Modified' },
];

const DOCUMENT_SORT_OPTIONS = [
    { value: 'date-desc', label: 'Recently Submitted', icon: Clock },
    { value: 'date-asc', label: 'Oldest Submitted', icon: Clock },
    { value: 'name-asc', label: 'Subject (A to Z)', icon: Inbox },
    { value: 'name-desc', label: 'Subject (Z to A)', icon: Inbox },
];

const DOCUMENT_FILTER_OPTIONS = [
    { category: 'Processing Status', value: constants.DOCUMENT_REQUESTS_STATUS.OPEN, label: 'Open', icon: Clock },
    { category: 'Processing Status', value: constants.DOCUMENT_REQUESTS_STATUS.RESOLVED, label: 'Resolved', icon: CheckCircle2 },
    { category: 'Processing Status', value: constants.DOCUMENT_REQUESTS_STATUS.REJECTED, label: 'Rejected', icon: XCircle },
];


// --- COMPONENTS ---
const RequestsPage = ({
    currentUser = null,
    selectedItem = null,
    onSelectRequest = null,
    className,
    ...props
}) => {
    // STATES
    const [selectedRequestItem, setSelectedRequestItem] = useState(null);

    // DOCUMENT MODAL STATES
    const [viewingDocumentRequest, setViewingDocumentRequest] = useState(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [stagedAttachments, setStagedAttachments] = useState([]);
    const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
    const [attachSearchTerm, setAttachSearchTerm] = useState('');

    // DOCUMENT CREATE MODAL STATES
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreatingRequest, setIsCreatingRequest] = useState(false);
    const [formSubject, setFormSubject] = useState('');
    const [createFormErrors, setCreateFormErrors] = useState({});

    // REQUEST DELETION CONFIRMATION STATE
    const [deletingRequestItem, setDeletingRequestItem] = useState(null);
    const [isDeletingRequest, setIsDeletingRequest] = useState(false);

    // HOOKS
    const { showToast } = useToast();

    // STORES
    const documentRequests = useDocumentStore((state) => state.documentRequests);
    const messages = useDocumentStore((state) => state.documentRequestMessages);
    const attachments = useDocumentStore((state) => state.documentRequestAttachments);
    const documents = useDocumentStore((state) => state.documents);
    const fetchDocumentRequests = useDocumentStore((state) => state.fetchDocumentRequests);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const insertDocumentRequest = useDocumentStore((state) => state.insertDocumentRequest);
    const updateDocumentRequest = useDocumentStore((state) => state.updateDocumentRequest);
    const deleteDocumentRequest = useDocumentStore((state) => state.deleteDocumentRequest);
    const insertDocumentRequestMessage = useDocumentStore((state) => state.insertDocumentRequestMessage);
    const insertDocumentRequestAttachment = useDocumentStore((state) => state.insertDocumentRequestAttachment);

    const users = useUserStore((state) => state.users);
    const fetchUsers = useUserStore((state) => state.fetchUsers);
    const departments = useDepartmentStore((state) => state.departments);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);

    // EFFECTS
    useEffect(() => {
        fetchDocumentRequests?.().catch(() => {});
        fetchDocuments?.().catch(() => {});
        fetchUsers?.().catch(() => {});
        fetchDepartments?.().catch(() => {});
    }, [fetchDocumentRequests, fetchDocuments, fetchUsers, fetchDepartments]);

    // LISTEN FOR EXTERNAL DELETE TRIGGER (E.G. FROM INSPECTOR QUICK ACTION)
    useEffect(() => {
        const handleDeleteDocRequestEvent = (event) => {
            if (event.detail) {
                const targetRequest = (documentRequests || []).find((r) => r.id === event.detail.id) ?? event.detail;
                setDeletingRequestItem(targetRequest);
            }
        };
        window.addEventListener('pamantasan:delete-document-request', handleDeleteDocRequestEvent);
        return () => window.removeEventListener('pamantasan:delete-document-request', handleDeleteDocRequestEvent);
    }, [documentRequests]);

    // DERIVED VALUES: ACCESS & DATA
    const authUser = useAuthStore((state) => state.currentUser);
    const activeUser = currentUser ?? authUser;
    const isStaff = activeUser?.role === constants.USERS_ROLE.ADMINISTRATOR || activeUser?.role === constants.USERS_ROLE.COORDINATOR;
    const canCreateRequest = !isStaff;

    const formattedDocumentData = useMemo(() => {
        return (documentRequests || []).map((request) => {
            const requesterId = typeof request.requester === 'object'
                ? request.requester?.id
                : (request.requesterId ?? request.requester);
            const requester = users.find((user) => user.id === requesterId);
            const requestMessages = (messages || []).filter((message) => {
                const msgReqId = typeof message.documentRequest === 'object'
                    ? message.documentRequest?.id
                    : (message.documentRequestId ?? message.documentRequest);
                return msgReqId === request.id;
            });
            const requestAttachments = (attachments || []).filter((attachment) => {
                const attReqId = typeof attachment.documentRequest === 'object'
                    ? attachment.documentRequest?.id
                    : (attachment.documentRequestId ?? attachment.documentRequest);
                return attReqId === request.id;
            });
            const requesterName = requester
                ? `${requester.firstName ?? ''} ${requester.lastName ?? ''}`.trim() || requester.email || 'Faculty Member'
                : (typeof request.requester === 'string' ? request.requester : 'Faculty Member');

            const resolvedRequesterAvatar = requester ? resolveUserAvatar(requester) : null;
            const createdAtDate = request.createdAt || new Date().toISOString();
            const updatedAtDate = request.updatedAt ?? createdAtDate;
            const lastModifiedDate = request.updatedAt || request.createdAt;
            const formattedDate = (lastModifiedDate && !isNaN(new Date(lastModifiedDate).getTime()))
                ? formatDateTime(lastModifiedDate)
                : 'Recent';

            return {
                ...request,
                id: request.id,
                title: request.subject || 'Document Request',
                subject: request.subject || 'Document Request',
                requester: requesterName,
                requesterId: requesterId,
                requesterUser: requester,
                requesterAvatar: resolvedRequesterAvatar || requester?.avatarPath,
                requesterName,
                user: requesterName,
                status: request.status || constants.DOCUMENT_REQUESTS_STATUS.OPEN,
                messages: requestMessages,
                attachments: requestAttachments,
                messageCount: `${requestMessages.length} messages`,
                metadata: `${requesterName} · ${requestMessages.length} msgs`,
                description: `${request.subject || 'Document request'} from ${requesterName}.`,
                createdAt: createdAtDate,
                updatedAt: updatedAtDate,
                date: formattedDate,
                badge: request.status || constants.DOCUMENT_REQUESTS_STATUS.OPEN,
            };
        });
    }, [documentRequests, messages, attachments, users]);

    const activeViewingMessages = useMemo(() => {
        if (!viewingDocumentRequest) {
            return [];
        }
        return messages.filter((message) => {
            const msgReqId = typeof message.documentRequest === 'object' ? message.documentRequest?.id : (message.documentRequestId ?? message.documentRequest);
            return msgReqId === viewingDocumentRequest.id;
        });
    }, [viewingDocumentRequest, messages]);

    const activeViewingAttachments = useMemo(() => {
        if (!viewingDocumentRequest) {
            return [];
        }
        return attachments.filter((attachment) => {
            const attReqId = typeof attachment.documentRequest === 'object' ? attachment.documentRequest?.id : (attachment.documentRequestId ?? attachment.documentRequest);
            return attReqId === viewingDocumentRequest.id;
        });
    }, [viewingDocumentRequest, attachments]);

    const attachableDocuments = useMemo(() => {
        return documents
            .filter((doc) => !doc.isFolder && !doc.isArchived)
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

    // DERIVED SELECTION: Stays reactive to store updates and formatted data
    const activeSelectedRequest = useMemo(() => {
        const targetId = selectedItem?.id ?? selectedRequestItem?.id;
        if (!targetId) return null;
        const matched = formattedDocumentData.find((item) => item.id === targetId);
        if (matched) {
            return {
                ...matched,
                _targetTab: selectedItem?._targetTab ?? selectedRequestItem?._targetTab ?? 'information',
            };
        }
        return selectedItem ?? selectedRequestItem;
    }, [selectedItem, selectedRequestItem, formattedDocumentData]);

    // HANDLERS
    const handleSelectRequest = (item, targetTab = 'information') => {
        const itemWithTab = item ? { ...item, _targetTab: targetTab } : null;
        setSelectedRequestItem(itemWithTab);
        onSelectRequest?.(itemWithTab, targetTab);
    };

    const handleOpenDocumentThread = (requestItem) => {
        setViewingDocumentRequest(requestItem);
        setReplyMessage('');
        setStagedAttachments([]);
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
        const docId = selectedDocument.id;
        setStagedAttachments((prev) => {
            if (prev.some((item) => item.documentId === docId)) {
                return prev.filter((item) => item.documentId !== docId);
            }
            return [
                ...prev,
                {
                    documentId: docId,
                    name: selectedDocument.name,
                    sizeBytes: selectedDocument.sizeBytes ?? selectedDocument.size,
                },
            ];
        });
    };

    const handleRemoveStagedAttachment = (docId) => {
        setStagedAttachments((prev) => prev.filter((item) => item.documentId !== docId));
    };

    const handleSendReply = async () => {
        if ((!replyMessage.trim() && stagedAttachments.length === 0) || !viewingDocumentRequest) {
            return;
        }

        const activeUserId = currentUser?.id;
        if (!activeUserId) {
            showToast({
                type: 'error',
                title: 'Authentication Error',
                description: 'You must be signed in to post a reply.',
            });
            return;
        }
        const currentStaged = [...stagedAttachments];
        const messageText =
            replyMessage.trim() ||
            (currentStaged.length > 0
                ? `Shared ${currentStaged.length === 1 ? currentStaged[0].name : `${currentStaged.length} documents`}`
                : '');

        try {
            if (currentStaged.length > 0) {
                for (const att of currentStaged) {
                    await insertDocumentRequestAttachment({
                        documentRequestId: viewingDocumentRequest.id,
                        documentId: att.documentId,
                        attachedById: activeUserId,
                    });
                }
            }

            await insertDocumentRequestMessage({
                documentRequestId: viewingDocumentRequest.id,
                userId: activeUserId,
                message: messageText,
            });

            setReplyMessage('');
            setStagedAttachments([]);
            showToast({
                type: 'success',
                title: 'Message Sent',
                description: currentStaged.length > 0
                    ? `Message and ${currentStaged.length} attached file${currentStaged.length === 1 ? '' : 's'} posted to thread.`
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
            const updated = await updateDocumentRequest(requestId, { status: nextStatus });
            showToast({
                type: 'success',
                title: 'Status Updated',
                description: `Document request status set to ${nextStatus}.`,
            });
            setViewingDocumentRequest(null);
            if (activeSelectedRequest?.id === requestId) {
                const targetTab = activeSelectedRequest?._targetTab ?? selectedRequestItem?._targetTab ?? 'information';
                const nextItem = { ...activeSelectedRequest, ...updated, status: nextStatus, _targetTab: targetTab };
                setSelectedRequestItem(nextItem);
                onSelectRequest?.(nextItem, targetTab);
            }
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Update Failed',
                description: error?.message ?? 'Could not update request status.',
            });
        }
    };

    const handleDocumentAction = async (actionKey, item) => {
        if (actionKey === 'view_information') {
            handleSelectRequest(item, 'information');
            return;
        }

        if (actionKey === 'view_message') {
            handleSelectRequest(item, 'messages');
            return;
        }

        if (actionKey === 'view_attachment') {
            handleSelectRequest(item, 'attachments');
            return;
        }

        if (actionKey === 'open_request') {
            await handleUpdateDocumentStatus(item.id, constants.DOCUMENT_REQUESTS_STATUS.OPEN);
            return;
        }

        if (actionKey === 'open' || actionKey === 'inspect') {
            handleSelectRequest(item, 'information');
            return;
        }

        if (actionKey === 'resolve') {
            await handleUpdateDocumentStatus(item.id, constants.DOCUMENT_REQUESTS_STATUS.RESOLVED);
            return;
        }

        if (actionKey === 'reject') {
            await handleUpdateDocumentStatus(item.id, constants.DOCUMENT_REQUESTS_STATUS.REJECTED);
            return;
        }

        if (actionKey === 'delete') {
            setDeletingRequestItem(item);
        }
    };

    const handleOpenCreateModal = () => {
        if (!canCreateRequest) return;
        setFormSubject('');
        setCreateFormErrors({});
        setIsCreateModalOpen(true);
    };

    const handleCloseCreateModal = () => {
        if (isCreatingRequest) return;
        setIsCreateModalOpen(false);
        setFormSubject('');
        setCreateFormErrors({});
    };

    const handleCreateRequest = async () => {
        if (!canCreateRequest) return;

        const errors = {};
        if (!formSubject.trim()) {
            errors.subject = 'Subject is required.';
        }

        if (Object.keys(errors).length > 0) {
            setCreateFormErrors(errors);
            return;
        }

        const activeUserId = activeUser?.id;
        if (!activeUserId) {
            showToast({
                type: 'error',
                title: 'Authentication Required',
                description: 'You must be signed in to create a request.',
            });
            return;
        }

        setIsCreatingRequest(true);
        setCreateFormErrors({});

        try {
            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            await Promise.all([
                insertDocumentRequest({
                    requesterId: activeUserId,
                    subject: formSubject.trim(),
                    status: constants.DOCUMENT_REQUESTS_STATUS.OPEN,
                }),
                minTimer,
            ]);

            showToast({
                type: 'success',
                title: 'Request Created',
                description: `Successfully submitted request "${formSubject.trim()}".`,
            });

            handleCloseCreateModal();
        } catch (error) {
            setCreateFormErrors({ subject: error?.message ?? 'Failed to create document request.' });
        } finally {
            setIsCreatingRequest(false);
        }
    };

    const handleConfirmDeleteRequest = async () => {
        if (!deletingRequestItem?.id) {
            return;
        }
        setIsDeletingRequest(true);
        try {
            await deleteDocumentRequest(deletingRequestItem.id);
            showToast({
                type: 'success',
                title: 'Request Deleted',
                description: 'Document request has been removed.',
            });
            if (activeSelectedRequest?.id === deletingRequestItem.id) {
                setSelectedRequestItem(null);
                onSelectRequest?.(null);
            }
            setDeletingRequestItem(null);
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Deletion Failed',
                description: error?.message ?? 'Could not delete request.',
            });
        } finally {
            setIsDeletingRequest(false);
        }
    };

    // RENDER
    return (
        <Container variant="page" className={`flex flex-col gap-6 ${className ?? ''}`} {...props}>
            <Browser
                resourceName="document_requests"
                title="Document Requests"
                description="Review, process, and clear institutional document verification requests."
                data={formattedDocumentData}
                columns={DOCUMENT_COLUMNS}
                sortOptions={DOCUMENT_SORT_OPTIONS}
                filterOptions={DOCUMENT_FILTER_OPTIONS}
                selectedItem={activeSelectedRequest}
                addItemLabel={canCreateRequest ? "New Request" : undefined}
                addItemIcon={canCreateRequest ? Plus : undefined}
                searchPlaceholder="Search by request subject or requester..."
                onAddItem={canCreateRequest ? handleOpenCreateModal : undefined}
                onSelectItem={handleSelectRequest}
                onOpenItem={handleSelectRequest}
                onItemAction={handleDocumentAction}
            />

            {/* NEW DOCUMENT REQUEST MODAL */}
            {canCreateRequest && isCreateModalOpen && (
                <Modal
                    isOpen={isCreateModalOpen}
                    onClose={handleCloseCreateModal}
                    title="New Document Request"
                    description="Submit an institutional document clearance or certificate request."
                    icon={FilePlus}
                    callout="Document requests are submitted with OPEN status and forwarded to coordinators and administration for review."
                    calloutVariant="neutral"
                    onConfirm={handleCreateRequest}
                    confirmLabel={isCreatingRequest ? 'Submitting Request...' : 'Submit Request'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isCreatingRequest}
                    isConfirmDisabled={isCreatingRequest}
                >
                    <div className="flex flex-col gap-4 py-2">
                        <TextField
                            label="Subject"
                            placeholder="Enter request subject..."
                            value={formSubject}
                            onChange={(changeEvent) => {
                                setFormSubject(changeEvent.target.value);
                                if (createFormErrors.subject) {
                                    setCreateFormErrors((prev) => ({ ...prev, subject: undefined }));
                                }
                            }}
                            helperText="e.g. Official Transcript of Records Clearance, Certificate of Good Moral Character"
                            required
                            error={createFormErrors.subject}
                            autoFocus
                        />
                    </div>
                </Modal>
            )}

            {/* DOCUMENT REQUEST DETAIL & THREAD MODAL */}
            {viewingDocumentRequest && (
                <Modal
                    isOpen={Boolean(viewingDocumentRequest)}
                    onClose={() => setViewingDocumentRequest(null)}
                    size="lg"
                    title={viewingDocumentRequest.title}
                    description={`Requested by ${viewingDocumentRequest.requesterName} • Status: ${viewingDocumentRequest.status}`}
                    icon={MessageSquareText}
                    callout="Institutional communications and document attachments for this clearance thread."
                    calloutVariant="neutral"
                    cancelLabel="Close"
                    onCancel={() => setViewingDocumentRequest(null)}
                >
                    <div className="flex flex-col gap-4 py-2">
                        {/* THREAD MESSAGES */}
                        <div className="flex flex-col gap-3 max-h-80 overflow-y-auto p-1">
                            {activeViewingMessages.length === 0 ? (
                                <div className="py-6 text-center text-xs text-text-muted">
                                    No thread messages available for this request.
                                </div>
                            ) : (
                                activeViewingMessages.map((message) => {
                                    const messageUserId = typeof message.user === 'object' ? message.user?.id : (message.userId ?? message.user);
                                    const messageUser = users.find((user) => user.id === messageUserId);
                                    const senderName = messageUser
                                        ? `${messageUser.firstName} ${messageUser.lastName}`
                                        : 'Institutional Staff';
                                    const isCurrentUser = messageUserId === currentUser?.id;
                                    const isAdministrativeUser =
                                        currentUser?.role === constants.USERS_ROLE.ADMINISTRATOR ||
                                        currentUser?.role === constants.USERS_ROLE.COORDINATOR;
                                    const isSenderAdministrative =
                                        messageUser?.role === constants.USERS_ROLE.ADMINISTRATOR ||
                                        messageUser?.role === constants.USERS_ROLE.COORDINATOR;
                                    const isFellowAdmin =
                                        !isCurrentUser &&
                                        isAdministrativeUser &&
                                        isSenderAdministrative;

                                    const messageAttachments = activeViewingAttachments.filter((att) => {
                                        const attUserId = typeof att.attachedBy === 'object' ? att.attachedBy?.id : (att.attachedById ?? att.attachedBy);
                                        return attUserId === messageUserId || (!attUserId && isCurrentUser);
                                    });

                                    const bubbleStyle = isCurrentUser
                                        ? 'bg-accent text-text-inverted rounded-br-sm'
                                        : isFellowAdmin
                                        ? 'bg-warning-background border border-warning-border text-text rounded-bl-sm'
                                        : 'bg-surface border border-surface-border text-text rounded-bl-sm';

                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex items-end gap-2 max-w-xl ${
                                                isCurrentUser
                                                    ? 'self-end flex-row-reverse'
                                                    : 'self-start flex-row'
                                            }`}
                                        >
                                            <Avatar
                                                src={messageUser?.avatarPath}
                                                user={messageUser}
                                                alt={senderName}
                                                size="small"
                                                className="mb-1 shrink-0"
                                            />

                                            <div
                                                className={`flex flex-col gap-1 ${
                                                    isCurrentUser ? 'items-end' : 'items-start'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 text-xs text-text-muted px-1">
                                                    <span className="font-semibold">{senderName}</span>
                                                    {isFellowAdmin && (
                                                        <span className="px-2 py-1 rounded text-xs font-bold bg-warning-background text-warning border border-warning-border">
                                                            {messageUser?.role}
                                                        </span>
                                                    )}
                                                    <span>•</span>
                                                    <span>
                                                        {new Date(message.createdAt ?? Date.now()).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>

                                                <div
                                                    className={`p-3 rounded-2xl text-xs leading-relaxed break-words select-text ${bubbleStyle}`}
                                                >
                                                    <p>{message.message}</p>

                                                    {messageAttachments.length > 0 && (
                                                        <div className="mt-2 flex flex-col gap-2">
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
                                                                        <Paperclip className="h-4 w-4 shrink-0" />
                                                                        <span
                                                                            className="font-semibold truncate"
                                                                            title={attachment.name}
                                                                        >
                                                                            {attachment.name}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={async () => {
                                                                            try {
                                                                                await storageService.downloadDocument(
                                                                                    attachment.path || attachment.url,
                                                                                    attachment.name
                                                                                );
                                                                            } catch (err) {
                                                                                showToast({
                                                                                    type: 'error',
                                                                                    title: 'Download Failed',
                                                                                    description: err?.message || 'Could not download attachment.',
                                                                                });
                                                                            }
                                                                        }}
                                                                        className={`p-1 rounded hover:bg-black/10 cursor-pointer shrink-0 transition-colors ${
                                                                            isCurrentUser
                                                                                ? 'text-text-inverted'
                                                                                : 'text-accent'
                                                                        }`}
                                                                        title="Download Attachment"
                                                                    >
                                                                        <Download className="h-4 w-4" />
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
                        <div className="flex flex-col gap-3 pt-3 border-t border-surface-border">
                            {stagedAttachments.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                    {stagedAttachments.map((staged) => (
                                        <div
                                            key={staged.documentId}
                                            className="px-2.5 py-1 rounded-lg bg-accent-background border border-accent-border flex items-center gap-2 text-xs text-accent"
                                        >
                                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                            <span className="font-semibold truncate max-w-44" title={staged.name}>
                                                {staged.name}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStagedAttachment(staged.documentId)}
                                                className="p-0.5 rounded hover:bg-accent/20 cursor-pointer text-accent shrink-0"
                                                title={`Remove ${staged.name}`}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <AreaField
                                label="Post Thread Update / Reply"
                                placeholder={
                                    stagedAttachments.length > 0
                                        ? `Add a note with ${stagedAttachments.length} staged file${stagedAttachments.length === 1 ? '' : 's'}...`
                                        : 'Type resolution note or instruction...'
                                }
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

                                    {viewingDocumentRequest.status !== constants.DOCUMENT_REQUESTS_STATUS.RESOLVED && (
                                        <Button
                                            variant="secondary"
                                            onClick={() =>
                                                handleUpdateDocumentStatus(
                                                    viewingDocumentRequest.id,
                                                    constants.DOCUMENT_REQUESTS_STATUS.RESOLVED
                                                )
                                            }
                                        >
                                            Mark Resolved
                                        </Button>
                                    )}
                                    {viewingDocumentRequest.status !== constants.DOCUMENT_REQUESTS_STATUS.REJECTED && (
                                        <Button
                                            variant="destructive"
                                            onClick={() =>
                                                handleUpdateDocumentStatus(
                                                    viewingDocumentRequest.id,
                                                    constants.DOCUMENT_REQUESTS_STATUS.REJECTED
                                                )
                                            }
                                        >
                                            Reject
                                        </Button>
                                    )}
                                </div>

                                <Button
                                    variant="primary"
                                    onClick={handleSendReply}
                                    isDisabled={!replyMessage.trim() && stagedAttachments.length === 0}
                                >
                                    Send Message
                                </Button>
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
                    title="Attach Documents from Repository"
                    description="Select institutional files to attach to this thread."
                    size="md"
                    icon={Paperclip}
                    callout="Select institutional repository files to attach and share with all thread participants."
                    calloutVariant="neutral"
                    confirmLabel={stagedAttachments.length > 0 ? `Done (${stagedAttachments.length} staged)` : 'Done'}
                    onConfirm={handleCloseAttachModal}
                    cancelLabel="Cancel"
                    onCancel={handleCloseAttachModal}
                >
                    <div className="flex flex-col gap-3 py-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted pointer-events-none" />
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
                                attachableDocuments.map((doc) => {
                                    const isStaged = stagedAttachments.some((att) => att.documentId === doc.id);
                                    return (
                                        <div
                                            key={doc.id}
                                            onClick={() => handleSelectDocumentToAttach(doc)}
                                            className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                                isStaged ? 'bg-accent/10' : 'hover:bg-surface-hover'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <FileText className={`h-4 w-4 shrink-0 ${isStaged ? 'text-accent' : 'text-text-muted'}`} />
                                                <div className="flex flex-col min-w-0">
                                                    <span
                                                        className="text-xs font-semibold text-text truncate"
                                                        title={doc.name}
                                                    >
                                                        {doc.name}
                                                    </span>
                                                    <span className="text-xs text-text-muted">
                                                        {doc.classification ?? constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED}
                                                    </span>
                                                </div>
                                            </div>

                                            <Button
                                                variant={isStaged ? 'secondary' : 'primary'}
                                                leadingIcon={isStaged ? Check : undefined}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectDocumentToAttach(doc);
                                                }}
                                                className="shrink-0 text-xs px-3"
                                            >
                                                {isStaged ? 'Staged' : 'Attach'}
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* DELETE REQUEST CONFIRMATION MODAL */}
            {deletingRequestItem && (
                <Modal
                    isOpen={Boolean(deletingRequestItem)}
                    onClose={() => !isDeletingRequest && setDeletingRequestItem(null)}
                    title="Delete Request"
                    description={`Are you sure you want to delete this document request?`}
                    icon={Trash2}
                    variant="destructive"
                    size="sm"
                    callout="This request and all its associated messages and status history will be permanently deleted."
                    calloutVariant="destructive"
                    onConfirm={handleConfirmDeleteRequest}
                    confirmLabel={isDeletingRequest ? 'Deleting...' : 'Delete Request'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isDeletingRequest}
                    isConfirmDisabled={isDeletingRequest}
                />
            )}
        </Container>
    );
};


// --- EXPORTS ---
export { RequestsPage };
export default RequestsPage;
