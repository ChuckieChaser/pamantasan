// --- IMPORTS ---
import { useState, useMemo, useEffect } from 'react';
import {
    UserCheck,
    CheckCircle2,
    XCircle,
    Clock,
    ClipboardCheck,
    Trash2,
    ArrowDownAZ,
    ArrowUpAZ,
} from 'lucide-react';
import {
    AreaField,
    Browser,
    Button,
    Container,
    History,
    Modal,
    formatDateTime,
} from '../components';
import { useToast, useAuth } from '../hooks';
import {
    useCoordinatorStore,
    useDepartmentStore,
    useUserStore,
    useAuthStore,
} from '../stores';
import { constants } from '../constants';
import { coordinatorApprovalService } from '../services';


// --- CONFIGURATIONS ---
const COORDINATOR_COLUMNS = [
    { key: 'title', label: 'Action Requested' },
    { key: 'requester', label: 'Coordinator' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Submitted Date' },
];

const COORDINATOR_SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A to Z)', icon: ArrowDownAZ },
    { value: 'name-desc', label: 'Name (Z to A)', icon: ArrowUpAZ },
    { value: 'date-desc', label: 'Recently Added', icon: Clock },
    { value: 'date-asc', label: 'Oldest Added', icon: Clock },
];

const COORDINATOR_FILTER_OPTIONS = [
    { category: 'Action', value: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_ATTACH, label: 'Document Attach' },
    { category: 'Action', value: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ATTACH, label: 'Direct Attach' },
    { category: 'Action', value: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE, label: 'Document Resolve' },
    { category: 'Action', value: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT, label: 'Document Reject' },
    { category: 'Action', value: constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN, label: 'Document Reopen' },
    { category: 'Action', value: constants.COORDINATOR_REQUESTS_ACTION.USER_CREATE, label: 'User Create' },
];


