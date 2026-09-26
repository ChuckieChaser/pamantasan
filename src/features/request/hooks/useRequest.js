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

    const fetchRequests = useRequestStore((s) => s.fetchRequests);
    const fetchRequestsByRequesterId = useRequestStore((s) => s.fetchRequestsByRequesterId);
    const fetchRequestById = useRequestStore((s) => s.fetchRequestById);
    const createRequest = useRequestStore((s) => s.createRequest);
    const updateRequest = useRequestStore((s) => s.updateRequest);
    const updateRequests = useRequestStore((s) => s.updateRequests);
    const deleteRequests = useRequestStore((s) => s.deleteRequests);
    const fetchMessagesByRequestId = useRequestStore((s) => s.fetchMessagesByRequestId);
    const createMessage = useRequestStore((s) => s.createMessage);
    const updateMessage = useRequestStore((s) => s.updateMessage);
    const deleteMessages = useRequestStore((s) => s.deleteMessages);
    const fetchAttachmentsByRequestId = useRequestStore((s) => s.fetchAttachmentsByRequestId);
    const createAttachment = useRequestStore((s) => s.createAttachment);
    const createAttachments = useRequestStore((s) => s.createAttachments);
    const deleteAttachments = useRequestStore((s) => s.deleteAttachments);
    const setSelectedRequest = useRequestStore((s) => s.setSelectedRequest);
    const clearError = useRequestStore((s) => s.clearError);
    const reset = useRequestStore((s) => s.reset);


    // --- HANDLERS ---

    const handleFetchRequests = useCallback(
        (filters) => fetchRequests(filters),
        [fetchRequests],
    );

    const handleFetchById = useCallback(
        (id) => fetchRequestById(id),
        [fetchRequestById],
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

    const handleSendMessage = useCallback(
        (payload) => createMessage(payload),
        [createMessage],
    );

    const handleAddAttachments = useCallback(
        (dataList) => createAttachments(dataList),
        [createAttachments],
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
        handleFetchRequests,
        handleFetchById,
        handleCreateRequest,
        handleUpdateRequest,
        handleDeleteRequests,
        handleSendMessage,
        handleAddAttachments,

        // Direct
        fetchRequestsByRequesterId,
        updateRequests,
        fetchMessagesByRequestId,
        updateMessage,
        deleteMessages,
        fetchAttachmentsByRequestId,
        createAttachment,
        deleteAttachments,
        setSelectedRequest,
        clearError,
        reset,
    };
};
