// --- IMPORTS ---
import { useState, useMemo, useEffect } from 'react';
import {
    UserCheck,
    CheckCircle2,
    XCircle,
    Clock,
    ClipboardCheck,
    Trash2,
} from 'lucide-react';
import {
    AreaField,
    Browser,
    Button,
    Container,
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
    { key: 'requesterName', label: 'Department Coordinator' },
    { key: 'department', label: 'Department' },
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
    const [rejectingCoordinatorRequest, setRejectingCoordinatorRequest] = useState(null);
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

    // LISTEN FOR EXTERNAL DELETE TRIGGER (E.G. FROM INSPECTOR QUICK ACTION)
    useEffect(() => {
        const handleDeleteCoordinatorRequestEvent = (event) => {
            if (event.detail) {
                const targetRequest = (coordinatorRequests || []).find((r) => r.id === event.detail.id) ?? event.detail;
                setDeletingRequestItem(targetRequest);
            }
        };
        window.addEventListener('pamantasan:delete-coordinator-request', handleDeleteCoordinatorRequestEvent);
        return () => window.removeEventListener('pamantasan:delete-coordinator-request', handleDeleteCoordinatorRequestEvent);
    }, [coordinatorRequests]);

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

            return {
                ...request,
                id: request.id,
                title: displayTitle,
                action: request.action,
                requesterId: requesterId,
                requesterName,
                user: requesterName,
                department: department?.name ?? departmentCode,
                departmentCode: departmentCode,
                status: request.status,
                data: request.data,
                rejectionReason: request.rejectionReason ?? null,
                metadata: `${requesterName} (${departmentCode})`,
                description: displayDescription,
                createdAt: createdAtDate,
                updatedAt: updatedAtDate,
                date: formattedDate,
                badge: request.status,
            };
        });
    }, [coordinatorRequests, users, departments, isAdmin, activeUser?.id]);

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

    const handleApproveCoordinatorRequest = async (requestId) => {
        try {
            const activeUserId = activeUser?.id;
            if (!activeUserId) {
                throw new Error('Authentication required.');
            }
            if (!isAdmin) {
                throw new Error('Only administrators can approve coordinator requests.');
            }
            const targetReq = coordinatorRequests.find((r) => r.id === requestId) ?? viewingCoordinatorRequest ?? activeSelectedRequest;
            if (!targetReq) {
                throw new Error('Request not found.');
            }
            const updated = await coordinatorApprovalService.executeApprovedRequest(targetReq, activeUser);

            showToast({
                type: 'success',
                title: 'Request Approved & Executed',
                description: `Action "${(targetReq.action ?? '').replace(/_/g, ' ')}" approved and executed with administrative privileges.`,
            });

            setViewingCoordinatorRequest(null);
            if (activeSelectedRequest?.id === requestId) {
                const targetTab = activeSelectedRequest?._targetTab ?? 'information';
                const nextItem = { ...activeSelectedRequest, ...updated, status: constants.COORDINATOR_REQUESTS_STATUS.APPROVED, _targetTab: targetTab };
                setSelectedRequestItem(nextItem);
                onSelectRequest?.(nextItem, targetTab);
            }
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
            const activeUserId = activeUser?.id;
            if (!activeUserId) {
                throw new Error('Authentication required.');
            }
            if (!isAdmin) {
                throw new Error('Only administrators can reject coordinator requests.');
            }
            await coordinatorApprovalService.rejectCoordinatorRequest(rejectingCoordinatorRequest);

            showToast({
                type: 'success',
                title: 'Request Rejected & Removed',
                description: 'Coordinator action rejected and removed.',
            });

            if (activeSelectedRequest?.id === rejectingCoordinatorRequest.id) {
                setSelectedRequestItem(null);
                onSelectRequest?.(null);
            }

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
            setDeletingRequestItem(item);
        }
    };

    const handleConfirmDeleteRequest = async () => {
        if (!deletingRequestItem?.id) {
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
        <Container variant="page" className={`flex flex-col gap-6 ${className ?? ''}`} {...props}>
            <Browser
                resourceName="coordinator_requests"
                title={isAdmin ? "Coordinator Requests" : "My Requests"}
                description={isAdmin
                    ? "Administrator review and governance queue for departmental sharing and metadata actions."
                    : "Track the status of your actions pending administrator review and approval."
                }
                data={formattedCoordinatorData}
                columns={COORDINATOR_COLUMNS}
                sortOptions={COORDINATOR_SORT_OPTIONS}
                filterOptions={COORDINATOR_FILTER_OPTIONS}
                selectedItem={activeSelectedRequest}
                searchPlaceholder="Search by action or coordinator name..."
                onSelectItem={handleSelectRequest}
                onOpenItem={handleOpenCoordinatorReview}
                onItemAction={handleCoordinatorAction}
            />

            {/* COORDINATOR REVIEW DETAILS MODAL */}
            {viewingCoordinatorRequest && (
                <Modal
                    isOpen={Boolean(viewingCoordinatorRequest)}
                    onClose={() => setViewingCoordinatorRequest(null)}
                    title={`Review Request: ${(viewingCoordinatorRequest.action ?? '').replace(/_/g, ' ')}`}
                    description={`Status: ${viewingCoordinatorRequest.status} • Submitted on ${new Date(viewingCoordinatorRequest.createdAt).toLocaleString()}`}
                    icon={ClipboardCheck}
                    callout={
                        viewingCoordinatorRequest.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING
                            ? 'Carefully review the proposed changes before approving or rejecting execution.'
                            : `This request has already been processed with status "${viewingCoordinatorRequest.status}".`
                    }
                    calloutVariant={viewingCoordinatorRequest.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING ? 'accent' : 'neutral'}
                    actions={
                        <div className="flex items-center justify-end gap-3 w-full">
                            <Button
                                variant="secondary"
                                onClick={() => setViewingCoordinatorRequest(null)}
                                label="Close"
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
                                    />
                                    <Button
                                        variant="primary"
                                        onClick={() => handleApproveCoordinatorRequest(viewingCoordinatorRequest.id)}
                                        label="Approve & Execute"
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
                                />
                            )}
                        </div>
                    }
                >
                    <div className="flex flex-col gap-4 py-2 text-text">
                        <div className="flex flex-col gap-2 p-3 bg-surface-hover rounded-lg border border-surface-border text-xs">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-text-muted">Coordinator:</span>
                                <span className="font-medium text-text">{viewingCoordinatorRequest.requesterName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-text-muted">Department:</span>
                                <span className="font-medium text-text">{viewingCoordinatorRequest.department}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-text-muted">Action Type:</span>
                                <span className="font-bold text-accent">{viewingCoordinatorRequest.action}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-text-muted">Payload / Action Details:</span>
                            <div className="p-3 rounded-lg bg-surface border border-surface-border text-xs text-text overflow-x-auto flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                                {typeof viewingCoordinatorRequest.data === 'object' && viewingCoordinatorRequest.data !== null ? (
                                    Object.entries(viewingCoordinatorRequest.data).map(([k, v]) => (
                                        <div key={k} className="flex items-center justify-between gap-2 py-0.5 border-b border-surface-border/50">
                                            <span className="font-semibold text-text-muted capitalize shrink-0">{k.replace(/_/g, ' ')}:</span>
                                            {k === 'attachments' && Array.isArray(v) ? (
                                                <div className="flex flex-col gap-0.5 items-end">
                                                    {v.map((att, idx) => (
                                                        <span key={idx} className="text-right text-text font-medium truncate">
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
                                    ))
                                ) : (
                                    <pre className="text-xs text-text overflow-x-auto">
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

            {/* COORDINATOR REJECTION REASON MODAL */}
            {rejectingCoordinatorRequest && (
                <Modal
                    isOpen={Boolean(rejectingCoordinatorRequest)}
                    onClose={() => setRejectingCoordinatorRequest(null)}
                    title="Reject Coordinator Request"
                    description={`Provide reason for rejecting action "${rejectingCoordinatorRequest.action}".`}
                    icon={XCircle}
                    variant="destructive"
                    callout="Rejection will notify the coordinator and terminate the requested operation."
                    calloutVariant="destructive"
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

            {/* DELETE REQUEST CONFIRMATION MODAL */}
            {deletingRequestItem && (
                <Modal
                    isOpen={Boolean(deletingRequestItem)}
                    onClose={() => !isDeletingRequest && setDeletingRequestItem(null)}
                    title="Delete Request"
                    description={`Are you sure you want to delete this coordinator request?`}
                    icon={Trash2}
                    variant="destructive"
                    size="sm"
                    callout="This request and all its associated review history will be permanently deleted."
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
export { CoordinatorPage };
export default CoordinatorPage;
