// --- IMPORTS ---
import { create } from 'zustand';
import {
    DocumentRequestInsertSchema,
    DocumentRequestUpdateSchema,
} from '../schemas';
import { DOCUMENT_REQUEST_STATUSES } from '../constants';

// --- STORE DEFINITION ---
const useDocumentRequestStore = create((set, get) => ({
    // STATE
    documentRequests: [],
    requests: [],
    requestMessages: [],
    messages: [],
    requestAttachments: [],
    attachments: [],
    selectedRequest: null,
    isLoading: false,
    error: null,

    // 1. DOCUMENT REQUESTS ACTIONS
    fetchDocumentRequests: async (filterOptions = {}) => {
        set({ isLoading: true, error: null });

        try {
            let resultRequests = [...get().documentRequests];

            if (filterOptions.status) {
                resultRequests = resultRequests.filter(
                    (req) => req.status === filterOptions.status
                );
            }

            if (filterOptions.requesterId) {
                resultRequests = resultRequests.filter(
                    (req) => req.requester_id === filterOptions.requesterId
                );
            }

            if (filterOptions.resolverId) {
                resultRequests = resultRequests.filter(
                    (req) => req.resolver_id === filterOptions.resolverId
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
            const request = get().documentRequests.find((item) => item.id === requestId) ?? null;
            set({ selectedRequest: request, isLoading: false });
            return request;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch document request by identifier.';
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
                id: validatedData.id ?? `req-${Date.now()}`,
                requester_id: validatedData.requester_id,
                resolver_id: validatedData.resolver_id ?? null,
                subject: validatedData.subject,
                status: validatedData.status ?? DOCUMENT_REQUEST_STATUSES.OPEN,
                created_at: timestamp,
                updated_at: timestamp,
            };

            set((state) => {
                const nextList = [newRequest, ...state.documentRequests];
                return {
                    documentRequests: nextList,
                    requests: nextList,
                    isLoading: false,
                };
            });

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
            const targetRequest = get().documentRequests.find((item) => item.id === requestId);

            if (!targetRequest) {
                throw new Error(`Document request with identifier "${requestId}" was not found.`);
            }

            const updatedRequest = {
                ...targetRequest,
                ...validatedUpdates,
                updated_at: new Date().toISOString(),
            };

            set((state) => {
                const nextList = state.documentRequests.map((item) =>
                    item.id === requestId ? updatedRequest : item
                );
                return {
                    documentRequests: nextList,
                    requests: nextList,
                    selectedRequest: state.selectedRequest?.id === requestId
                        ? updatedRequest
                        : state.selectedRequest,
                    isLoading: false,
                };
            });

            return updatedRequest;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update document request.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    // 2. REQUEST MESSAGES ACTIONS
    fetchMessagesByRequestId: async (requestId) => {
        set({ isLoading: true, error: null });

        try {
            const messages = get().requestMessages.filter(
                (item) => item.request_id === requestId
            );
            set({ isLoading: false });
            return messages;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch request messages.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    addRequestMessage: async (messagePayload) => {
        set({ isLoading: true, error: null });

        try {
            const requestId = messagePayload.document_request_id ?? messagePayload.request_id;
            const senderId = messagePayload.user_id ?? messagePayload.sender_id;
            const text = messagePayload.message;

            const newMessage = {
                id: messagePayload.id ?? `msg-${Date.now()}`,
                request_id: requestId,
                document_request_id: requestId,
                sender_id: senderId,
                user_id: senderId,
                message: text,
                created_at: new Date().toISOString(),
            };

            set((state) => {
                const nextMessages = [...state.requestMessages, newMessage];
                return {
                    requestMessages: nextMessages,
                    messages: nextMessages,
                    isLoading: false,
                };
            });

            return newMessage;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to add request message.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    // 3. REQUEST ATTACHMENTS ACTIONS
    fetchAttachmentsByRequestId: async (requestId) => {
        set({ isLoading: true, error: null });

        try {
            const attachments = get().requestAttachments.filter(
                (item) => item.request_id === requestId || item.document_request_id === requestId
            );
            set({ isLoading: false });
            return attachments;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch request attachments.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    addRequestAttachment: async (attachmentPayload) => {
        set({ isLoading: true, error: null });

        try {
            const requestId = attachmentPayload.document_request_id ?? attachmentPayload.request_id;
            const docId = attachmentPayload.document_id ?? attachmentPayload.id;
            const attachedById = attachmentPayload.attached_by_id ?? attachmentPayload.user_id;

            const newAttachment = {
                id: attachmentPayload.id ?? `att-${Date.now()}`,
                request_id: requestId,
                document_request_id: requestId,
                document_id: docId,
                attached_by_id: attachedById,
                name: attachmentPayload.name ?? 'Attached Document',
                path: attachmentPayload.path ?? '',
                size_bytes: attachmentPayload.size_bytes ?? 0,
                mime_type: attachmentPayload.mime_type ?? 'application/pdf',
                created_at: new Date().toISOString(),
            };

            set((state) => {
                const nextAttachments = [...state.requestAttachments, newAttachment];
                return {
                    requestAttachments: nextAttachments,
                    attachments: nextAttachments,
                    isLoading: false,
                };
            });

            return newAttachment;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to add request attachment.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    resolveDocumentRequest: async (requestId, resolverId) => {
        return get().updateDocumentRequest(requestId, {
            status: DOCUMENT_REQUEST_STATUSES.RESOLVED,
            resolver_id: resolverId,
        });
    },

    rejectDocumentRequest: async (requestId, reason, resolverId) => {
        return get().updateDocumentRequest(requestId, {
            status: DOCUMENT_REQUEST_STATUSES.REJECTED,
            resolver_id: resolverId,
        });
    },

    attachDocumentToRequest: async (attachmentPayload) => {
        return get().addRequestAttachment(attachmentPayload);
    },

    // 4. RESET ACTIONS
    resetSelectedRequest: () => {
        set({ selectedRequest: null });
    },
}));

export { useDocumentRequestStore };

export default useDocumentRequestStore;
