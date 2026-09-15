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
    Plus,
} from 'lucide-react';
import {
    AreaField,
    Avatar,
    Browser,
    Button,
    Container,
    Modal,
    SegmentSelection,
    SelectField,
    TextField,
} from '../components';
import { useToast } from '../hooks';
import {
    useCoordinatorStore,
    useDepartmentStore,
    useDocumentStore,
    useUserStore,
} from '../stores';
import { constants } from '../constants';


// --- CONFIGURATIONS ---
const TAB_OPTIONS = [
    { value: 'coordinator', label: 'Coordinator Requests', icon: UserCheck },
    { value: 'document', label: 'Document Requests', icon: Inbox },
];

const PRESET_REQUEST_TYPES = [
    { value: 'Official Transcript of Records Clearance', label: 'Official Transcript of Records Clearance' },
    { value: 'Certificate of Good Moral Character', label: 'Certificate of Good Moral Character' },
    { value: 'Certified True Copy of Academic Records', label: 'Certified True Copy of Academic Records' },
    { value: 'Curriculum Evaluation Clearance', label: 'Curriculum Evaluation Clearance' },
    { value: 'Special Institutional Certification', label: 'Special Institutional Certification' },
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
    { category: 'Review Status', value: constants.COORDINATOR_REQUESTS_STATUS.PENDING, label: 'Pending', icon: Clock },
    { category: 'Review Status', value: constants.COORDINATOR_REQUESTS_STATUS.APPROVED, label: 'Approved', icon: CheckCircle2 },
    { category: 'Review Status', value: constants.COORDINATOR_REQUESTS_STATUS.REJECTED, label: 'Rejected', icon: XCircle },
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
    { category: 'Processing Status', value: constants.DOCUMENT_REQUESTS_STATUS.OPEN, label: 'Open', icon: Clock },
    { category: 'Processing Status', value: constants.DOCUMENT_REQUESTS_STATUS.RESOLVED, label: 'Resolved', icon: CheckCircle2 },
    { category: 'Processing Status', value: constants.DOCUMENT_REQUESTS_STATUS.REJECTED, label: 'Rejected', icon: XCircle },
];


