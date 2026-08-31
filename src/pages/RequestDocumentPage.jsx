// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    Clock,
    CheckCircle2,
    XCircle,
    Inbox,
    Plus,
} from 'lucide-react';
import {
    PageContainer,
    Browser,
    TextField,
    AreaField,
    SelectField,
    Modal,
    useToast,
} from '../components';
import { useDocumentRequestStore } from '../stores';
import { DOCUMENT_REQUEST_STATUSES } from '../constants';

// --- CONFIGURATIONS ---
const PRESET_REQUEST_TYPES = [
    { value: 'Official Transcript of Records Clearance', label: 'Official Transcript of Records Clearance' },
    { value: 'Certificate of Good Moral Character', label: 'Certificate of Good Moral Character' },
    { value: 'Certified True Copy of Academic Records', label: 'Certified True Copy of Academic Records' },
    { value: 'Curriculum Evaluation Clearance', label: 'Curriculum Evaluation Clearance' },
    { value: 'Special Institutional Certification', label: 'Special Institutional Certification' },
];

const MY_REQUEST_COLUMNS = [
    { key: 'title', label: 'Document Requested' },
    { key: 'status', label: 'Status' },
    { key: 'messageCount', label: 'Messages' },
    { key: 'date', label: 'Submitted Date' },
];

const MY_REQUEST_SORT_OPTIONS = [
    { value: 'date-desc', label: 'Recently Submitted', icon: Clock },
    { value: 'date-asc', label: 'Oldest Submitted', icon: Clock },
    { value: 'name-asc', label: 'Subject (A to Z)', icon: Inbox },
    { value: 'name-desc', label: 'Subject (Z to A)', icon: Inbox },
];

const MY_REQUEST_FILTER_OPTIONS = [
    { category: 'Status', value: DOCUMENT_REQUEST_STATUSES.OPEN, label: 'Open', icon: Clock },
    { category: 'Status', value: DOCUMENT_REQUEST_STATUSES.RESOLVED, label: 'Resolved', icon: CheckCircle2 },
    { category: 'Status', value: DOCUMENT_REQUEST_STATUSES.REJECTED, label: 'Rejected', icon: XCircle },
];

