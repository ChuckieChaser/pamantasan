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
    ShieldCheck,
    Lock,
    RotateCcw,
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
import { useToast, useAuth } from '../hooks';
import {
    useDepartmentStore,
    useDocumentStore,
    useUserStore,
    useAuthStore,
    useCoordinatorStore,
} from '../stores';
import { storageService, coordinatorApprovalService } from '../services';
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

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDividerTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
        return `Today at ${timeString}`;
    }
    if (isYesterday) {
        return `Yesterday at ${timeString}`;
    }
    const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateString} at ${timeString}`;
};

const formatFullDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};


// --- COMPONENTS ---
const RequestsPage = ({
    currentUser: propUser = null,
    selectedItem = null,
    onSelectRequest = null,
    className,
    ...props
}) => {
    // AUTH RESOLUTION
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const currentUser = propUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isCoordinator = constants.isCoordinatorRole(currentUser?.role);
    const isAdmin = constants.isAdminRole(currentUser?.role);

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
    const documentVersions = useDocumentStore((state) => state.documentVersions ?? []);
    const fetchDocumentRequests = useDocumentStore((state) => state.fetchDocumentRequests);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const insertDocumentRequest = useDocumentStore((state) => state.insertDocumentRequest);
    const updateDocumentRequest = useDocumentStore((state) => state.updateDocumentRequest);
    const deleteDocumentRequest = useDocumentStore((state) => state.deleteDocumentRequest);
    const insertDocumentRequestMessage = useDocumentStore((state) => state.insertDocumentRequestMessage);
    const insertDocumentRequestAttachment = useDocumentStore((state) => state.insertDocumentRequestAttachment);
    const coordinatorRequests = useCoordinatorStore((state) => state.coordinatorRequests ?? []);
    const fetchCoordinatorRequests = useCoordinatorStore((state) => state.fetchCoordinatorRequests);

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
        fetchCoordinatorRequests?.().catch(() => {});
    }, [fetchDocumentRequests, fetchDocuments, fetchUsers, fetchDepartments, fetchCoordinatorRequests]);

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

    // KEEP VIEWING DOCUMENT REQUEST IN SYNC WITH STORE UPDATES
    useEffect(() => {
        if (!viewingDocumentRequest) return;
        const liveReq = (documentRequests || []).find((r) => String(r.id) === String(viewingDocumentRequest.id));
        if (liveReq && String(liveReq.status).toUpperCase() !== String(viewingDocumentRequest.status).toUpperCase()) {
            setViewingDocumentRequest((prev) => (prev ? { ...prev, status: liveReq.status } : null));
        }
    }, [documentRequests, viewingDocumentRequest]);

    // DERIVED VALUES: ACCESS & DATA
    const activeUser = currentUser ?? authUser;
    const isStaff = constants.isStaffRole(activeUser?.role);
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
            }).map((att) => {
                const targetDocId = att.documentId ?? att.document?.id ?? att.id;
                const matchedDoc = (documents || []).find((d) => d.id === targetDocId);
                const vers = (documentVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === targetDocId
                );
                const latest = vers.length > 0
                    ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                    : null;
                return {
                    ...att,
                    documentId: targetDocId,
                    name: att.name ?? matchedDoc?.name ?? 'Attachment',
                    path: att.path ?? latest?.path ?? matchedDoc?.path,
                    sizeBytes: att.sizeBytes ?? latest?.sizeBytes ?? matchedDoc?.sizeBytes,
                    mimeType: att.mimeType ?? latest?.mimeType ?? matchedDoc?.mimeType,
                };
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
        }).map((att) => {
            const targetDocId = att.documentId ?? att.document?.id ?? att.id;
            const matchedDoc = (documents || []).find((d) => d.id === targetDocId);
            const vers = (documentVersions || []).filter(
                (v) => (v.document?.id ?? v.documentId) === targetDocId
            );
            const latest = vers.length > 0
                ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                : null;
            return {
                ...att,
                documentId: targetDocId,
                name: att.name ?? matchedDoc?.name ?? 'Attachment',
                path: att.path ?? latest?.path ?? matchedDoc?.path,
                sizeBytes: att.sizeBytes ?? latest?.sizeBytes ?? matchedDoc?.sizeBytes,
                mimeType: att.mimeType ?? latest?.mimeType ?? matchedDoc?.mimeType,
            };
        });
    }, [viewingDocumentRequest, attachments, documents, documentVersions]);

    const pendingAttachRequests = useMemo(() => {
        if (!viewingDocumentRequest) return [];
        const activeId = currentUser?.id;
        // PRIVACY GUARD: Only Admin or the submitting Coordinator can view pending attach requests!
        if (!isAdmin && !isCoordinator) return [];

        return (coordinatorRequests || []).filter((req) => {
            if (!req || req.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING) return false;
            if (
                req.action !== constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_ATTACH &&
                req.action !== constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ATTACH
            ) return false;

            const reqId = typeof req.requester === 'object' ? req.requester?.id : (req.requesterId ?? req.requester);
            if (!isAdmin && String(reqId) !== String(activeId)) return false;

            const payloadData = typeof req.data === 'string' ? JSON.parse(req.data || '{}') : (req.data || {});
            const targetDocReqId = payloadData.documentRequestId ?? payloadData.id;
            return String(targetDocReqId) === String(viewingDocumentRequest.id);
        });
    }, [viewingDocumentRequest, coordinatorRequests, isAdmin, isCoordinator, currentUser?.id]);

    const pendingStatusRequest = useMemo(() => {
        if (!viewingDocumentRequest) return null;
        const activeId = currentUser?.id;
        // PRIVACY GUARD: Only Admin or the submitting Coordinator can view pending status requests!
        if (!isAdmin && !isCoordinator) return null;

        return (coordinatorRequests || []).find((cr) => {
            if (!cr || cr.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING) return false;
            if (
                cr.action !== constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE &&
                cr.action !== constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT &&
                cr.action !== constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN
            ) return false;

            const reqId = typeof cr.requester === 'object' ? cr.requester?.id : (cr.requesterId ?? cr.requester);
            if (!isAdmin && String(reqId) !== String(activeId)) return false;

            const payloadData = typeof cr.data === 'string' ? JSON.parse(cr.data || '{}') : (cr.data || {});
            const targetDocReqId = payloadData.documentRequestId ?? payloadData.id;
            return String(targetDocReqId) === String(viewingDocumentRequest.id);
        });
    }, [viewingDocumentRequest, coordinatorRequests, isAdmin, isCoordinator, currentUser?.id]);

    const combinedThreadItems = useMemo(() => {
        const messageItems = activeViewingMessages.map((msg) => ({
            type: 'message',
            id: msg.id,
            createdAt: msg.createdAt,
            data: msg,
        }));

        const pendingItems = pendingAttachRequests.map((req) => ({
            type: 'pending_attach',
            id: `pending-${req.id}`,
            createdAt: req.createdAt,
            data: req,
        }));

        return [...messageItems, ...pendingItems].sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeA - timeB;
        });
    }, [activeViewingMessages, pendingAttachRequests]);

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

        const statusUpper = String(viewingDocumentRequest?.status || '').toUpperCase().trim();
        const isThreadLocked = statusUpper === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED ||
            statusUpper === constants.DOCUMENT_REQUESTS_STATUS.REJECTED ||
            statusUpper.includes('RESOLV') ||
            statusUpper.includes('REJECT');

        if (isThreadLocked) {
            showToast({
                type: 'warning',
                title: 'Thread Locked',
                description: 'This document request has been closed. Reopen it to send messages.',
            });
            return;
        }

        const currentStaged = [...stagedAttachments];
        const messageText =
            replyMessage.trim() ||
            (currentStaged.length > 0
                ? `Shared ${currentStaged.length === 1 ? currentStaged[0].name : `${currentStaged.length} documents`}`
                : '');

        if (isCoordinator && currentStaged.length > 0) {
            try {
                const userNote = replyMessage.trim();
                const attachPayload = {
                    documentRequestId: viewingDocumentRequest.id,
                    documentRequestSubject: viewingDocumentRequest.subject || viewingDocumentRequest.title || 'Document Request',
                    message: messageText,
                    userMessage: userNote,
                    hasExtraMessage: Boolean(userNote),
                    attachments: currentStaged,
                };

                const requesterId = activeUserId ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_ATTACH,
                    requesterId,
                    data: attachPayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                setReplyMessage('');
                setStagedAttachments([]);
                showToast({
                    type: 'success',
                    title: 'Attachment Request Submitted',
                    description: `Attached ${currentStaged.length} document${currentStaged.length === 1 ? '' : 's'} ${userNote ? 'with message ' : ''}queued for Administrator approval.`,
                });
                return;
            } catch (error) {
                showToast({
                    type: 'error',
                    title: 'Request Failed',
                    description: error?.message ?? 'Could not submit attachment request.',
                });
                return;
            }
        }

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

            const attachedDocIds = currentStaged.map((att) => att.documentId ?? att.id).filter(Boolean);
            const metaTag = attachedDocIds.length > 0 ? `<!-- attachments:[${attachedDocIds.join(',')}] -->` : '';
            const fullMessageText = metaTag ? `${messageText} ${metaTag}` : messageText;

            await insertDocumentRequestMessage({
                documentRequestId: viewingDocumentRequest.id,
                userId: activeUserId,
                message: fullMessageText,
            });

            setReplyMessage('');
            setStagedAttachments([]);
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Send Failed',
                description: error?.message ?? 'Failed to send message.',
            });
        }
    };

    const handleUpdateDocumentStatus = async (requestId, nextStatus) => {
        const targetReq = (documentRequests || []).find((r) => String(r.id) === String(requestId)) ?? viewingDocumentRequest ?? {};
        const isReopen = nextStatus === constants.DOCUMENT_REQUESTS_STATUS.OPEN && (
            targetReq.status === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED ||
            targetReq.status === constants.DOCUMENT_REQUESTS_STATUS.REJECTED
        );
        const isResolveOrReject = nextStatus === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED || nextStatus === constants.DOCUMENT_REQUESTS_STATUS.REJECTED;

        if (isCoordinator && (isResolveOrReject || isReopen)) {
            const existingPending = (coordinatorRequests || []).find((cr) => {
                if (!cr || cr.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING) return false;
                const payloadData = typeof cr.data === 'string' ? JSON.parse(cr.data || '{}') : (cr.data || {});
                return String(payloadData.documentRequestId ?? payloadData.id) === String(requestId);
            });

            if (existingPending) {
                showToast({
                    type: 'warning',
                    title: 'Action In Progress',
                    description: 'A governance request is already awaiting Administrator approval for this document request.',
                });
                return;
            }

            try {
                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                let action = constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN;
                let actionLabel = 'reopening';

                if (nextStatus === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED) {
                    action = constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE;
                    actionLabel = 'resolution';
                } else if (nextStatus === constants.DOCUMENT_REQUESTS_STATUS.REJECTED) {
                    action = constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT;
                    actionLabel = 'rejection';
                }

                await coordinatorApprovalService.submitCoordinatorRequest({
                    action,
                    requesterId,
                    data: {
                        documentRequestId: requestId,
                        subject: targetReq.subject || targetReq.title || 'Document Request',
                        requesterName: targetReq.requesterName || 'Member',
                        status: nextStatus,
                    },
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Document request ${actionLabel} sent for Administrator approval.`,
                });
                return;
            } catch (error) {
                showToast({
                    type: 'error',
                    title: 'Request Failed',
                    description: error?.message ?? 'Could not submit request.',
                });
                return;
            }
        }

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
                            {combinedThreadItems.length === 0 ? (
                                <div className="py-6 text-center text-xs text-text-muted">
                                    No thread messages available for this request.
                                </div>
                            ) : (
                                combinedThreadItems.map((threadItem, itemIndex) => {
                                    const prevItem = itemIndex > 0 ? combinedThreadItems[itemIndex - 1] : null;
                                    const prevTime = prevItem?.createdAt ? new Date(prevItem.createdAt).getTime() : null;
                                    const currTime = threadItem?.createdAt ? new Date(threadItem.createdAt).getTime() : Date.now();
                                    const showDivider = !prevTime || (currTime - prevTime >= 10 * 60 * 1000);

                                    if (threadItem.type === 'message') {
                                        const message = threadItem.data;
                                        const messageUserId = typeof message.user === 'object' ? message.user?.id : (message.userId ?? message.user);
                                        const messageUser = users.find((user) => user.id === messageUserId);
                                        const senderName = messageUser
                                            ? `${messageUser.firstName} ${messageUser.lastName}`
                                            : 'Institutional Staff';
                                        const isCurrentUser = messageUserId === currentUser?.id;
                                        const isAdministrativeUser = constants.isStaffRole(currentUser?.role);
                                        const isSenderAdministrative = constants.isStaffRole(messageUser?.role);
                                        const isFellowAdmin =
                                            !isCurrentUser &&
                                            isAdministrativeUser &&
                                            isSenderAdministrative;

                                        // Strict: ONLY messages explicitly approved by an admin have this badge!
                                        const isAdminApproved = Boolean(
                                            message.message && message.message.includes('admin_approved')
                                        );
                                        const cleanMessageText = (message.message || '').replace(/<!--[\s\S]*?-->/gi, '').trim();

                                        // Match exact attachments assigned to this message
                                        const messageAttachments = (() => {
                                            if (!message || !message.message) return [];
                                            const match = message.message.match(/<!--\s*attachments:\[(.*?)\]\s*-->/i);
                                            if (match && match[1]) {
                                                const idList = match[1].split(',').map((s) => s.trim()).filter(Boolean);
                                                if (idList.length > 0) {
                                                    return activeViewingAttachments.filter((att) => {
                                                        const targetDocId = att.documentId ?? att.document?.id ?? att.id;
                                                        return idList.includes(String(targetDocId)) || idList.includes(String(att.id));
                                                    });
                                                }
                                            }
                                            const msgTime = new Date(message.createdAt).getTime();
                                            return activeViewingAttachments.filter((att) => {
                                                const attUserId = typeof att.attachedBy === 'object' ? att.attachedBy?.id : (att.attachedById ?? att.attachedBy);
                                                const attTime = new Date(att.createdAt).getTime();
                                                const isSameUser = attUserId === messageUserId || (!attUserId && isCurrentUser);
                                                const isNearTime = Math.abs(attTime - msgTime) <= 10000;
                                                const isMentioned = att.name && message.message && message.message.includes(att.name);
                                                return isSameUser && (isNearTime || isMentioned);
                                            });
                                        })();

                                        const bubbleStyle = isCurrentUser
                                            ? 'bg-accent text-text-inverted rounded-br-sm'
                                            : isFellowAdmin
                                            ? 'bg-warning-background border border-warning-border text-text rounded-bl-sm'
                                            : 'bg-surface border border-surface-border text-text rounded-bl-sm';

                                        const formattedFullTime = formatFullDateTime(message.createdAt);

                                        return (
                                            <div key={message.id} className="flex flex-col w-full">
                                                {showDivider && (
                                                    <div className="flex items-center my-2.5 w-full">
                                                        <div className="flex-grow border-t border-surface-border/70"></div>
                                                        <span className="mx-3 text-[10px] font-medium text-text-muted/80 select-none">
                                                            {formatDividerTimestamp(message.createdAt)}
                                                        </span>
                                                        <div className="flex-grow border-t border-surface-border/70"></div>
                                                    </div>
                                                )}

                                                <div
                                                    className={`flex items-end gap-2 max-w-xl ${
                                                        isCurrentUser
                                                            ? 'self-end flex-row-reverse'
                                                            : 'self-start flex-row'
                                                    }`}
                                                    title={formattedFullTime}
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
                                                        <div className="flex items-center gap-2 text-xs text-text-muted px-1 select-none">
                                                            <span className="font-semibold">{senderName}</span>
                                                            {isFellowAdmin && (
                                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-warning-background text-warning border border-warning-border">
                                                                    {messageUser?.role}
                                                                </span>
                                                            )}
                                                            {isAdminApproved && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                                                    <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                                    Admin Approved
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div
                                                            className={`p-3 rounded-2xl text-xs leading-relaxed break-words select-text ${bubbleStyle}`}
                                                        >
                                                            <p className="whitespace-pre-wrap">{cleanMessageText}</p>

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
                                                                                        const targetDocId = attachment.documentId ?? attachment.document?.id ?? attachment.id;
                                                                                        let allVersions = useDocumentStore.getState().documentVersions ?? [];
                                                                                        let vers = allVersions.filter(
                                                                                            (v) => (v.document?.id ?? v.documentId) === targetDocId
                                                                                        );
                                                                                        if (vers.length === 0 && targetDocId) {
                                                                                            try {
                                                                                                const fetched = await useDocumentStore.getState().fetchDocumentVersions(targetDocId);
                                                                                                if (fetched && fetched.length > 0) {
                                                                                                    vers = fetched;
                                                                                                }
                                                                                            } catch {}
                                                                                        }
                                                                                        if (vers.length === 0) {
                                                                                            try {
                                                                                                const allFetched = await useDocumentStore.getState().fetchAllDocumentVersions();
                                                                                                if (allFetched && allFetched.length > 0) {
                                                                                                    vers = allFetched.filter((v) => (v.document?.id ?? v.documentId) === targetDocId);
                                                                                                }
                                                                                            } catch {}
                                                                                        }
                                                                                        const latestVer = vers.length > 0
                                                                                            ? [...vers].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
                                                                                            : null;
                                                                                        const matchedDoc = (documents || []).find((d) => d.id === targetDocId);
                                                                                        const path = attachment.path || latestVer?.path || matchedDoc?.path || attachment.url;
                                                                                        const fileName = attachment.name || matchedDoc?.name || (path ? path.split('/').pop() : 'attachment');

                                                                                        if (!path) {
                                                                                            throw new Error(`Could not find storage path for "${fileName}".`);
                                                                                        }

                                                                                        await storageService.downloadDocument(path, fileName);
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
                                            </div>
                                        );
                                    }

                                    // PENDING STAGED FILE APPROVAL BLOCK
                                    const pendingReq = threadItem.data;
                                    const payloadData = typeof pendingReq.data === 'string' ? JSON.parse(pendingReq.data || '{}') : (pendingReq.data || {});
                                    const pendingMsg = payloadData.message || '';
                                    const pendingAtts = payloadData.attachments || [];
                                    const reqUserId = pendingReq.requesterId ?? pendingReq.requester?.id;
                                    const requesterUser = users.find((u) => u.id === reqUserId);
                                    const isSelf = Boolean(currentUser?.id && String(reqUserId) === String(currentUser.id));
                                    const senderName = isSelf ? 'You' : (requesterUser ? `${requesterUser.firstName || ''} ${requesterUser.lastName || ''}`.trim() : 'Coordinator');
                                    const formattedPendingTime = formatFullDateTime(pendingReq.createdAt);

                                    return (
                                        <div key={threadItem.id} className="flex flex-col w-full">
                                            {showDivider && (
                                                <div className="flex items-center my-2.5 w-full">
                                                    <div className="flex-grow border-t border-surface-border/70"></div>
                                                    <span className="mx-3 text-[10px] font-medium text-text-muted/80 select-none">
                                                        {formatDividerTimestamp(pendingReq.createdAt)}
                                                    </span>
                                                    <div className="flex-grow border-t border-surface-border/70"></div>
                                                </div>
                                            )}

                                            <div
                                                className="flex flex-col gap-1 items-end max-w-xl self-end w-full"
                                                title={formattedPendingTime}
                                            >
                                                <div className="flex items-center gap-1.5 text-xs text-text-muted px-1 select-none">
                                                    <span className="font-semibold">{senderName}</span>
                                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-warning-background text-warning border border-warning-border">
                                                        Coordinator
                                                    </span>
                                                </div>

                                                <div className="w-full p-3.5 rounded-2xl rounded-br-sm text-xs leading-relaxed break-words bg-warning-background/30 border border-dashed border-warning-border text-text shadow-sm flex flex-col gap-2.5">
                                                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-warning-border/50">
                                                        <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
                                                            <Clock className="h-3.5 w-3.5 animate-pulse shrink-0" />
                                                            <span>Awaiting Administrator Approval</span>
                                                        </div>
                                                        {isAdmin && (
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <Button
                                                                    variant="primary"
                                                                    size="sm"
                                                                    leadingIcon={CheckCircle2}
                                                                    onClick={async () => {
                                                                        try {
                                                                            await coordinatorApprovalService.executeApprovedRequest(pendingReq, currentUser);
                                                                            await fetchCoordinatorRequests();
                                                                            showToast({
                                                                                type: 'success',
                                                                                title: 'Attachment Approved',
                                                                                description: 'Clearance documents and message posted to thread.',
                                                                            });
                                                                        } catch (err) {
                                                                            showToast({
                                                                                type: 'error',
                                                                                title: 'Approval Failed',
                                                                                description: err?.message ?? 'Could not approve request.',
                                                                            });
                                                                        }
                                                                    }}
                                                                    className="h-7 px-2 text-xs"
                                                                >
                                                                    Approve
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    leadingIcon={XCircle}
                                                                    onClick={async () => {
                                                                        try {
                                                                            await coordinatorApprovalService.rejectCoordinatorRequest(pendingReq);
                                                                            await fetchCoordinatorRequests();
                                                                            showToast({
                                                                                type: 'success',
                                                                                title: 'Request Rejected',
                                                                                description: 'Attachment request rejected and removed.',
                                                                            });
                                                                        } catch (err) {
                                                                            showToast({
                                                                                type: 'error',
                                                                                title: 'Rejection Failed',
                                                                                description: err?.message ?? 'Could not reject request.',
                                                                            });
                                                                        }
                                                                    }}
                                                                    className="h-7 px-2 text-xs"
                                                                >
                                                                    Reject
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {pendingMsg && (
                                                        <p className="whitespace-pre-wrap text-text font-medium">{pendingMsg}</p>
                                                    )}

                                                    {pendingAtts.length > 0 && (
                                                        <div className="flex flex-col gap-1.5 pt-1">
                                                            <span className="text-[11px] font-semibold text-text-muted">
                                                                Staged Clearance Files ({pendingAtts.length}):
                                                            </span>
                                                            {pendingAtts.map((att, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="p-2 rounded-lg flex items-center justify-between gap-2 text-xs bg-surface/80 border border-surface-border"
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <Paperclip className="h-3.5 w-3.5 text-warning shrink-0" />
                                                                        <span className="font-semibold truncate text-xs" title={att.name}>
                                                                            {att.name}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[10px] text-text-muted shrink-0">
                                                                        {att.sizeBytes ? formatBytes(att.sizeBytes) : 'File'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="text-[10px] text-text-muted italic pt-1 border-t border-warning-border/30">
                                                        This clearance file and message will be delivered to the requester once approved by an Administrator.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* POST REPLY OR LOCKED THREAD BANNER */}
                        {(() => {
                            const statusUpper = String(viewingDocumentRequest?.status || '').toUpperCase().trim();
                            const isThreadLocked = statusUpper === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED ||
                                statusUpper === constants.DOCUMENT_REQUESTS_STATUS.REJECTED ||
                                statusUpper.includes('RESOLV') ||
                                statusUpper.includes('REJECT');

                            if (isThreadLocked) {
                                return (
                                    <div className="flex flex-col gap-3 pt-3 border-t border-surface-border">
                                        <div className="p-3.5 rounded-xl border border-surface-border bg-surface-hover/70 flex items-center justify-between gap-3 text-xs">
                                            <div className="flex items-center gap-2.5 text-text-muted">
                                                <Lock className="h-4 w-4 text-text-muted shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-text">
                                                        This document request is {viewingDocumentRequest.status.toLowerCase()}.
                                                    </span>
                                                    <span className="text-[11px] text-text-muted">
                                                        Messaging is locked. Conversation history is preserved as read-only.
                                                    </span>
                                                </div>
                                            </div>
                                            {pendingStatusRequest && pendingStatusRequest.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN ? (
                                                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <Clock className="h-3.5 w-3.5 animate-pulse shrink-0 text-amber-500" />
                                                        <span className="font-semibold">
                                                            Reopen awaiting Admin approval
                                                        </span>
                                                    </div>
                                                    {isAdmin && (
                                                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                                            <Button
                                                                variant="primary"
                                                                size="sm"
                                                                leadingIcon={CheckCircle2}
                                                                onClick={async () => {
                                                                    try {
                                                                        await coordinatorApprovalService.executeApprovedRequest(pendingStatusRequest, currentUser);
                                                                        await fetchCoordinatorRequests();
                                                                        showToast({
                                                                            type: 'success',
                                                                            title: 'Request Approved',
                                                                            description: 'Document request reopened.',
                                                                        });
                                                                    } catch (err) {
                                                                        showToast({
                                                                            type: 'error',
                                                                            title: 'Approval Failed',
                                                                            description: err?.message ?? 'Could not approve request.',
                                                                        });
                                                                    }
                                                                }}
                                                                className="h-6 px-2 text-[11px]"
                                                            >
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                leadingIcon={XCircle}
                                                                onClick={async () => {
                                                                    try {
                                                                        await coordinatorApprovalService.updateCoordinatorRequestStatus({
                                                                            requestId: pendingStatusRequest.id,
                                                                            status: constants.COORDINATOR_REQUESTS_STATUS.REJECTED,
                                                                        });
                                                                        await fetchCoordinatorRequests();
                                                                        showToast({
                                                                            type: 'warning',
                                                                            title: 'Request Rejected',
                                                                            description: 'Reopen request rejected.',
                                                                        });
                                                                    } catch (err) {
                                                                        showToast({
                                                                            type: 'error',
                                                                            title: 'Rejection Failed',
                                                                            description: err?.message ?? 'Could not reject request.',
                                                                        });
                                                                    }
                                                                }}
                                                                className="h-6 px-2 text-[11px]"
                                                            >
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                constants.isStaffRole(currentUser?.role) && (
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        leadingIcon={RotateCcw}
                                                        onClick={() =>
                                                            handleUpdateDocumentStatus(
                                                                viewingDocumentRequest.id,
                                                                constants.DOCUMENT_REQUESTS_STATUS.OPEN
                                                            )
                                                        }
                                                        className="shrink-0 text-xs"
                                                    >
                                                        Reopen Request
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            return (
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

                                            {pendingStatusRequest ? (
                                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <Clock className="h-3.5 w-3.5 animate-pulse shrink-0 text-amber-500" />
                                                        <span className="font-semibold">
                                                            {pendingStatusRequest.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE
                                                                ? 'Resolution'
                                                                : pendingStatusRequest.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN
                                                                ? 'Reopen'
                                                                : 'Rejection'} awaiting Admin approval
                                                        </span>
                                                    </div>
                                                    {isAdmin && (
                                                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                                            <Button
                                                                variant="primary"
                                                                size="sm"
                                                                leadingIcon={CheckCircle2}
                                                                onClick={async () => {
                                                                    try {
                                                                        await coordinatorApprovalService.executeApprovedRequest(pendingStatusRequest, currentUser);
                                                                        await fetchCoordinatorRequests();
                                                                        showToast({
                                                                            type: 'success',
                                                                            title: 'Request Approved',
                                                                            description: 'Document request status updated.',
                                                                        });
                                                                    } catch (err) {
                                                                        showToast({
                                                                            type: 'error',
                                                                            title: 'Approval Failed',
                                                                            description: err?.message ?? 'Could not approve request.',
                                                                        });
                                                                    }
                                                                }}
                                                                className="h-6 px-2 text-[11px]"
                                                            >
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                leadingIcon={XCircle}
                                                                onClick={async () => {
                                                                    try {
                                                                        await coordinatorApprovalService.updateCoordinatorRequestStatus({
                                                                            requestId: pendingStatusRequest.id,
                                                                            status: constants.COORDINATOR_REQUESTS_STATUS.REJECTED,
                                                                        });
                                                                        await fetchCoordinatorRequests();
                                                                        showToast({
                                                                            type: 'warning',
                                                                            title: 'Request Rejected',
                                                                            description: 'Request was rejected.',
                                                                        });
                                                                    } catch (err) {
                                                                        showToast({
                                                                            type: 'error',
                                                                            title: 'Rejection Failed',
                                                                            description: err?.message ?? 'Could not reject request.',
                                                                        });
                                                                    }
                                                                }}
                                                                className="h-6 px-2 text-[11px]"
                                                            >
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
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
                                                </>
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
                            );
                        })()}
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