// --- COMPONENTS ---
const RequestsPage = ({
    currentUser = null,
    initialTab = 'coordinator',
    onSelectRequest = null,
    className,
    ...props
}) => {
    // STATES
    const [activeTab, setActiveTab] = useState(initialTab);
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

    // DOCUMENT CREATE MODAL STATES
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedPresetType, setSelectedPresetType] = useState(PRESET_REQUEST_TYPES[0].value);
    const [customSubject, setCustomSubject] = useState('');
    const [requestDetails, setRequestDetails] = useState('');
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // HOOKS
    const { showToast } = useToast();

    // STORES
    const coordinatorRequests = useCoordinatorStore((state) => state.coordinatorRequests);
    const updateCoordinatorRequest = useCoordinatorStore((state) => state.updateCoordinatorRequest);
    const deleteCoordinatorRequest = useCoordinatorStore((state) => state.deleteCoordinatorRequest);

    const documentRequests = useDocumentStore((state) => state.documentRequests);
    const messages = useDocumentStore((state) => state.documentRequestMessages);
    const attachments = useDocumentStore((state) => state.documentRequestAttachments);
    const documents = useDocumentStore((state) => state.documents);
    const insertDocumentRequest = useDocumentStore((state) => state.insertDocumentRequest);
    const updateDocumentRequest = useDocumentStore((state) => state.updateDocumentRequest);
    const deleteDocumentRequest = useDocumentStore((state) => state.deleteDocumentRequest);
    const insertDocumentRequestMessage = useDocumentStore((state) => state.insertDocumentRequestMessage);
    const insertDocumentRequestAttachment = useDocumentStore((state) => state.insertDocumentRequestAttachment);

    const users = useUserStore((state) => state.users);
    const departments = useDepartmentStore((state) => state.departments);

    // DERIVED VALUES: ACCESS & TABS
    const isStaff = currentUser?.role === constants.USERS_ROLE.ADMINISTRATOR || currentUser?.role === constants.USERS_ROLE.COORDINATOR;
    const effectiveActiveTab = isStaff ? activeTab : 'document';

    // DERIVED VALUES: DATA
    const formattedCoordinatorData = useMemo(() => {
        return coordinatorRequests.map((request) => {
            const requester = users.find((user) => user.id === request.requester_id || user.id === request.requesterId);
            const department = departments.find((dept) => dept.id === requester?.department_id || dept.id === requester?.departmentId);
            const requesterName = requester ? `${requester.first_name ?? requester.firstName} ${requester.last_name ?? requester.lastName}` : 'Coordinator';
            const departmentCode = department?.code ?? 'Central';
            const actionFormatted = (request.action ?? '').replace(/_/g, ' ');

            return {
                ...request,
                id: request.id,
                title: actionFormatted,
                action: request.action,
                requester_id: request.requester_id ?? request.requesterId,
                requesterName,
                user: requesterName,
                department: department?.name ?? departmentCode,
                department_code: departmentCode,
                status: request.status,
                data: request.data,
                rejection_reason: request.rejection_reason ?? request.rejectionReason ?? null,
                metadata: `${requesterName} (${departmentCode})`,
                description: `Coordinator request for ${actionFormatted}: ${JSON.stringify(request.data)}`,
                created_at: request.created_at ?? request.createdAt,
                updated_at: request.updated_at ?? request.updatedAt ?? request.created_at,
                date: new Date(request.created_at ?? request.createdAt ?? Date.now()).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
                badge: request.status,
            };
        });
    }, [coordinatorRequests, users, departments]);

    const formattedDocumentData = useMemo(() => {
        const filteredRequests = isStaff
            ? documentRequests
            : documentRequests.filter((req) => (req.requester_id ?? req.requesterId) === (currentUser?.id ?? 'f1000001-0000-4000-8000-000000000005'));

        return filteredRequests.map((request) => {
            const requester = users.find((user) => user.id === (request.requester_id ?? request.requesterId));
            const requestMessages = messages.filter((message) => (message.document_request_id ?? message.documentRequestId) === request.id);
            const requestAttachments = attachments.filter((attachment) => (attachment.document_request_id ?? attachment.documentRequestId) === request.id);
            const requesterName = requester ? `${requester.first_name ?? requester.firstName} ${requester.last_name ?? requester.lastName}` : 'Faculty Member';

            return {
                ...request,
                id: request.id,
                title: request.subject,
                subject: request.subject,
                requester_id: request.requester_id ?? request.requesterId,
                requesterName,
                user: requesterName,
                purpose: request.purpose ?? 'Document issuance, clearance, and certificate verification.',
                status: request.status,
                messages: requestMessages,
                attachments: requestAttachments,
                messageCount: `${requestMessages.length} messages`,
                metadata: `${requesterName} · ${requestMessages.length} msgs`,
                description: request.purpose ?? `Document request from ${requesterName} with ${requestMessages.length} updates.`,
                created_at: request.created_at ?? request.createdAt,
                updated_at: request.updated_at ?? request.updatedAt ?? request.created_at,
                date: new Date(request.created_at ?? request.createdAt ?? Date.now()).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
                badge: request.status,
            };
        });
    }, [documentRequests, messages, attachments, users, currentUser, isStaff]);

    const activeViewingMessages = useMemo(() => {
        if (!viewingDocumentRequest) {
            return [];
        }
        return messages.filter(
            (message) => (message.document_request_id ?? message.documentRequestId) === viewingDocumentRequest.id
        );
    }, [viewingDocumentRequest, messages]);

    const activeViewingAttachments = useMemo(() => {
        if (!viewingDocumentRequest) {
            return [];
        }
        return attachments.filter(
            (attachment) => (attachment.document_request_id ?? attachment.documentRequestId) === viewingDocumentRequest.id
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
            const activeUserId = currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001';
            await updateCoordinatorRequest(requestId, {
                reviewerId: activeUserId,
                status: constants.COORDINATOR_REQUESTS_STATUS.APPROVED,
            });

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
            const activeUserId = currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001';
            await updateCoordinatorRequest(rejectingCoordinatorRequest.id, {
                reviewerId: activeUserId,
                status: constants.COORDINATOR_REQUESTS_STATUS.REJECTED,
                rejectionReason: rejectionReason.trim() || 'Request rejected by Administrator.',
            });

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
                await insertDocumentRequestAttachment({
                    documentRequestId: viewingDocumentRequest.id,
                    documentId: stagedAttachment.document_id,
                    attachedById: activeUserId,
                });
            }

            await insertDocumentRequestMessage({
                documentRequestId: viewingDocumentRequest.id,
                userId: activeUserId,
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
            handleUpdateDocumentStatus(item.id, constants.DOCUMENT_REQUESTS_STATUS.RESOLVED);
            return;
        }

        if (actionKey === 'reject') {
            handleUpdateDocumentStatus(item.id, constants.DOCUMENT_REQUESTS_STATUS.REJECTED);
            return;
        }

        if (actionKey === 'delete') {
            handleDeleteDocumentRequest(item.id);
        }
    };

    // HANDLERS: DOCUMENT CREATION MODAL
    const handleOpenCreateModal = () => {
        setSelectedPresetType(PRESET_REQUEST_TYPES[0].value);
        setCustomSubject('');
        setRequestDetails('');
        setFormError('');
        setIsCreateModalOpen(true);
    };

    const handleCloseCreateModal = () => {
        setIsCreateModalOpen(false);
        setFormError('');
    };

    const handleSubmitDocumentRequest = async () => {
        const finalSubject = customSubject.trim() || selectedPresetType;

        if (!finalSubject) {
            setFormError('Please select or specify a request subject.');
            return;
        }

        if (!requestDetails.trim()) {
            setFormError('Please provide details or purpose for this document request.');
            return;
        }

        setIsSubmitting(true);
        setFormError('');

        try {
            const activeUserId = currentUser?.id ?? 'f1000001-0000-4000-8000-000000000005';
            const newRequest = await insertDocumentRequest({
                requesterId: activeUserId,
                subject: finalSubject,
            });

            await insertDocumentRequestMessage({
                documentRequestId: newRequest.id,
                userId: activeUserId,
                message: requestDetails.trim(),
            });

            showToast({
                type: 'success',
                title: 'Request Submitted',
                description: `Your request for "${finalSubject}" has been queued for verification.`,
            });

            handleCloseCreateModal();
        } catch (error) {
            setFormError(error?.message ?? 'Failed to submit document request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // RENDER
    return (
        <Container variant="page" className={`flex flex-col gap-6 ${className ?? ''}`} {...props}>
            {/* VIEW MODE SEGMENT SWITCHER (STAFF USERS) */}
            {isStaff && (
                <div className="flex items-center justify-between gap-4">
                    <SegmentSelection
                        value={effectiveActiveTab}
                        options={TAB_OPTIONS}
                        onChange={handleTabChange}
                    />
                </div>
            )}

            {/* BROWSER 1: COORDINATOR REQUESTS */}
            {effectiveActiveTab === 'coordinator' && (
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
            {effectiveActiveTab === 'document' && (
                <Browser
                    resourceName="document_requests"
                    title="Manage Requests"
                    description="Review, process, and clear institutional document verification requests."
                    data={formattedDocumentData}
                    columns={DOCUMENT_COLUMNS}
                    sortOptions={DOCUMENT_SORT_OPTIONS}
                    filterOptions={DOCUMENT_FILTER_OPTIONS}
                    selectedItem={selectedRequestItem}
                    addItemLabel="New Request"
                    addItemIcon={Plus}
                    searchPlaceholder="Search by request subject or requester..."
                    onAddItem={handleOpenCreateModal}
                    onSelectItem={handleSelectRequest}
                    onOpenItem={handleOpenDocumentThread}
                    onItemAction={handleDocumentAction}
                />
            )}

            {/* NEW DOCUMENT REQUEST MODAL */}
            {isCreateModalOpen && (
                <Modal
                    isOpen={isCreateModalOpen}
                    onClose={handleCloseCreateModal}
                    title="New Document Request"
                    description="Submit document clearance or certificate request to administration."
                    onConfirm={handleSubmitDocumentRequest}
                    confirmLabel={isSubmitting ? 'Submitting...' : 'Submit Request'}
                    isConfirmDisabled={isSubmitting}
                    isConfirmLoading={isSubmitting}
                    cancelLabel="Cancel"
                >
                    <div className="flex flex-col gap-4 py-2">
                        {formError && (
                            <div className="p-3 rounded-lg bg-error-background border border-error-border text-xs text-error">
                                {formError}
                            </div>
                        )}

                        <SelectField
                            label="Document Type Preset"
                            value={selectedPresetType}
                            onChange={(value) => setSelectedPresetType(value)}
                            options={PRESET_REQUEST_TYPES}
                        />

                        <TextField
                            label="Custom Subject / Specific Purpose (Optional)"
                            placeholder="e.g. For CHED Scholarship Clearance 2026"
                            value={customSubject}
                            onChange={(changeEvent) => setCustomSubject(changeEvent.target.value)}
                            helper="Leave blank to use the preset document type title."
                        />

                        <AreaField
                            label="Purpose & Special Instructions"
                            placeholder="Provide details regarding the intended use, recipient agency, or specific requirements..."
                            value={requestDetails}
                            onChange={(changeEvent) => setRequestDetails(changeEvent.target.value)}
                            rows={4}
                        />
                    </div>
                </Modal>
            )}

            {/* COORDINATOR REVIEW DETAILS MODAL */}
            {viewingCoordinatorRequest && (
                <Modal
                    isOpen={Boolean(viewingCoordinatorRequest)}
                    onClose={() => setViewingCoordinatorRequest(null)}
                    title={`Review Request: ${(viewingCoordinatorRequest.action ?? '').replace(/_/g, ' ')}`}
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

                        {viewingCoordinatorRequest.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING && (
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        const requestToReject = viewingCoordinatorRequest;
                                        setViewingCoordinatorRequest(null);
                                        handleStartCoordinatorRejection(requestToReject);
                                    }}
                                >
                                    Reject Request
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => handleApproveCoordinatorRequest(viewingCoordinatorRequest.id)}
                                >
                                    Approve & Execute
                                </Button>
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
                                    const messageUser = users.find((user) => user.id === (message.user_id ?? message.userId));
                                    const senderName = messageUser
                                        ? `${messageUser.first_name ?? messageUser.firstName} ${messageUser.last_name ?? messageUser.lastName}`
                                        : 'Institutional Staff';
                                    const isCurrentUser = (message.user_id ?? message.userId) === currentUser?.id;
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

                                    const messageAttachments = activeViewingAttachments.filter(
                                        (att) =>
                                            (att.attached_by_id ?? att.attachedById) === (message.user_id ?? message.userId) ||
                                            (!(att.attached_by_id ?? att.attachedById) && isCurrentUser)
                                    );

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
                                            {/* SENDER AVATAR */}
                                            <Avatar
                                                src={messageUser?.avatar_path ?? messageUser?.avatarPath}
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
                                                        {new Date(message.created_at ?? message.createdAt ?? Date.now()).toLocaleTimeString([], {
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
                            {/* STAGED ATTACHMENT CHIP */}
                            {stagedAttachment && (
                                <div className="px-3 py-2 rounded-lg bg-accent-background border border-accent-border flex items-center justify-between text-xs text-accent">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Paperclip className="h-4 w-4 shrink-0" />
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
                                        <X className="h-4 w-4" />
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
                                    isDisabled={!replyMessage.trim() && !stagedAttachment}
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
                    title="Attach Document from Repository"
                    description="Select an institutional file to attach to this thread."
                    size="md"
                    icon={Paperclip}
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
                                attachableDocuments.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="p-3 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FileText className="h-4 w-4 text-accent shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span
                                                    className="text-xs font-semibold text-text truncate"
                                                    title={doc.name}
                                                >
                                                    {doc.name}
                                                </span>
                                                <span className="text-xs text-text-muted">
                                                    {doc.classification ?? 'OFFICIAL'}
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            variant="primary"
                                            onClick={() => handleSelectDocumentToAttach(doc)}
                                            className="shrink-0 text-xs px-3"
                                        >
                                            Attach
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </Container>
    );
};


// --- EXPORTS ---
export { RequestsPage };
export default RequestsPage;
