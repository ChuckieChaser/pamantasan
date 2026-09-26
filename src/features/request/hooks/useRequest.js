// --- USE REQUEST HOOK ---
import { useCallback } from 'react';
import { useRequestStore } from '../requestStore';


// --- HOOK ---

export const useRequest = () => {
    const requests = useRequestStore((s) => s.requests);
    const selectedRequest = useRequestStore((s) => s.selectedRequest);
    const messages = useRequestStore((s) => s.messages);
    const attachments = useRequestStore((s) => s.attachments);
    const isLoading = useRequestStore((s) => s.isLoading);
    const isMutating = useRequestStore((s) => s.isMutating);
    const error = useRequestStore((s) => s.error);

    const getRequests = useRequestStore((s) => s.getRequests);
    const getRequestsByRequesterId = useRequestStore((s) => s.getRequestsByRequesterId);
    const getRequestById = useRequestStore((s) => s.getRequestById);
    const createRequest = useRequestStore((s) => s.createRequest);
    const updateRequest = useRequestStore((s) => s.updateRequest);
    const updateRequests = useRequestStore((s) => s.updateRequests);
    const deleteRequests = useRequestStore((s) => s.deleteRequests);
    const getRequestMessagesByRequestId = useRequestStore((s) => s.getRequestMessagesByRequestId);
    const createRequestMessage = useRequestStore((s) => s.createRequestMessage);
    const updateRequestMessage = useRequestStore((s) => s.updateRequestMessage);
    const deleteRequestMessages = useRequestStore((s) => s.deleteRequestMessages);
    const getRequestAttachmentsByRequestId = useRequestStore((s) => s.getRequestAttachmentsByRequestId);
    const createRequestAttachment = useRequestStore((s) => s.createRequestAttachment);
    const createRequestAttachments = useRequestStore((s) => s.createRequestAttachments);
    const deleteRequestAttachments = useRequestStore((s) => s.deleteRequestAttachments);
    const setSelectedRequest = useRequestStore((s) => s.setSelectedRequest);
    const clearError = useRequestStore((s) => s.clearError);
    const reset = useRequestStore((s) => s.reset);


    // --- HANDLERS ---

    const handleGetRequests = useCallback(
        (filters) => getRequests(filters),
        [getRequests],
    );

    const handleGetRequestById = useCallback(
        (id) => getRequestById(id),
        [getRequestById],
    );

    const handleCreateRequest = useCallback(
        (payload) => createRequest(payload),
        [createRequest],
    );

    const handleUpdateRequest = useCallback(
        (id, payload) => updateRequest(id, payload),
        [updateRequest],
    );

    const handleDeleteRequests = useCallback(
        (ids) => deleteRequests(ids),
        [deleteRequests],
    );

    const handleGetMessages = useCallback(
        (requestId) => getRequestMessagesByRequestId(requestId),
        [getRequestMessagesByRequestId],
    );

    const handleCreateMessage = useCallback(
        (payload) => createRequestMessage(payload),
        [createRequestMessage],
    );

    const handleGetAttachments = useCallback(
        (requestId) => getRequestAttachmentsByRequestId(requestId),
        [getRequestAttachmentsByRequestId],
    );

    const handleCreateAttachments = useCallback(
        (dataList) => createRequestAttachments(dataList),
        [createRequestAttachments],
    );


    return {
        // State
        requests,
        selectedRequest,
        messages,
        attachments,
        isLoading,
        isMutating,
        error,

        // Handlers
        handleGetRequests,
        handleGetRequestById,
        handleCreateRequest,
        handleUpdateRequest,
        handleDeleteRequests,
        handleGetMessages,
        handleCreateMessage,
        handleGetAttachments,
        handleCreateAttachments,

        // Direct
        getRequestsByRequesterId,
        updateRequests,
        updateRequestMessage,
        deleteRequestMessages,
        createRequestAttachment,
        deleteRequestAttachments,
        setSelectedRequest,
        clearError,
        reset,
    };
};
