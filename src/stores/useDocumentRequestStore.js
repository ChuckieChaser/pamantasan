// --- IMPORTS ---
import { create } from 'zustand';
import {
    DocumentRequestInsertSchema,
    DocumentRequestUpdateSchema,
    DocumentRequestMessageInsertSchema,
    DocumentRequestAttachmentInsertSchema,
} from '../schemas';
import { DOCUMENT_REQUEST_STATUSES } from '../constants';
import {
    MOCK_DOCUMENT_REQUESTS,
    MOCK_REQUEST_MESSAGES,
    MOCK_REQUEST_ATTACHMENTS,
} from '../mocks';

// --- STORE DEFINITION ---
const useDocumentRequestStore = create((set, get) => ({
    // STATE
    requests: MOCK_DOCUMENT_REQUESTS,
    messages: MOCK_REQUEST_MESSAGES,
    attachments: MOCK_REQUEST_ATTACHMENTS,
    selectedRequest: null,
    isLoading: false,
    error: null,

    // ACTIONS
    fetchDocumentRequests: async (filterOptions = {}) => {
        set({ isLoading: true, error: null });

        try {
            let resultRequests = [...get().requests];

            if (filterOptions.status) {
                resultRequests = resultRequests.filter(
                    (item) => item.status === filterOptions.status
                );
            }

            if (filterOptions.requesterId) {
                resultRequests = resultRequests.filter(
                    (item) => item.requester_id === filterOptions.requesterId
                );
            }

            set({ isLoading: false });
            return resultRequests;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch document requests.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    fetchDocumentRequestById: async (requestId) => {
        set({ isLoading: true, error: null });

        try {
            const request = get().requests.find((item) => item.id === requestId) ?? null;
            const requestMessages = get().messages.filter(
                (item) => item.document_request_id === requestId
            );
            const requestAttachments = get().attachments.filter(
                (item) => item.document_request_id === requestId
            );

            const compositeRequest = request
                ? { ...request, messages: requestMessages, attachments: requestAttachments }
                : null;

            set({ selectedRequest: compositeRequest, isLoading: false });
            return compositeRequest;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch document request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createDocumentRequest: async (requestPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = DocumentRequestInsertSchema.parse(requestPayload);
            const timestamp = new Date().toISOString();

            const newRequest = {
                id: validatedData.id ?? `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                requester_id: validatedData.requester_id,
                resolver_id: null,
                subject: validatedData.subject,
                status: validatedData.status ?? DOCUMENT_REQUEST_STATUSES.OPEN,
                created_at: timestamp,
                updated_at: timestamp,
            };

            set((state) => ({
                requests: [newRequest, ...state.requests],
                isLoading: false,
            }));

            return newRequest;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create document request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    updateDocumentRequest: async (requestId, requestUpdates) => {
        set({ isLoading: true, error: null });

        try {
            const validatedUpdates = DocumentRequestUpdateSchema.parse(requestUpdates);
            const targetRequest = get().requests.find((item) => item.id === requestId);

            if (!targetRequest) {
                throw new Error(`Request with identifier "${requestId}" was not found.`);
            }

            const updatedRequest = {
                ...targetRequest,
                ...validatedUpdates,
                updated_at: new Date().toISOString(),
            };

            set((state) => ({
                requests: state.requests.map((item) =>
                    item.id === requestId ? updatedRequest : item
                ),
                selectedRequest: state.selectedRequest?.id === requestId
                    ? { ...state.selectedRequest, ...updatedRequest }
                    : state.selectedRequest,
                isLoading: false,
            }));

            return updatedRequest;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update document request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    addRequestMessage: async (messagePayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = DocumentRequestMessageInsertSchema.parse(messagePayload);
            const timestamp = new Date().toISOString();

            const newMessage = {
                id: validatedData.id ?? `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                document_request_id: validatedData.document_request_id,
                user_id: validatedData.user_id ?? null,
                message: validatedData.message,
                created_at: timestamp,
            };

            set((state) => ({
                messages: [...state.messages, newMessage],
                selectedRequest: state.selectedRequest?.id === newMessage.document_request_id
                    ? {
                          ...state.selectedRequest,
                          messages: [...(state.selectedRequest.messages ?? []), newMessage],
                      }
                    : state.selectedRequest,
                isLoading: false,
            }));

            return newMessage;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to add message to document request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    attachDocumentToRequest: async (attachmentPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = DocumentRequestAttachmentInsertSchema.parse(attachmentPayload);
            const timestamp = new Date().toISOString();

            const newAttachment = {
                id: validatedData.id ?? `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                document_request_id: validatedData.document_request_id,
                document_id: validatedData.document_id,
                attached_by_id: validatedData.attached_by_id,
                created_at: timestamp,
            };

            set((state) => ({
                attachments: [...state.attachments, newAttachment],
                selectedRequest: state.selectedRequest?.id === newAttachment.document_request_id
                    ? {
                          ...state.selectedRequest,
                          attachments: [...(state.selectedRequest.attachments ?? []), newAttachment],
                      }
                    : state.selectedRequest,
                isLoading: false,
            }));

            return newAttachment;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to attach document to request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    deleteDocumentRequest: async (requestId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                requests: state.requests.filter((item) => item.id !== requestId),
                messages: state.messages.filter((item) => item.document_request_id !== requestId),
                attachments: state.attachments.filter((item) => item.document_request_id !== requestId),
                selectedRequest: state.selectedRequest?.id === requestId
                    ? null
                    : state.selectedRequest,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete document request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    removeRequestAttachment: async (attachmentId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                attachments: state.attachments.filter((item) => item.id !== attachmentId),
                selectedRequest: state.selectedRequest
                    ? {
                          ...state.selectedRequest,
                          attachments: (state.selectedRequest.attachments ?? []).filter(
                              (item) => item.id !== attachmentId
                          ),
                      }
                    : state.selectedRequest,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to remove request attachment.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    setSelectedRequest: (request) => {
        set({ selectedRequest: request });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export {
    useDocumentRequestStore,
};

export default useDocumentRequestStore;