// --- COMPONENTS ---
const CoordinatorPage = ({
    currentUser = null,
    selectedItem = null,
    onSelectRequest = null,
    className,
    ...props
}) => {
    // STATES
    const [selectedRequestItem, setSelectedRequestItem] = useState(null);
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const activeUser = currentUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isAdmin = constants.isAdminRole(activeUser?.role);

    // MODAL STATES
    const [viewingCoordinatorRequest, setViewingCoordinatorRequest] = useState(null);
    const [approvingCoordinatorRequest, setApprovingCoordinatorRequest] = useState(null);
    const [isApprovingRequest, setIsApprovingRequest] = useState(false);
    const [rejectingCoordinatorRequest, setRejectingCoordinatorRequest] = useState(null);
    const [isRejectingRequest, setIsRejectingRequest] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // DELETION CONFIRMATION STATE
    const [deletingRequestItem, setDeletingRequestItem] = useState(null);
    const [isDeletingRequest, setIsDeletingRequest] = useState(false);

    // HOOKS
    const { showToast } = useToast();

    // STORES
    const coordinatorRequests = useCoordinatorStore((state) => state.coordinatorRequests);
    const fetchCoordinatorRequests = useCoordinatorStore((state) => state.fetchCoordinatorRequests);
    const updateCoordinatorRequest = useCoordinatorStore((state) => state.updateCoordinatorRequest);
    const deleteCoordinatorRequest = useCoordinatorStore((state) => state.deleteCoordinatorRequest);

    const users = useUserStore((state) => state.users);
    const fetchUsers = useUserStore((state) => state.fetchUsers);
    const departments = useDepartmentStore((state) => state.departments);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);

    // EFFECTS
    useEffect(() => {
        fetchCoordinatorRequests?.().catch(() => {});
        fetchUsers?.().catch(() => {});
        fetchDepartments?.().catch(() => {});
    }, [fetchCoordinatorRequests, fetchUsers, fetchDepartments]);

    // LISTEN FOR EXTERNAL ACTIONS (E.G. FROM INSPECTOR QUICK ACTIONS)
    useEffect(() => {
        const handleApproveCoordinatorRequestEvent = (event) => {
            if (event.detail) {
                const targetRequest = (coordinatorRequests || []).find((r) => r.id === event.detail.id) ?? event.detail;
                handleStartCoordinatorApproval(targetRequest);
            }
        };

        const handleRejectCoordinatorRequestEvent = (event) => {
            if (event.detail) {
                const targetRequest = (coordinatorRequests || []).find((r) => r.id === event.detail.id) ?? event.detail;
                handleStartCoordinatorRejection(targetRequest);
            }
        };

        const handleDeleteCoordinatorRequestEvent = (event) => {
            if (event.detail) {
                const targetRequest = (coordinatorRequests || []).find((r) => r.id === event.detail.id) ?? event.detail;
                if (targetRequest.status && targetRequest.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING) {
                    showToast({
                        type: 'error',
                        title: 'Action Prohibited',
                        description: 'Only pending coordinator requests can be deleted. Finalized requests cannot be removed.',
                    });
                    return;
                }
                setDeletingRequestItem(targetRequest);
            }
        };

        window.addEventListener('pamantasan:approve-coordinator-request', handleApproveCoordinatorRequestEvent);
        window.addEventListener('pamantasan:reject-coordinator-request', handleRejectCoordinatorRequestEvent);
        window.addEventListener('pamantasan:delete-coordinator-request', handleDeleteCoordinatorRequestEvent);

        return () => {
            window.removeEventListener('pamantasan:approve-coordinator-request', handleApproveCoordinatorRequestEvent);
            window.removeEventListener('pamantasan:reject-coordinator-request', handleRejectCoordinatorRequestEvent);
            window.removeEventListener('pamantasan:delete-coordinator-request', handleDeleteCoordinatorRequestEvent);
        };
    }, [coordinatorRequests, showToast]);

    // DERIVED VALUES: DATA
    const formattedCoordinatorData = useMemo(() => {
        const activeId = activeUser?.id ?? currentUser?.id;
        const visibleRequests = isAdmin
            ? coordinatorRequests
            : coordinatorRequests.filter((request) => {
                if (!request) return false;
                const reqId = typeof request.requester === 'object'
                    ? request.requester?.id
                    : (request.requesterId ?? request.requester);
                return Boolean(activeId && reqId && String(reqId) === String(activeId));
            });

        return visibleRequests.map((request) => {
            const requesterId = typeof request.requester === 'object' ? request.requester?.id : (request.requesterId ?? request.requester);
            const requester = users.find((user) => user.id === requesterId);
            const department = departments.find((dept) => dept.id === requester?.departmentId);
            const requesterName = requester ? `${requester.firstName} ${requester.lastName}` : 'Coordinator';
            const departmentCode = department?.code ?? 'Central';
            const actionFormatted = (request.action ?? '').replace(/_/g, ' ');

            const createdAtDate = request.createdAt || new Date().toISOString();
            const updatedAtDate = request.updatedAt ?? createdAtDate;
            const formattedDate = (createdAtDate && !isNaN(new Date(createdAtDate).getTime()))
                ? formatDateTime(createdAtDate)
                : 'Recent';

            const dataPayload = typeof request.data === 'string' ? JSON.parse(request.data || '{}') : (request.data || {});
            let displayTitle = actionFormatted;
            let displayDescription = `Coordinator request for ${actionFormatted}`;

            if (request.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_ATTACH || request.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_ATTACH) {
                const count = Array.isArray(dataPayload.attachments) ? dataPayload.attachments.length : 1;
                displayTitle = 'DOCUMENT ATTACHMENT';
                displayDescription = `Attach ${count} file${count === 1 ? '' : 's'} to "${dataPayload.documentRequestSubject || 'Document Request'}": "${dataPayload.message || ''}"`;
            } else if (request.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE || request.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REJECT) {
                displayTitle = 'DOCUMENT RESOLUTION';
                const isResolve = request.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_RESOLVE;
                displayDescription = `Mark document request "${dataPayload.subject || dataPayload.documentRequestSubject || 'Document Request'}" as ${isResolve ? 'Resolved' : 'Rejected'}`;
            } else if (request.action === constants.COORDINATOR_REQUESTS_ACTION.DOCUMENT_REQUEST_REOPEN) {
                displayTitle = 'DOCUMENT REOPEN';
                displayDescription = `Reopen document request "${dataPayload.subject || dataPayload.documentRequestSubject || 'Document Request'}" (Status to Open)`;
            }

            const requesterAvatar = requester?.avatarPath ?? null;

            return {
                ...request,
                id: request.id,
                title: displayTitle,
                action: request.action,
                requesterId: requesterId,
                requesterName,
                requester: requesterName,
                requesterUser: requester,
                requesterAvatar,
                avatarPath: requesterAvatar,
                user: requesterName,
                department: department?.name ?? departmentCode,
                departmentCode: departmentCode,
                status: request.status,
                data: request.data,
                rejectionReason: request.rejectionReason ?? dataPayload.rejectionReason ?? null,
                metadata: `${requesterName} (${departmentCode})`,
                description: displayDescription,
                createdAt: createdAtDate,
                updatedAt: updatedAtDate,
                date: formattedDate,
                badge: request.status,
            };
        });
    }, [coordinatorRequests, users, departments, isAdmin, activeUser?.id]);

    const pendingCoordinatorData = useMemo(() => {
        return formattedCoordinatorData.filter(
            (request) => request.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING
        );
    }, [formattedCoordinatorData]);

    const resolvedCoordinatorData = useMemo(() => {
        return formattedCoordinatorData.filter(
            (request) =>
                request.status === constants.COORDINATOR_REQUESTS_STATUS.APPROVED ||
                request.status === constants.COORDINATOR_REQUESTS_STATUS.REJECTED
        );
    }, [formattedCoordinatorData]);

    // DERIVED SELECTION: Stays reactive to store updates and formatted data
    const activeSelectedRequest = useMemo(() => {
        const targetId = selectedItem?.id ?? selectedRequestItem?.id;
        if (!targetId) return null;
        const matched = formattedCoordinatorData.find((item) => item.id === targetId);
        if (matched) {
            return {
                ...matched,
                _targetTab: selectedItem?._targetTab ?? selectedRequestItem?._targetTab ?? 'information',
            };
        }
        return isAdmin ? (selectedItem ?? selectedRequestItem) : null;
    }, [selectedItem, selectedRequestItem, formattedCoordinatorData, isAdmin]);

    // HANDLERS
    const handleSelectRequest = (item, targetTab = 'information') => {
        const itemWithTab = item ? { ...item, _targetTab: targetTab } : null;
        setSelectedRequestItem(itemWithTab);
        onSelectRequest?.(itemWithTab, targetTab);
    };

    const handleOpenCoordinatorReview = (requestItem) => {
        setViewingCoordinatorRequest(requestItem);
    };

    const handleStartCoordinatorApproval = (requestItem) => {
        setApprovingCoordinatorRequest(requestItem);
    };

    const handleConfirmApproveRequest = async () => {
        if (!approvingCoordinatorRequest) {
            return;
        }

        setIsApprovingRequest(true);
        try {
            const activeUserId = activeUser?.id;
            if (!activeUserId) {
                throw new Error('Authentication required.');
            }
            if (!isAdmin) {
                throw new Error('Only administrators can approve coordinator requests.');
            }
            const targetReq = coordinatorRequests.find((r) => r.id === approvingCoordinatorRequest.id) ?? approvingCoordinatorRequest;
            const updated = await coordinatorApprovalService.executeApprovedRequest(targetReq, activeUser);

            showToast({
                type: 'success',
                title: 'Request Approved & Executed',
                description: `Action "${(targetReq.action ?? '').replace(/_/g, ' ')}" approved and executed with administrative privileges.`,
            });

            if (activeSelectedRequest?.id === approvingCoordinatorRequest.id) {
                const targetTab = activeSelectedRequest?._targetTab ?? 'information';
                const nextItem = { ...activeSelectedRequest, ...updated, status: constants.COORDINATOR_REQUESTS_STATUS.APPROVED, _targetTab: targetTab };
                setSelectedRequestItem(nextItem);
                onSelectRequest?.(nextItem, targetTab);
            }

            setApprovingCoordinatorRequest(null);
            setViewingCoordinatorRequest(null);
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Approval Failed',
                description: error?.message ?? 'Could not approve request.',
            });
        } finally {
            setIsApprovingRequest(false);
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

        setIsRejectingRequest(true);
        try {
            const activeUserId = activeUser?.id;
            if (!activeUserId) {
                throw new Error('Authentication required.');
            }
            if (!isAdmin) {
                throw new Error('Only administrators can reject coordinator requests.');
            }
            await coordinatorApprovalService.rejectCoordinatorRequest({
                ...rejectingCoordinatorRequest,
                rejectionReason: rejectionReason.trim() || undefined,
            });

            await fetchCoordinatorRequests();

            showToast({
                type: 'success',
                title: 'Request Rejected',
                description: 'Coordinator request rejected and recorded under Decisions.',
            });

            if (activeSelectedRequest?.id === rejectingCoordinatorRequest.id) {
                const targetTab = activeSelectedRequest?._targetTab ?? 'information';
                const nextItem = {
                    ...activeSelectedRequest,
                    status: constants.COORDINATOR_REQUESTS_STATUS.REJECTED,
                    rejectionReason: rejectionReason.trim() || undefined,
                    _targetTab: targetTab,
                };
                setSelectedRequestItem(nextItem);
                onSelectRequest?.(nextItem, targetTab);
            }

            setRejectingCoordinatorRequest(null);
            setViewingCoordinatorRequest(null);
            setRejectionReason('');
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Rejection Failed',
                description: error?.message ?? 'Could not reject request.',
            });
        } finally {
            setIsRejectingRequest(false);
        }
    };

    const handleCoordinatorAction = (actionKey, item) => {
        if (actionKey === 'open' || actionKey === 'inspect' || actionKey === 'view_payload') {
            handleOpenCoordinatorReview(item);
            return;
        }

        if (actionKey === 'approve') {
            handleStartCoordinatorApproval(item);
            return;
        }

        if (actionKey === 'reject') {
            handleStartCoordinatorRejection(item);
            return;
        }

        if (actionKey === 'delete') {
            if (item.status && item.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING) {
                showToast({
                    type: 'error',
                    title: 'Action Prohibited',
                    description: 'Only pending coordinator requests can be deleted. Finalized requests cannot be removed.',
                });
                return;
            }
            setDeletingRequestItem(item);
        }
    };

    const handleConfirmDeleteRequest = async () => {
        if (!deletingRequestItem?.id) {
            return;
        }

        if (deletingRequestItem.status && deletingRequestItem.status !== constants.COORDINATOR_REQUESTS_STATUS.PENDING) {
            showToast({
                type: 'error',
                title: 'Action Prohibited',
                description: 'Only pending coordinator requests can be deleted. Finalized requests cannot be removed.',
            });
            setDeletingRequestItem(null);
            return;
        }

        setIsDeletingRequest(true);
        try {
            await deleteCoordinatorRequest(deletingRequestItem.id);
            showToast({
                type: 'success',
                title: 'Request Deleted',
                description: 'Coordinator request removed from queue.',
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
        <Container variant="page" className={`flex flex-col gap-4 sm:gap-5 ${className ?? ''}`} {...props}>
            <Browser
                resourceName="coordinator_requests"
                title="Manage Coordinator Requests"
                description={isAdmin
                    ? "Manage institutional coordinator requests."
                    : "Manage departmental coordinator requests."
                }
                data={pendingCoordinatorData}
                columns={COORDINATOR_COLUMNS}
                sortOptions={COORDINATOR_SORT_OPTIONS}
                filterOptions={COORDINATOR_FILTER_OPTIONS}
                selectedItem={activeSelectedRequest}
                searchPlaceholder="Search request..."
                onSelectItem={handleSelectRequest}
                onOpenItem={handleOpenCoordinatorReview}
                onItemAction={handleCoordinatorAction}
            />

            <hr className="border-t border-surface-border my-2" />

            {/* RESOLVED COORDINATOR REQUESTS (APPROVED & REJECTED DECISIONS) */}
            <History
                title="Decisions"
                description="Approved and rejected requests."
                resourceName="coordinator_requests"
                data={resolvedCoordinatorData}
                selectedId={activeSelectedRequest?.id}
                onItemClick={(item) => handleSelectRequest(item)}
                onItemAction={handleCoordinatorAction}
                emptyMessage="No processed requests on record."
                searchPlaceholder="Search decisions..."
            />

            {/* COORDINATOR REVIEW DETAILS MODAL */}
            {viewingCoordinatorRequest && (
                <Modal
                    isOpen={Boolean(viewingCoordinatorRequest)}
                    onClose={() => setViewingCoordinatorRequest(null)}
                    size="lg"
                    title="Review Request"
                    description={`Action: ${(viewingCoordinatorRequest.action ?? '').replace(/_/g, ' ')} • Submitted on ${formatDateTime(viewingCoordinatorRequest.createdAt)}`}
                    icon={ClipboardCheck}
                    callout={
                        viewingCoordinatorRequest.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING
                            ? 'Carefully review the proposed changes before approving or rejecting execution.'
                            : `This request has already been processed with status "${viewingCoordinatorRequest.status}".`
                    }
                    calloutVariant="neutral"
                    actions={
                        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 w-full">
                            <Button
                                variant="secondary"
                                onClick={() => setViewingCoordinatorRequest(null)}
                                label="Close"
                                className="w-full sm:w-auto"
                            />
                            {viewingCoordinatorRequest.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING && isAdmin && (
                                <>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            const requestToReject = viewingCoordinatorRequest;
                                            setViewingCoordinatorRequest(null);
                                            handleStartCoordinatorRejection(requestToReject);
                                        }}
                                        label="Reject Request"
                                        className="w-full sm:w-auto"
                                    />
                                    <Button
                                        variant="primary"
                                        onClick={() => {
                                            const requestToApprove = viewingCoordinatorRequest;
                                            handleStartCoordinatorApproval(requestToApprove);
                                        }}
                                        label="Approve & Execute"
                                        className="w-full sm:w-auto"
                                    />
                                </>
                            )}
                            {!isAdmin && (
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        const requestToDelete = viewingCoordinatorRequest;
                                        setViewingCoordinatorRequest(null);
                                        setDeletingRequestItem(requestToDelete);
                                    }}
                                    label="Delete Request"
                                    className="w-full sm:w-auto"
                                />
                            )}
                        </div>
                    }
                >
                    <div className="flex flex-col gap-4 py-2 text-text">
                        <div className="flex flex-col gap-2 p-3.5 bg-surface-hover/70 rounded-xl border border-surface-border text-xs shadow-2xs">
                            <div className="flex items-center justify-between py-1 border-b border-surface-border/60">
                                <span className="font-medium text-text-muted">Coordinator:</span>
                                <span className="font-semibold text-text">{viewingCoordinatorRequest.requesterName}</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-surface-border/60">
                                <span className="font-medium text-text-muted">Department:</span>
                                <span className="font-semibold text-text">{viewingCoordinatorRequest.department}</span>
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <span className="font-medium text-text-muted">Action Type:</span>
                                <span className="font-bold text-accent px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20">
                                    {(viewingCoordinatorRequest.action ?? '').replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-text">Payload / Proposed Changes:</span>
                            <div className="p-3.5 rounded-xl bg-surface border border-surface-border text-xs text-text overflow-x-auto flex flex-col gap-2 max-h-64 overflow-y-auto shadow-2xs">
                                {typeof viewingCoordinatorRequest.data === 'object' && viewingCoordinatorRequest.data !== null ? (
                                    Object.entries(viewingCoordinatorRequest.data).map(([k, v]) => {
                                        if (k === 'old' || k === 'new') {
                                            const isNew = k === 'new';
                                            return (
                                                <div key={k} className={`p-2.5 rounded-lg border flex flex-col gap-1 ${
                                                    isNew
                                                        ? 'bg-accent/5 border-accent/30'
                                                        : 'bg-surface-hover/50 border-surface-border'
                                                }`}>
                                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isNew ? 'text-accent' : 'text-text-muted'}`}>
                                                        {isNew ? 'Proposed (New)' : 'Current (Previous)'}
                                                    </span>
                                                    <div className="flex flex-col gap-1 text-xs">
                                                        {typeof v === 'object' && v !== null ? (
                                                            Object.entries(v).map(([propK, propV]) => (
                                                                <div key={propK} className="flex items-center justify-between gap-2">
                                                                    <span className="text-text-muted capitalize">{propK}:</span>
                                                                    <span className="font-semibold text-text">{String(propV ?? '—')}</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="font-medium text-text">{String(v ?? '—')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={k} className="flex items-center justify-between gap-2 py-1 border-b border-surface-border/50">
                                                <span className="font-semibold text-text-muted capitalize shrink-0">{k.replace(/_/g, ' ')}:</span>
                                                {k === 'attachments' && Array.isArray(v) ? (
                                                    <div className="flex flex-col gap-1 items-end">
                                                        {v.map((att, idx) => (
                                                            <span key={idx} className="text-right text-accent font-medium truncate inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10">
                                                                📎 {att.name || att.title || `Document #${idx + 1}`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="font-medium text-text text-right font-mono truncate">
                                                        {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '—')}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <pre className="text-xs text-text overflow-x-auto p-2 rounded bg-surface-hover">
                                        {typeof viewingCoordinatorRequest.data === 'string'
                                            ? viewingCoordinatorRequest.data
                                            : JSON.stringify(viewingCoordinatorRequest.data, null, 2)}
                                    </pre>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* APPROVE REQUEST CONFIRMATION MODAL */}
            {approvingCoordinatorRequest && (
                <Modal
                    isOpen={Boolean(approvingCoordinatorRequest)}
                    onClose={() => !isApprovingRequest && setApprovingCoordinatorRequest(null)}
                    title="Approve Request"
                    description={`Are you sure you want to approve this request for action "${(approvingCoordinatorRequest.action ?? '').replace(/_/g, ' ')}"?`}
                    icon={CheckCircle2}
                    size="sm"
                    callout="Approving will immediately apply and execute the proposed changes with administrative privileges."
                    calloutVariant="neutral"
                    onConfirm={handleConfirmApproveRequest}
                    confirmLabel={isApprovingRequest ? 'Approving...' : 'Approve & Execute'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isApprovingRequest}
                    isConfirmDisabled={isApprovingRequest}
                />
            )}

            {/* COORDINATOR REJECTION REASON MODAL */}
            {rejectingCoordinatorRequest && (
                <Modal
                    isOpen={Boolean(rejectingCoordinatorRequest)}
                    onClose={() => !isRejectingRequest && setRejectingCoordinatorRequest(null)}
                    title="Reject Request"
                    description={`Are you sure you want to reject this request for action "${(rejectingCoordinatorRequest.action ?? '').replace(/_/g, ' ')}"?`}
                    icon={XCircle}
                    variant="destructive"
                    callout="Rejection will notify the department coordinator and terminate the requested operation."
                    calloutVariant="destructive"
                    onConfirm={handleConfirmCoordinatorRejection}
                    confirmLabel={isRejectingRequest ? 'Rejecting...' : 'Reject Request'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isRejectingRequest}
                    isConfirmDisabled={isRejectingRequest}
                >
                    <div className="flex flex-col gap-3 py-2">
                        <AreaField
                            label="Rejection Reason"
                            placeholder="Enter rejection reason..."
                            value={rejectionReason}
                            onChange={(changeEvent) => setRejectionReason(changeEvent.target.value)}
                        />
                    </div>
                </Modal>
            )}

            {/* DELETE REQUEST CONFIRMATION MODAL */}
            {deletingRequestItem && (
                <Modal
                    isOpen={Boolean(deletingRequestItem)}
                    onClose={() => !isDeletingRequest && setDeletingRequestItem(null)}
                    title="Delete Request"
                    description="Are you sure you want to delete this coordinator request? This action cannot be undone."
                    icon={Trash2}
                    variant="destructive"
                    size="sm"
                    callout="This request and all its associated review history will be permanently deleted."
                    calloutVariant="destructive"
                    onConfirm={handleConfirmDeleteRequest}
                    confirmLabel={isDeletingRequest ? 'Deleting Request...' : 'Delete Request'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isDeletingRequest}
                    isConfirmDisabled={isDeletingRequest}
                />
            )}
        </Container>
    );
};


// --- EXPORTS ---
export { CoordinatorPage };
export default CoordinatorPage;