// --- COMPONENTS ---
const RequestDocumentPage = ({
    currentUser = null,
    onSelectDocument = null,
    className,
    ...props
}) => {
    // HOOKS
    const { showToast } = useToast();

    // STORES
    const requests = useDocumentRequestStore((state) => state.requests);
    const messages = useDocumentRequestStore((state) => state.messages);
    const createDocumentRequest = useDocumentRequestStore((state) => state.createDocumentRequest);
    const addRequestMessage = useDocumentRequestStore((state) => state.addRequestMessage);

    // STATES
    const [selectedRequestItem, setSelectedRequestItem] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewingRequest, setViewingRequest] = useState(null);
    const [selectedPresetType, setSelectedPresetType] = useState(PRESET_REQUEST_TYPES[0].value);
    const [customSubject, setCustomSubject] = useState('');
    const [requestDetails, setRequestDetails] = useState('');
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // DERIVED VALUES
    const myRequests = useMemo(() => {
        const userId = currentUser?.id ?? 'f1000001-0000-4000-8000-000000000005';
        return requests.filter((item) => item.requester_id === userId);
    }, [requests, currentUser]);

    const formattedRequestData = useMemo(() => {
        return myRequests.map((request) => {
            const requestMessages = messages.filter((message) => message.document_request_id === request.id);
            return {
                ...request,
                id: request.id,
                title: request.subject,
                subject: request.subject,
                status: request.status,
                purpose: request.purpose ?? 'Document issuance, clearance, and certificate verification.',
                messages: requestMessages,
                messageCount: `${requestMessages.length} msgs`,
                metadata: `${request.status} · ${requestMessages.length} msgs`,
                description: request.purpose ?? `Verification request submitted on ${new Date(request.created_at).toLocaleDateString()}.`,
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
    }, [myRequests, messages]);

    const activeViewingMessages = useMemo(() => {
        if (!viewingRequest) {
            return [];
        }
        return messages.filter((message) => message.document_request_id === viewingRequest.id);
    }, [viewingRequest, messages]);

    // HANDLERS
    const handleSelectRequest = (item) => {
        setSelectedRequestItem(item);
        onSelectDocument?.(item);
    };

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

    const handleItemAction = (actionKey, item) => {
        if (actionKey === 'open') {
            handleSelectRequest(item);
            setViewingRequest(item);
            return;
        }
    };

    const handleSubmitRequest = async () => {
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
            const newRequest = await createDocumentRequest({
                requester_id: currentUser?.id ?? 'f1000001-0000-4000-8000-000000000005',
                subject: finalSubject,
            });

            await addRequestMessage({
                document_request_id: newRequest.id,
                user_id: currentUser?.id ?? 'f1000001-0000-4000-8000-000000000005',
                message: requestDetails.trim(),
            });

            showToast({
                type: 'success',
                title: 'Request Submitted',
                description: `Your request for "${finalSubject}" has been queued for verification.`,
            });

            handleCloseCreateModal();
            setIsSubmitting(false);
        } catch (error) {
            setIsSubmitting(false);
            setFormError(error?.message ?? 'Failed to submit document request.');
        }
    };

    return (
        <PageContainer className={`flex flex-col gap-6 ${className ?? ''}`} {...props}>
            <Browser
                resourceName="my_requests"
                title="Manage Document Requests"
                description="Submit document issuance, clearance, and certificate requests to the registrar and track real-time verification progress."
                data={formattedRequestData}
                columns={MY_REQUEST_COLUMNS}
                sortOptions={MY_REQUEST_SORT_OPTIONS}
                filterOptions={MY_REQUEST_FILTER_OPTIONS}
                selectedItem={selectedRequestItem}
                addItemLabel="New Request"
                addItemIcon={Plus}
                searchPlaceholder="Search my requests..."
                onAddItem={handleOpenCreateModal}
                onSelectItem={handleSelectRequest}
                onOpenItem={(item) => {
                    handleSelectRequest(item);
                    setViewingRequest(item);
                }}
                onItemAction={handleItemAction}
            />

            {/* NEW REQUEST MODAL */}
            {isCreateModalOpen && (
                <Modal
                    isOpen={isCreateModalOpen}
                    onClose={handleCloseCreateModal}
                    title="New Document Request"
                    description="Submit document clearance or certificate request to administration."
                    onConfirm={handleSubmitRequest}
                    confirmLabel={isSubmitting ? 'Submitting...' : 'Submit Request'}
                    confirmDisabled={isSubmitting}
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

            {/* VIEW THREAD MODAL */}
            {viewingRequest && (
                <Modal
                    isOpen={Boolean(viewingRequest)}
                    onClose={() => setViewingRequest(null)}
                    title={viewingRequest.subject}
                    description={`Status: ${viewingRequest.status} • Submitted on ${new Date(viewingRequest.created_at).toLocaleString()}`}
                    cancelLabel="Close"
                    onCancel={() => setViewingRequest(null)}
                >
                    <div className="flex flex-col gap-3 py-2">
                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto p-3 rounded-lg bg-surface-hover/50 border border-surface-border">
                            {activeViewingMessages.length === 0 ? (
                                <div className="text-center py-4 text-xs text-text-muted">
                                    No messages recorded.
                                </div>
                            ) : (
                                activeViewingMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className="p-2.5 rounded-lg bg-surface border border-surface-border flex flex-col gap-1 text-xs"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-text">
                                                {msg.user_id === currentUser?.id ? 'You' : 'Administration'}
                                            </span>
                                            <span className="text-text-muted text-xs">
                                                {new Date(msg.created_at).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                        <p className="text-text-muted">
                                            {msg.message}
                                        </p>
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

export default RequestDocumentPage;
